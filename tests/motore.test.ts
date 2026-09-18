import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  calcolaNutrizione,
  dataLocale,
  giorniAllaScadenza,
  valoriPerCento,
  unitaNutrizionale,
  validaRicetta,
  valutaAllergene,
  valutaCompatibilita,
  selezionaIngredienti,
  generaRicettaVerificata,
  GeneratoreRicetteLocale,
  GeneratoreRicetteSimulato,
  preferenzeIniziali,
} from "../src/lib/motore";
import type {
  Prodotto,
  VoceInventario,
  RichiestaRicetta,
  PropostaRicetta,
} from "../src/lib/tipi";

const prodotto: Prodotto = {
  code: "0000000000001",
  product_name: "Mozzarella",
  quantity: "250 g",
  allergens_tags: ["en:milk"],
  ingredients_analysis_tags: ["en:vegetarian"],
  nutriments: {
    "energy-kcal_100g": 250,
    carbohydrates_100g: 2,
    sugars_100g: 1,
    proteins_100g: 20,
    fat_100g: 18,
    fiber_100g: 0,
    salt_100g: 0.5,
  },
};
const voce = (aggiunte: Partial<VoceInventario> = {}): VoceInventario => ({
  id: 1,
  prodotto: structuredClone(prodotto),
  confezioni: 1,
  quantita: 250,
  unita: "g",
  posizione: "Frigorifero",
  scadenza: "2099-01-01",
  inserito_il: "2026-09-17T10:00:00Z",
  ...aggiunte,
});
const richiesta = (
  aggiunte: Partial<RichiestaRicetta> = {},
): RichiestaRicetta => ({
  ...structuredClone(preferenzeIniziali),
  persone: 2,
  tempo_massimo: 30,
  ...aggiunte,
});
const ricetta = (aggiunte: Partial<PropostaRicetta> = {}): PropostaRicetta => ({
  titolo: "Mozzarella al piatto",
  minuti: 5,
  porzioni: 2,
  ingredienti: [{ inventario_id: 1, quantita: 80, unita: "g" }],
  passaggi: ["Dividi la mozzarella nei piatti."],
  ...aggiunte,
});

