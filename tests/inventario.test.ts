import test from "node:test";
import assert from "node:assert/strict";
import { renameSync, writeFileSync } from "node:fs";
import { preferenzeIniziali, scortaInEsaurimento } from "../src/lib/motore";
import {
  ArchivioFridgeBrain,
  ErroreApplicazione,
  validaScadenza,
} from "../src/lib/servizi";
import { dirname } from "node:path";
import {
  preparaArchivio,
  prodottoProva,
  prodottiSample,
} from "./supporto-archivio";

test("venti barcode del sample restituiscono il prodotto esatto e tutti i nutrienti originali", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  assert.ok(prodottiSample.length >= 20);
  for (const atteso of prodottiSample) {
    const trovato = archivio.prodotto(atteso.code);
    assert.equal(trovato.code, atteso.code);
    assert.equal(trovato.product_name, atteso.product_name);
    assert.deepEqual(trovato.nutriments, atteso.nutriments);
    assert.equal(trovato.ingredients_text, atteso.ingredients_text);
    assert.deepEqual(trovato.allergens_tags, atteso.allergens_tags);
  }
  assert.throws(
    () => archivio.database.catalogo()!.exec("DELETE FROM prodotti"),
    /readonly/i,
  );
});

test("ricerca testuale indicizzata gestisce prefissi, marca e punteggiatura senza errori SQL", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const atteso = prodottiSample[0];
  const parola = atteso.product_name.match(/[\p{L}\p{N}]{3,}/u)![0];
  assert.ok(
    archivio
      .cercaProdotti(parola)
      .some((prodotto) => prodotto.code === atteso.code),
  );
  assert.ok(
    archivio
      .cercaProdotti(atteso.code)
      .some((prodotto) => prodotto.code === atteso.code),
  );
  assert.deepEqual(archivio.cercaProdotti('"* ()'), []);
});

test("aggiunta, modifica posizione, data e quantità conservano lo snapshot indipendente dal catalogo", (contesto) => {
  const { archivio, percorsoCatalogo } = preparaArchivio(contesto);
  const prodotto = prodottiSample[0];
  const voce = archivio.aggiungiInventario({
    codice: prodotto.code,
    confezioni: 2,
    quantita: 500,
    unita: "g",
    posizione: "Frigorifero",
    scadenza: "2030-02-28",
  });
  assert.equal(voce.prodotto.code, prodotto.code);
  const modificata = archivio.modificaInventario(voce.id, {
    quantita: 300,
    posizione: "Freezer",
    scadenza: null,
  });
  assert.equal(modificata.quantita, 300);
  assert.equal(modificata.posizione, "Freezer");
  assert.equal(modificata.scadenza, null);
  // Rinomina consentita dopo aver chiuso esplicitamente la connessione di sola lettura.
  archivio.database.chiudiCatalogo();
  renameSync(percorsoCatalogo, `${percorsoCatalogo}.vecchio`);
  assert.equal(archivio.stato().catalogo_disponibile, false);
  assert.equal(
    archivio.voce(voce.id).prodotto.product_name,
    prodotto.product_name,
  );
  assert.deepEqual(
    archivio.voce(voce.id).prodotto.nutriments,
    prodotto.nutriments,
  );
});

test("prodotti personalizzati funzionano senza foods.db e distinguono nutrienti mancanti da zero", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  const prodotto = archivio.salvaProdotto({
    code: "00001234",
    product_name: "Prodotto di casa",
    nutriments: { sugars_100g: 0, proteins_100g: null },
  });
  assert.equal(archivio.prodotto("00001234").code, "00001234");
  assert.equal(prodotto.nutriments?.sugars_100g, 0);
  assert.equal(prodotto.nutriments?.proteins_100g, null);
  assert.equal(prodotto.nutriments?.fat_100g, undefined);
  const voce = archivio.aggiungiInventario({ codice: prodotto.code });
  assert.equal(voce.quantita, null);
  assert.equal(archivio.stato().catalogo_disponibile, false);
  assert.throws(
    () => archivio.prodotto("99999999"),
    (errore) => errore instanceof ErroreApplicazione && errore.stato === 503,
  );
});

