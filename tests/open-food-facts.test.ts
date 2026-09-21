import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { dirname } from "node:path";
import {
  preparaArchivio,
  prodottiSample,
  prodottoProva,
} from "./supporto-archivio";
import { ArchivioFridgeBrain, ErroreApplicazione } from "../src/lib/servizi";
import { normalizzaProdottoOff } from "../src/lib/open-food-facts";

async function preparaHttp(
  contesto: TestContext,
  rispondi: (richiesta: IncomingMessage, risposta: ServerResponse) => void,
) {
  const server = createServer(rispondi);
  await new Promise<void>((pronto) => server.listen(0, "127.0.0.1", pronto));
  contesto.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const indirizzo = server.address();
  assert.ok(indirizzo && typeof indirizzo !== "string");
  return `http://127.0.0.1:${indirizzo.port}`;
}
const stato = (atteso: number) => (errore: unknown) =>
  errore instanceof ErroreApplicazione && errore.stato === atteso;

test("cache presente e alias GTIN non eseguono richieste HTTP", async (contesto) => {
  const { archivio } = preparaArchivio(contesto, true, {
    richiediOff: async () => {
      assert.fail("Richiesta HTTP inattesa");
    },
  });
  for (const prodotto of prodottiSample)
    assert.deepEqual(await archivio.recuperaProdotto(prodotto.code), prodotto);
  assert.equal(
    (await archivio.recuperaProdotto("013800810168")).code,
    "0013800810168",
  );
});

test("cache assente recupera venti prodotti tramite HTTP con User-Agent e conserva nutrienti ingredienti e allergeni", async (contesto) => {
  let richieste = 0;
  const indirizzoOff = await preparaHttp(contesto, (richiesta, risposta) => {
    richieste++;
    assert.match(richiesta.headers["user-agent"] ?? "", /^FridgeBrain\/1\.0/);
    const indirizzo = new URL(richiesta.url!, "http://localhost");
    assert.ok(indirizzo.searchParams.get("fields")?.includes("nutriments"));
    const codice = indirizzo.pathname.match(/\/product\/(\d+)\.json$/)![1];
    risposta.setHeader("Content-Type", "application/json");
    risposta.end(
      JSON.stringify({
        status: 1,
        product: prodottiSample.find((prodotto) => prodotto.code === codice),
      }),
    );
  });
  const { archivio } = preparaArchivio(contesto, false, {
    indirizzoOff,
    richiediOff: fetch,
  });
  for (const atteso of prodottiSample) {
    const prodotto = await archivio.recuperaProdotto(atteso.code);
    assert.equal(prodotto.product_name, atteso.product_name);
    assert.deepEqual(prodotto.nutriments, atteso.nutriments);
    assert.equal(prodotto.ingredients_text, atteso.ingredients_text);
    assert.deepEqual(prodotto.allergens_tags, atteso.allergens_tags);
    assert.deepEqual(await archivio.recuperaProdotto(atteso.code), prodotto);
    const riga = archivio.database.personale
      .prepare("SELECT * FROM cache_prodotti_off WHERE barcode=?")
      .get(atteso.code)!;
    assert.equal(riga.recuperato_il, riga.aggiornato_il);
    assert.ok(Number.isFinite(Date.parse(String(riga.recuperato_il))));
  }
  assert.equal(richieste, prodottiSample.length);
});

test("scansioni simultanee equivalenti condividono il recupero HTTP", async (contesto) => {
  let chiamate = 0;
  const originale = prodottiSample.find(
    (voce) => voce.code === "0013800810168",
  )!;
  const { archivio } = preparaArchivio(contesto, false, {
    richiediOff: async () => {
      chiamate++;
      await new Promise((risolvi) => setTimeout(risolvi, 20));
      return Response.json({ status: 1, product: originale });
    },
  });
  const risultati = await Promise.all([
    archivio.recuperaProdotto(originale.code),
    archivio.recuperaProdotto("013800810168"),
  ]);
  assert.equal(chiamate, 1);
  assert.deepEqual(risultati[0], risultati[1]);
});

for (const [descrizione, risposta, atteso] of [
  ["prodotto OFF non trovato", () => Response.json({ status: 0 }), 404],
  ["HTTP 404", () => Response.json({ status: 0 }, { status: 404 }), 404],
  [
    "servizio indisponibile",
    () => new Response("indisponibile", { status: 503 }),
    503,
  ],
  ["rate limiting", () => new Response("limite", { status: 429 }), 429],
  [
    "JSON malformato",
    () =>
      new Response("{", { headers: { "Content-Type": "application/json" } }),
    502,
  ],
  [
    "tipo di contenuto non valido",
    () => new Response("<html>errore</html>"),
    502,
  ],
  [
    "risposta senza stato",
    () => Response.json({ product: prodottoProva }),
    502,
  ],
  [
    "prodotto di barcode diverso",
    () =>
      Response.json({
        status: 1,
        product: { ...prodottoProva, code: "12345678" },
      }),
    502,
  ],
  [
    "prodotto senza nome",
    () => Response.json({ status: 1, product: { code: prodottoProva.code } }),
    502,
  ],
  [
    "nutrienti malformati",
    () =>
      Response.json({
        status: 1,
        product: { ...prodottoProva, nutriments: [] },
      }),
    502,
  ],
  [
    "allergeni malformati",
    () =>
      Response.json({
        status: 1,
        product: { ...prodottoProva, allergens_tags: "latte" },
      }),
    502,
  ],
  [
    "risposta troppo grande",
    () =>
      Response.json({
        status: 1,
        product: {
          ...prodottoProva,
          ingredients_text: "a".repeat(2 * 1024 * 1024),
        },
      }),
    502,
  ],
] as const) {
  test(`${descrizione}: errore comprensibile e nessuna cache contaminata`, async (contesto) => {
    const { archivio } = preparaArchivio(contesto, false, {
      richiediOff: async () => risposta(),
    });
    await assert.rejects(
      archivio.recuperaProdotto(prodottoProva.code),
      stato(atteso),
    );
    assert.equal(
      archivio.database.personale
        .prepare("SELECT COUNT(*) AS numero FROM cache_prodotti_off")
        .get()!.numero,
      0,
    );
  });
}