test("calcola tutti i nutrienti per ingrediente, totale e porzione dai valori reali", () => {
  const risultato = calcolaNutrizione(ricetta(), [voce()]);
  assert.deepEqual(risultato.totale, {
    calorie: 200,
    carboidrati: 1.6,
    zuccheri: 0.8,
    proteine: 16,
    grassi: 14.4,
    fibre: 0,
    sale: 0.4,
  });
  assert.deepEqual(risultato.ingredienti[0].valori, risultato.totale);
  assert.equal(risultato.per_porzione.calorie, 100);
  assert.equal(risultato.per_porzione.proteine, 8);
});
test("somma più ingredienti senza arrotondare prima del totale", () => {
  const risultato = calcolaNutrizione(
    ricetta({
      ingredienti: [
        { inventario_id: 1, quantita: 80, unita: "g" },
        { inventario_id: 2, quantita: 25, unita: "g" },
      ],
    }),
    [voce(), voce({ id: 2 })],
  );
  assert.equal(risultato.totale.calorie, 262.5);
  assert.equal(risultato.per_porzione.calorie, 131.25);
});
test("un nutriente assente rende il totale sconosciuto senza perdere gli altri", () => {
  const parziale = voce({
    id: 2,
    prodotto: { ...prodotto, nutriments: { "energy-kcal_100g": 100 } },
  });
  const risultato = calcolaNutrizione(
    ricetta({
      ingredienti: [
        { inventario_id: 1, quantita: 80, unita: "g" },
        { inventario_id: 2, quantita: 50, unita: "g" },
      ],
    }),
    [voce(), parziale],
  );
  assert.equal(risultato.totale.calorie, 250);
  assert.equal(risultato.totale.proteine, null);
  assert.equal(risultato.per_porzione.fibre, null);
});
test("zero esplicito resta zero, valori vuoti o impossibili restano sconosciuti", () => {
  const risultato = valoriPerCento({
    ...prodotto,
    nutriments: {
      sugars_100g: 0,
      proteins_100g: "",
      fat_100g: -1,
      fiber_100g: null,
      salt_100g: true,
      carbohydrates_100g: 150,
    },
  });
  assert.equal(risultato.zuccheri, 0);
  for (const chiave of [
    "proteine",
    "grassi",
    "fibre",
    "sale",
    "carboidrati",
  ] as const)
    assert.equal(risultato[chiave], null);
});
test("converte energia kJ e mantiene la base per 100 ml senza convertire grammi", () => {
  assert.ok(
    Math.abs(
      valoriPerCento({ ...prodotto, nutriments: { energy_100g: 418.4 } })
        .calorie! - 100,
    ) < 1e-10,
  );
  const bevanda = voce({
    prodotto: { ...prodotto, quantity: "1 l", unita_nutrizionale: "ml" },
    unita: "ml",
  });
  assert.equal(
    calcolaNutrizione(
      ricetta({
        ingredienti: [{ inventario_id: 1, quantita: 50, unita: "ml" }],
      }),
      [bevanda],
    ).totale.calorie,
    125,
  );
  assert.throws(
    () => calcolaNutrizione(ricetta(), [bevanda]),
    /quantità in ml/,
  );
  assert.throws(
    () =>
      calcolaNutrizione(
        ricetta({
          ingredienti: [{ inventario_id: 1, quantita: 1, unita: "pz" }],
        }),
        [voce()],
      ),
    /quantità in g/,
  );
});
test("scadenze usano giorni civili e distinguono oggi, domani e scaduti", () => {
  assert.equal(giorniAllaScadenza("2026-03-29", "2026-03-28"), 1);
  assert.equal(giorniAllaScadenza("2026-10-25", "2026-10-24"), 1);
  assert.equal(giorniAllaScadenza("2026-09-17", "2026-09-17"), 0);
  assert.equal(giorniAllaScadenza("2026-09-16", "2026-09-17"), -1);
  assert.equal(giorniAllaScadenza(null), null);
});
test("distingue allergene presente, assenza dichiarata, non segnalato e sconosciuto", () => {
  assert.equal(valutaAllergene(prodotto, "latte"), "presente");
  assert.equal(
    valutaAllergene({ ...prodotto, traces_tags: ["en:gluten"] }, "en:gluten"),
    "presente",
  );
  assert.equal(
    valutaAllergene(
      { ...prodotto, labels_tags: ["en:gluten-free"] },
      "glutine",
    ),
    "assenza_dichiarata",
  );
  assert.equal(valutaAllergene(prodotto, "glutine"), "non_segnalato");
  assert.equal(
    valutaAllergene({ code: "1", product_name: "Mela" }, "glutine"),
    "sconosciuto",
  );
  assert.equal(
    valutaAllergene({ ...prodotto, labels_tags: ["en:lactose-free"] }, "latte"),
    "presente",
  );
});
test("restrizioni escludono incertezza, tracce e dichiarazioni contraddittorie", () => {
  assert.equal(
    valutaCompatibilita(prodotto, richiesta({ allergeni: ["glutine"] }))
      .compatibile,
    false,
  );
  assert.equal(
    valutaCompatibilita(
      { ...prodotto, labels_tags: ["en:gluten-free"] },
      richiesta({ allergeni: ["glutine"] }),
    ).compatibile,
    true,
  );
  assert.equal(
    valutaCompatibilita(
      { ...prodotto, labels_tags: ["en:milk-free"] },
      richiesta({ allergeni: ["latte"] }),
    ).compatibile,
    false,
  );
  assert.equal(
    valutaCompatibilita(prodotto, richiesta({ esclusioni: ["mozzarella"] }))
      .compatibile,
    false,
  );
});
test("preferenze vegetariana e vegana richiedono dati affidabili", () => {
  assert.equal(
    valutaCompatibilita(prodotto, richiesta({ regime: "vegetariano" }))
      .compatibile,
    true,
  );
  assert.equal(
    valutaCompatibilita(prodotto, richiesta({ regime: "vegano" })).compatibile,
    false,
  );
  assert.equal(
    valutaCompatibilita(
      {
        ...prodotto,
        allergens_tags: [],
        ingredients_analysis_tags: ["en:vegan"],
      },
      richiesta({ regime: "vegano" }),
    ).compatibile,
    true,
  );
  assert.equal(
    valutaCompatibilita(
      { code: "1", product_name: "Preparato" },
      richiesta({ regime: "vegetariano" }),
    ).compatibile,
    false,
  );
});
test("seleziona solo prodotti misurati compatibili non scaduti, ordinati per priorità", () => {
  const voci = [
    voce(),
    voce({ id: 2, scadenza: dataLocale() }),
    voce({ id: 3, scadenza: "2000-01-01" }),
    voce({ id: 4, quantita: null }),
    voce({ id: 5, unita: "pz" }),
  ];
  assert.deepEqual(
    selezionaIngredienti(voci, richiesta()).map((voce) => voce.id),
    [2, 1],
  );
});
test("rifiuta inventario inesistente, quantità eccessive o duplicate e unità errate", () => {
  for (const ingredienti of [
    [{ inventario_id: 999, quantita: 1, unita: "g" as const }],
    [{ inventario_id: 1, quantita: 251, unita: "g" as const }],
    [{ inventario_id: 1, quantita: -1, unita: "g" as const }],
    [{ inventario_id: 1, quantita: NaN, unita: "g" as const }],
    [{ inventario_id: 1, quantita: 10, unita: "ml" as const }],
    [
      { inventario_id: 1, quantita: 200, unita: "g" as const },
      { inventario_id: 1, quantita: 200, unita: "g" as const },
    ],
  ])
    assert.throws(() =>
      validaRicetta(ricetta({ ingredienti }), [voce()], richiesta()),
    );
});
test("controlla tutti i limiti numerici, comprese informazioni insufficienti", () => {
  assert.doesNotThrow(() =>
    validaRicetta(
      ricetta(),
      [voce()],
      richiesta({
        limiti: [
          { nutriente: "calorie", massimo: 100 },
          { nutriente: "proteine", minimo: 8 },
        ],
      }),
    ),
  );
  assert.throws(
    () =>
      validaRicetta(
        ricetta(),
        [voce()],
        richiesta({ limiti: [{ nutriente: "calorie", massimo: 99 }] }),
      ),
    /massimo/,
  );
  assert.throws(
    () =>
      validaRicetta(
        ricetta(),
        [voce()],
        richiesta({ limiti: [{ nutriente: "proteine", minimo: 9 }] }),
      ),
    /minimo/,
  );
  assert.throws(
    () =>
      validaRicetta(
        ricetta(),
        [voce({ prodotto: { ...prodotto, nutriments: {} } })],
        richiesta({ limiti: [{ nutriente: "sale", massimo: 1 }] }),
      ),
    /incompleti/,
  );
  assert.throws(
    () => validaRicetta(ricetta({ porzioni: 1 }), [voce()], richiesta()),
    /porzioni/,
  );
  assert.throws(
    () => validaRicetta(ricetta({ minuti: 45 }), [voce()], richiesta()),
    /tempo/,
  );
});
test("rigenera proposte non valide con limite di tre tentativi", async () => {
  let chiamate = 0;
  await assert.rejects(
    generaRicettaVerificata([voce()], richiesta(), {
      generatore: {
        nome: "verifica",
        async generaRicetta() {
          chiamate++;
          return ricetta({ minuti: 500 });
        },
      },
    }),
    /3 tentativi/,
  );
  assert.equal(chiamate, 3);
  chiamate = 0;
  const risultato = await generaRicettaVerificata([voce()], richiesta(), {
    generatore: {
      nome: "verifica",
      async generaRicetta() {
        chiamate++;
        return chiamate === 1 ? ricetta({ minuti: 500 }) : ricetta();
      },
    },
  });
  assert.equal(chiamate, 2);
  assert.equal(risultato.nutrizione.per_porzione.calorie, 100);
});
test("provider simulato esplicito e provider locale senza rete Internet", async () => {
  const simulata = await generaRicettaVerificata([voce()], richiesta(), {
    generatore: new GeneratoreRicetteSimulato(),
  });
  assert.equal(simulata.provider, "simulato");
  assert.throws(
    () => new GeneratoreRicetteLocale("https://api.example.com"),
    /locale/,
  );
  let richiestaRicevuta = "";
  const server = createServer(async (domanda, risposta) => {
    for await (const pezzo of domanda) richiestaRicevuta += pezzo;
    risposta.setHeader("Content-Type", "application/json");
    risposta.end(
      JSON.stringify({
        message: { content: JSON.stringify({ ...ricetta(), calorie: 99999 }) },
      }),
    );
  });
  await new Promise<void>((risolvi) => server.listen(0, "127.0.0.1", risolvi));
  try {
    const porta = (server.address() as AddressInfo).port;
    const risultato = await generaRicettaVerificata([voce()], richiesta(), {
      generatore: new GeneratoreRicetteLocale(
        `http://127.0.0.1:${porta}`,
        "modello-prova",
      ),
    });
    assert.equal(risultato.provider, "locale");
    assert.equal(risultato.nutrizione.totale.calorie, 200);
    assert.equal("calorie" in risultato, false);
    assert.ok(richiestaRicevuta.includes("modello-prova"));
    assert.ok(richiestaRicevuta.includes("Mozzarella"));
  } finally {
    await new Promise<void>((risolvi, rifiuta) =>
      server.close((errore) => (errore ? rifiuta(errore) : risolvi())),
    );
  }
});