test("date impossibili, quantità negative, infinite e unità sconosciute vengono rifiutate", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const codice = prodottiSample[0].code;
  for (const quantita of [-1, 0, NaN, Infinity, "100"])
    assert.throws(
      () => archivio.aggiungiInventario({ codice, quantita }),
      /Quantità/,
    );
  for (const confezioni of [-1, 0, 1.5, NaN])
    assert.throws(
      () => archivio.aggiungiInventario({ codice, confezioni }),
      /Confezioni/,
    );
  for (const scadenza of ["2027-02-29", "2026-13-01", "2026-04-31", "oggi", 17])
    assert.throws(() => validaScadenza(scadenza), /scadenza/);
  assert.equal(validaScadenza("2028-02-29"), "2028-02-29");
  assert.throws(
    () => archivio.aggiungiInventario({ codice, posizione: "Sconosciuta" }),
    /posizione/,
  );
  assert.throws(
    () => archivio.aggiungiInventario({ codice, unita: "kg" }),
    /unità/,
  );
  assert.throws(
    () => archivio.aggiungiInventario({ codice, unita: "pz", quantita: 1.5 }),
    /Quantità/,
  );
  assert.equal(archivio.inventario().length, 0);
});

test("consumo parziale è atomico, idempotente con chiave e non consente quantità eccessive", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const voce = archivio.aggiungiInventario({
    codice: prodottiSample[0].code,
    quantita: 300,
    unita: "g",
  });
  archivio.consumaInventario(voce.id, { quantita: 80 }, "operazione-uno");
  archivio.consumaInventario(voce.id, { quantita: 80 }, "operazione-uno");
  assert.equal(archivio.voce(voce.id).quantita, 220);
  assert.equal(archivio.storico().length, 1);
  assert.throws(
    () =>
      archivio.consumaInventario(voce.id, { quantita: 90 }, "operazione-uno"),
    /dati diversi/,
  );
  assert.throws(
    () => archivio.consumaInventario(voce.id, { quantita: 221 }),
    /supera/,
  );
  assert.equal(archivio.voce(voce.id).quantita, 220);
  archivio.consumaInventario(voce.id, {});
  assert.equal(archivio.inventario().length, 0);
  assert.equal(archivio.storico().length, 2);
});

test("quantità non misurata permette consumo totale ma impedisce quello parziale", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const voce = archivio.aggiungiInventario({
    codice: prodottiSample[0].code,
    confezioni: 3,
  });
  assert.throws(
    () => archivio.consumaInventario(voce.id, { quantita: 1 }),
    /quantità residua/,
  );
  archivio.consumaInventario(voce.id, {});
  assert.equal(archivio.inventario().length, 0);
});

test("ricevuta aggiunta resta valida senza catalogo e una chiave nuova consente un acquisto uguale", (contesto) => {
  const { archivio, percorsoCatalogo } = preparaArchivio(contesto);
  const dati = {
    codice: prodottiSample[0].code,
    confezioni: 2,
    quantita: 500,
    unita: "g",
  };
  const prima = archivio.aggiungiInventario(dati, "acquisto-uno");
  archivio.database.chiudiCatalogo();
  renameSync(percorsoCatalogo, `${percorsoCatalogo}.vecchio`);
  assert.deepEqual(
    archivio.aggiungiInventario(
      {
        unita: "g",
        quantita: 500,
        confezioni: 2,
        codice: prodottiSample[0].code,
      },
      "acquisto-uno",
    ),
    prima,
  );
  assert.equal(archivio.inventario().length, 1);
  assert.throws(
    () =>
      archivio.aggiungiInventario({ ...dati, quantita: 600 }, "acquisto-uno"),
    /dati diversi/,
  );
  renameSync(`${percorsoCatalogo}.vecchio`, percorsoCatalogo);
  const seconda = archivio.aggiungiInventario(dati, "acquisto-due");
  assert.notEqual(seconda.id, prima.id);
  assert.equal(archivio.inventario().length, 2);
});