test("errore di rete non impedisce l'utilizzo di prodotti già salvati", async (contesto) => {
  const { archivio } = preparaArchivio(contesto, true, {
    richiediOff: async () => {
      throw new TypeError("rete");
    },
  });
  await assert.rejects(
    archivio.recuperaProdotto(prodottoProva.code),
    stato(503),
  );
  assert.deepEqual(
    await archivio.recuperaProdotto(prodottiSample[0].code),
    prodottiSample[0],
  );
});

test("timeout interrompe anche un corpo HTTP incompleto", async (contesto) => {
  const indirizzoOff = await preparaHttp(contesto, (_, risposta) => {
    risposta.setHeader("Content-Type", "application/json");
    risposta.write('{"status":1,');
  });
  const { archivio } = preparaArchivio(contesto, false, {
    indirizzoOff,
    richiediOff: fetch,
    attesaOffMs: 50,
  });
  await assert.rejects(
    archivio.recuperaProdotto(prodottoProva.code),
    stato(504),
  );
});

test("barcode non valido non contatta OFF e il limite 429 introduce una pausa senza bloccare la cache", async (contesto) => {
  let richieste = 0;
  const { archivio } = preparaArchivio(contesto, true, {
    richiediOff: async () => {
      richieste++;
      return new Response(null, { status: 429 });
    },
  });
  await assert.rejects(archivio.recuperaProdotto("abc/123"), stato(400));
  assert.equal(richieste, 0);
  await assert.rejects(
    archivio.recuperaProdotto(prodottoProva.code),
    stato(429),
  );
  await assert.rejects(archivio.recuperaProdotto("99999999"), stato(429));
  await archivio.recuperaProdotto(prodottiSample[0].code);
  assert.equal(richieste, 1);
});

test("dati facoltativi mancanti restano sconosciuti e zero resta zero", () => {
  const prodotto = normalizzaProdottoOff(
    {
      code: "12345678",
      product_name: " Alimento ",
      nutriments: { sugars_100g: 0, salt_100g: null },
    },
    ["12345678"],
  );
  assert.equal(prodotto.product_name, "Alimento");
  assert.equal(prodotto.nutriments?.sugars_100g, 0);
  assert.equal(prodotto.nutriments?.salt_100g, null);
  assert.equal(prodotto.nutriments?.proteins_100g, undefined);
  assert.equal(prodotto.allergens_tags, undefined);
  assert.equal(prodotto.ingredients_text, undefined);
});

test("aggiornamento cache conserva il primo recupero e non modifica lo snapshot dell'inventario", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const originale = prodottiSample[0];
  const voce = archivio.aggiungiInventario({
    codice: originale.code,
    quantita: 250,
  });
  archivio.database.personale
    .prepare(
      "UPDATE cache_prodotti_off SET recuperato_il=?,aggiornato_il=? WHERE barcode=?",
    )
    .run("2020-01-01", "2020-01-01", originale.code);
  archivio.salvaCacheOff({ ...originale, product_name: "Nome aggiornato" });
  const riga = archivio.database.personale
    .prepare("SELECT * FROM cache_prodotti_off WHERE barcode=?")
    .get(originale.code)!;
  assert.equal(riga.recuperato_il, "2020-01-01");
  assert.notEqual(riga.aggiornato_il, "2020-01-01");
  assert.equal(
    archivio.prodotto(originale.code).product_name,
    "Nome aggiornato",
  );
  assert.deepEqual(archivio.voce(voce.id).prodotto, originale);
});

test("migrazione dalla versione 2 conserva dati personali e crea una cache persistente", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  archivio.aggiungiSpesa({ nome: "Latte" });
  archivio.database.personale.exec(
    "DROP TABLE cache_prodotti_off; PRAGMA user_version=2",
  );
  const aggiornato = new ArchivioFridgeBrain({
    percorsoDati: dirname(archivio.database.percorsoPersonale),
  });
  try {
    assert.equal(aggiornato.spesa()[0].nome, "Latte");
    aggiornato.salvaCacheOff(prodottoProva);
    assert.deepEqual(archivio.prodotto(prodottoProva.code), prodottoProva);
    assert.equal(
      aggiornato.database.personale.prepare("PRAGMA user_version").get()!
        .user_version,
      3,
    );
  } finally {
    aggiornato.chiudi();
  }
});