test("unità nutrizionale riconosce confezioni compatte e rispetta la base esplicita personalizzata", () => {
  assert.equal(unitaNutrizionale({ ...prodotto, quantity: "330ml" }), "ml");
  assert.equal(unitaNutrizionale({ ...prodotto, quantity: "6 x 25 cl" }), "ml");
  assert.equal(
    unitaNutrizionale({
      ...prodotto,
      quantity: "",
      product_quantity_unit: "ml",
    }),
    "ml",
  );
  assert.equal(
    unitaNutrizionale({
      ...prodotto,
      quantity: "1 l",
      unita_nutrizionale: "g",
    }),
    "g",
  );
  assert.equal(unitaNutrizionale({ ...prodotto, quantity: "250 g" }), "g");
});

test("dichiarazioni non vegetariane e allergeni italiani prevalgono su etichette vegane contraddittorie", () => {
  const contraddittorio = {
    ...prodotto,
    allergens_tags: [],
    labels_tags: ["en:vegan"],
    ingredients_analysis_tags: ["en:non-vegetarian"],
  };
  assert.equal(
    valutaCompatibilita(contraddittorio, richiesta({ regime: "vegano" }))
      .compatibile,
    false,
  );
  assert.equal(
    valutaCompatibilita(
      {
        ...contraddittorio,
        ingredients_analysis_tags: [],
        allergens_tags: ["it:latte"],
      },
      richiesta({ regime: "vegano" }),
    ).compatibile,
    false,
  );
  assert.equal(
    valutaCompatibilita(
      {
        ...contraddittorio,
        ingredients_analysis_tags: [],
        allergens_tags: ["it:pesce"],
      },
      richiesta({ regime: "vegetariano" }),
    ).compatibile,
    false,
  );
});