test("una creazione fallita non prenota la chiave e non ostacola il tentativo corretto", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  const dati = { codice: prodottoProva.code, quantita: 400, unita: "g" };
  assert.throws(
    () => archivio.aggiungiInventario(dati, "creazione-da-riprovare"),
    /catalogo/,
  );
  archivio.salvaProdotto(prodottoProva);
  const voce = archivio.aggiungiInventario(dati, "creazione-da-riprovare");
  assert.equal(
    archivio.aggiungiInventario(dati, "creazione-da-riprovare").id,
    voce.id,
  );
  assert.equal(archivio.inventario().length, 1);
});

test("eliminazione registra storico e posizioni personalizzate proteggono i prodotti presenti", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  archivio.aggiungiPosizione({ nome: "Cantina" });
  const voce = archivio.aggiungiInventario({
    codice: prodottiSample[0].code,
    posizione: "Cantina",
  });
  assert.throws(() => archivio.eliminaPosizione("Cantina"), /Sposta/);
  archivio.eliminaInventario(voce.id);
  archivio.eliminaPosizione("Cantina");
  assert.equal(archivio.posizioni().includes("Cantina"), false);
  assert.equal(archivio.storico()[0].azione, "eliminazione");
  assert.throws(() => archivio.eliminaPosizione("Frigorifero"), /iniziali/);
});

test("modifica o eliminazione del personalizzato non altera i prodotti già posseduti", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  archivio.salvaProdotto(prodottoProva);
  const voce = archivio.aggiungiInventario({ codice: prodottoProva.code });
  archivio.salvaProdotto(
    { ...prodottoProva, product_name: "Nuova etichetta" },
    prodottoProva.code,
  );
  assert.equal(
    archivio.prodotto(prodottoProva.code).product_name,
    "Nuova etichetta",
  );
  assert.equal(
    archivio.voce(voce.id).prodotto.product_name,
    prodottoProva.product_name,
  );
  archivio.eliminaProdotto(prodottoProva.code);
  assert.equal(
    archivio.voce(voce.id).prodotto.product_name,
    prodottoProva.product_name,
  );
});

test("lista della spesa riordina la spunta e salva preferenze con limiti verificabili", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const prima = archivio.aggiungiSpesa({ nome: "Pomodori", quantita: "500 g" });
  const seconda = archivio.aggiungiSpesa({
    nome: "Pane",
    quantita: "1 confezione",
  });
  archivio.modificaSpesa(seconda.id, { completato: true });
  assert.equal(archivio.spesa()[0].id, prima.id);
  archivio.eliminaSpesa(prima.id);
  assert.equal(archivio.spesa().length, 1);
  const preferenze = {
    ...preferenzeIniziali,
    regime: "vegano",
    allergeni: ["glutine"],
    limiti: [{ nutriente: "sale", massimo: 1.2 }],
  };
  assert.deepEqual(archivio.salvaPreferenze(preferenze), preferenze);
  assert.deepEqual(archivio.preferenze(), preferenze);
  assert.throws(
    () =>
      archivio.salvaPreferenze({
        ...preferenze,
        limiti: [{ nutriente: "proteine", minimo: 20, massimo: 10 }],
      }),
    /minimo/,
  );
  assert.throws(
    () => archivio.salvaPreferenze({ ...preferenze, priorita_scadenza: "sì" }),
    /valore non valido/,
  );
});

test("catalogo corrotto lascia disponibili i dati personali", (contesto) => {
  const { archivio, percorsoCatalogo } = preparaArchivio(contesto, false);
  archivio.salvaProdotto(prodottoProva);
  const voce = archivio.aggiungiInventario({ codice: prodottoProva.code });
  writeFileSync(percorsoCatalogo, "Questo non è un database.");
  assert.equal(archivio.stato().catalogo_disponibile, false);
  assert.equal(archivio.voce(voce.id).prodotto.code, prodottoProva.code);
});

test("ricetta preparata consuma esattamente gli ingredienti e una conferma ripetuta è innocua", async (contesto) => {
  const precedente = process.env.FRIDGEBRAIN_GENERATORE;
  process.env.FRIDGEBRAIN_GENERATORE = "simulato";
  contesto.after(() => {
    if (precedente === undefined) delete process.env.FRIDGEBRAIN_GENERATORE;
    else process.env.FRIDGEBRAIN_GENERATORE = precedente;
  });
  const { archivio } = preparaArchivio(contesto, false);
  archivio.salvaProdotto(prodottoProva);
  const voce = archivio.aggiungiInventario({
    codice: prodottoProva.code,
    quantita: 400,
    scadenza: "2100-01-01",
  });
  const ricetta = await archivio.generaRicetta({
    ...preferenzeIniziali,
    persone: 2,
    tempo_massimo: 30,
  });
  assert.equal(ricetta.nutrizione.totale.calorie, 240);
  assert.equal(ricetta.nutrizione.per_porzione.calorie, 120);
  archivio.preparaRicetta(ricetta.id);
  archivio.preparaRicetta(ricetta.id);
  assert.equal(archivio.voce(voce.id).quantita, 200);
  assert.ok(archivio.ricetta(ricetta.id).preparata_il);
  assert.equal(
    archivio.storico().filter((evento) => evento.azione === "ricetta_preparata")
      .length,
    1,
  );
});

test("consumo ricetta rivalida quantità, scadenza e preferenze aggiornate prima di ogni modifica", async (contesto) => {
  const precedente = process.env.FRIDGEBRAIN_GENERATORE;
  process.env.FRIDGEBRAIN_GENERATORE = "simulato";
  contesto.after(() => {
    if (precedente === undefined) delete process.env.FRIDGEBRAIN_GENERATORE;
    else process.env.FRIDGEBRAIN_GENERATORE = precedente;
  });
  const { archivio } = preparaArchivio(contesto, false);
  archivio.salvaProdotto(prodottoProva);
  const voce = archivio.aggiungiInventario({
    codice: prodottoProva.code,
    quantita: 400,
    scadenza: "2100-01-01",
  });
  const ricetta = await archivio.generaRicetta({
    ...preferenzeIniziali,
    persone: 2,
    tempo_massimo: 30,
  });
  archivio.modificaInventario(voce.id, { quantita: 100 });
  assert.throws(() => archivio.preparaRicetta(ricetta.id), /Quantità/);
  assert.equal(archivio.voce(voce.id).quantita, 100);
  archivio.modificaInventario(voce.id, {
    quantita: 400,
    scadenza: "2000-01-01",
  });
  assert.throws(() => archivio.preparaRicetta(ricetta.id), /scaduto/);
  archivio.modificaInventario(voce.id, { scadenza: "2100-01-01" });
  archivio.salvaPreferenze({ ...preferenzeIniziali, esclusioni: ["ceci"] });
  assert.throws(() => archivio.preparaRicetta(ricetta.id), /incompatibile/);
  assert.equal(archivio.voce(voce.id).quantita, 400);
  assert.equal(archivio.ricetta(ricetta.id).preparata_il, null);
  assert.equal(archivio.storico().length, 0);
});