test("esclusioni controllano anche ingredienti strutturati annidati quando manca il testo", () => {
  const composto = {
    ...prodotto,
    ingredients_text: undefined,
    ingredients: [
      {
        text: "Preparato vegetale",
        ingredients: [{ id: "it:cipolla", text: "Cipolla" }],
      },
    ],
  };
  assert.equal(
    valutaCompatibilita(composto, richiesta({ esclusioni: ["cipolla"] }))
      .compatibile,
    false,
  );
});

test("una quantità oltre la disponibilità è rifiutata anche per piccoli scarti e valori infiniti", () => {
  assert.throws(
    () =>
      validaRicetta(
        ricetta({
          ingredienti: [
            { inventario_id: 1, quantita: 250.0000001, unita: "g" },
          ],
        }),
        [voce()],
        richiesta(),
      ),
    /Quantità non disponibile/,
  );
  assert.deepEqual(
    selezionaIngredienti([voce({ quantita: Infinity })], richiesta()),
    [],
  );
});

test("i limiti accettano l'uguaglianza matematica nonostante la rappresentazione binaria dei decimali", () => {
  const ingredienti = [
    voce({ prodotto: { ...prodotto, nutriments: { salt_100g: 0.1 } } }),
    voce({ id: 2, prodotto: { ...prodotto, nutriments: { salt_100g: 0.2 } } }),
  ];
  const proposta = ricetta({
    porzioni: 1,
    ingredienti: [
      { inventario_id: 1, quantita: 100, unita: "g" },
      { inventario_id: 2, quantita: 100, unita: "g" },
    ],
  });
  const verifica = validaRicetta(
    proposta,
    ingredienti,
    richiesta({
      persone: 1,
      limiti: [{ nutriente: "sale", minimo: 0.3, massimo: 0.3 }],
    }),
  );
  assert.ok(
    Math.abs(verifica.nutrizione.per_porzione.sale! - 0.3) < Number.EPSILON,
  );
  assert.throws(
    () =>
      validaRicetta(
        proposta,
        ingredienti,
        richiesta({
          persone: 1,
          limiti: [{ nutriente: "sale", massimo: 0.299999 }],
        }),
      ),
    /massimo/,
  );
});

test("indirizzi del provider verificano l'intero IPv4 e rifiutano domini con prefissi ingannevoli", () => {
  for (const indirizzo of [
    "http://192.168.attaccante.example",
    "http://10.attaccante.example",
    "http://172.16.attaccante.example",
    "http://127.0.0.1@api.example.com",
    "http://8.8.8.8",
    "https://localhost?destinazione=remoto",
    "indirizzo-errato",
  ])
    assert.throws(() => new GeneratoreRicetteLocale(indirizzo), /locale/);
  for (const indirizzo of [
    "http://127.0.0.1:11434",
    "http://localhost:11434",
    "http://[::1]:11434",
    "http://192.168.1.2:11434",
    "http://10.0.0.2:11434",
    "http://172.31.255.1:11434",
    "http://host.docker.internal:11434",
    "http://ollama:11434",
  ])
    assert.doesNotThrow(() => new GeneratoreRicetteLocale(indirizzo));
});

test("il provider rigenera JSON malformato e invia il motivo di correzione", async (contesto) => {
  let chiamate = 0;
  let richiestaFinale = "";
  const server = createServer(async (domanda, risposta) => {
    chiamate++;
    let contenuto = "";
    for await (const parte of domanda) contenuto += parte;
    richiestaFinale = contenuto;
    risposta.setHeader("Content-Type", "application/json");
    risposta.end(
      JSON.stringify({
        message: {
          content:
            chiamate === 1
              ? "Ecco la ricetta: {non valida}"
              : JSON.stringify(ricetta()),
        },
      }),
    );
  });
  await new Promise<void>((risolvi) => server.listen(0, "127.0.0.1", risolvi));
  contesto.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const porta = (server.address() as AddressInfo).port;
  const risultato = await generaRicettaVerificata([voce()], richiesta(), {
    generatore: new GeneratoreRicetteLocale(
      `http://127.0.0.1:${porta}`,
      "prova",
    ),
  });
  assert.equal(chiamate, 2);
  assert.equal(risultato.titolo, ricetta().titolo);
  assert.match(richiestaFinale, /formato non valido/);
});

test("JSON sempre malformato termina dopo tre risposte senza salvare proposte", async (contesto) => {
  let chiamate = 0;
  const server = createServer((_domanda, risposta) => {
    chiamate++;
    risposta.end("risposta non JSON");
  });
  await new Promise<void>((risolvi) => server.listen(0, "127.0.0.1", risolvi));
  contesto.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const porta = (server.address() as AddressInfo).port;
  await assert.rejects(
    generaRicettaVerificata([voce()], richiesta(), {
      generatore: new GeneratoreRicetteLocale(
        `http://127.0.0.1:${porta}`,
        "prova",
      ),
    }),
    /3 tentativi/,
  );
  assert.equal(chiamate, 3);
});

test("timeout del provider interrompe anche una risposta JSON incompleta senza triplicare l'attesa", async (contesto) => {
  let chiamate = 0;
  const server = createServer((_domanda, risposta) => {
    chiamate++;
    risposta.writeHead(200, { "Content-Type": "application/json" });
    risposta.write('{"message":');
  });
  await new Promise<void>((risolvi) => server.listen(0, "127.0.0.1", risolvi));
  contesto.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const porta = (server.address() as AddressInfo).port;
  await assert.rejects(
    generaRicettaVerificata([voce()], richiesta(), {
      generatore: new GeneratoreRicetteLocale(
        `http://127.0.0.1:${porta}`,
        "prova",
        100,
      ),
    }),
    /in tempo/,
  );
  assert.equal(chiamate, 1);
});

test("redirect e provider indisponibile non attivano richieste esterne né ritentano inutilmente", async (contesto) => {
  let chiamate = 0;
  const server = createServer((_domanda, risposta) => {
    chiamate++;
    risposta.writeHead(302, { Location: "https://servizio-esterno.example" });
    risposta.end();
  });
  await new Promise<void>((risolvi) => server.listen(0, "127.0.0.1", risolvi));
  contesto.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const porta = (server.address() as AddressInfo).port;
  await assert.rejects(
    generaRicettaVerificata([voce()], richiesta(), {
      generatore: new GeneratoreRicetteLocale(
        `http://127.0.0.1:${porta}`,
        "prova",
      ),
    }),
    /non risponde/,
  );
  assert.equal(chiamate, 1);
});