test("preferenze salvate filtrano gli ingredienti prima della generazione anche se omesse nella richiesta", async (contesto) => {
  const precedente = process.env.FRIDGEBRAIN_GENERATORE;
  process.env.FRIDGEBRAIN_GENERATORE = "simulato";
  contesto.after(() => {
    if (precedente === undefined) delete process.env.FRIDGEBRAIN_GENERATORE;
    else process.env.FRIDGEBRAIN_GENERATORE = precedente;
  });
  const { archivio } = preparaArchivio(contesto, false);
  archivio.salvaProdotto(prodottoProva);
  archivio.salvaProdotto({
    ...prodottoProva,
    code: "8000000000022",
    product_name: "Lenticchie lessate di prova",
    ingredients_text: "Lenticchie, acqua",
  });
  archivio.aggiungiInventario({
    codice: prodottoProva.code,
    quantita: 400,
    scadenza: "2100-01-01",
  });
  const compatibile = archivio.aggiungiInventario({
    codice: "8000000000022",
    quantita: 400,
    scadenza: "2100-01-02",
  });
  archivio.salvaPreferenze({
    ...preferenzeIniziali,
    esclusioni: ["ceci"],
    regime: "vegano",
    allergeni: ["glutine"],
  });
  const ricetta = await archivio.generaRicetta({
    ...preferenzeIniziali,
    persone: 1,
    tempo_massimo: 30,
  });
  assert.deepEqual(
    ricetta.ingredienti.map((ingrediente) => ingrediente.inventario_id),
    [compatibile.id],
  );
});

test("limiti incompatibili tra richiesta e preferenze sono rifiutati senza salvare ricette", async (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  archivio.salvaPreferenze({
    ...preferenzeIniziali,
    limiti: [{ nutriente: "proteine", minimo: 20 }],
  });
  await assert.rejects(
    archivio.generaRicetta({
      ...preferenzeIniziali,
      persone: 1,
      tempo_massimo: 30,
      limiti: [{ nutriente: "proteine", massimo: 10 }],
    }),
    /minimo/,
  );
  assert.equal(archivio.ricette().length, 0);
});
test("le scorte minime sono esplicite, seguono il consumo e si possono disattivare", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  archivio.salvaProdotto(prodottoProva);
  const voce = archivio.aggiungiInventario({
    codice: prodottoProva.code,
    quantita: 500,
    unita: "g",
    scorta_minima: 100,
  });
  assert.equal(scortaInEsaurimento(voce), false);
  archivio.consumaInventario(voce.id, { quantita: 400 });
  assert.equal(scortaInEsaurimento(archivio.voce(voce.id)), true);
  assert.equal(
    archivio.modificaInventario(voce.id, { posizione: "Freezer" })
      .scorta_minima,
    100,
  );
  assert.throws(
    () => archivio.modificaInventario(voce.id, { scorta_minima: -1 }),
    /Scorta minima/,
  );
  assert.throws(
    () => archivio.modificaInventario(voce.id, { quantita: null }),
    /quantità residua/,
  );
  assert.equal(
    scortaInEsaurimento(
      archivio.modificaInventario(voce.id, { scorta_minima: null }),
    ),
    false,
  );
  assert.equal(scortaInEsaurimento({ ...voce, quantita: null }), false);
});

test("la migrazione delle scorte conserva l'inventario di un database versione 1", (contesto) => {
  const { archivio, percorsoCatalogo } = preparaArchivio(contesto, false);
  archivio.salvaProdotto(prodottoProva);
  const voce = archivio.aggiungiInventario({
    codice: prodottoProva.code,
    quantita: 500,
  });
  archivio.database.personale.exec(
    "ALTER TABLE inventario DROP COLUMN scorta_minima; PRAGMA user_version=1",
  );
  const aggiornato = new ArchivioFridgeBrain({
    percorsoDati: dirname(archivio.database.percorsoPersonale),
    percorsoCatalogo,
  });
  try {
    assert.equal(aggiornato.voce(voce.id).quantita, 500);
    assert.equal(
      aggiornato.voce(voce.id).prodotto.product_name,
      prodottoProva.product_name,
    );
    assert.equal(aggiornato.voce(voce.id).scorta_minima, null);
    assert.equal(
      aggiornato.database.personale.prepare("PRAGMA user_version").get()
        ?.user_version,
      2,
    );
  } finally {
    aggiornato.chiudi();
  }
});
