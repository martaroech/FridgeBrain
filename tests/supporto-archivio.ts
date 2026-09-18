import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TestContext } from "node:test";
import { ArchivioFridgeBrain } from "../src/lib/servizi";
import type { Prodotto } from "../src/lib/tipi";

export const prodottiSample = JSON.parse(
  readFileSync(resolve("tests/fixtures/prodotti_sample.json"), "utf8"),
) as Prodotto[];
export const prodottoProva: Prodotto = {
  code: "8000000000015",
  product_name: "Ceci lessati di prova",
  brands: "Cucina test",
  unita_nutrizionale: "g",
  ingredients_text: "Ceci, acqua",
  labels_tags: ["en:vegan", "en:gluten-free", "en:milk-free"],
  nutriments: {
    "energy-kcal_100g": 120,
    carbohydrates_100g: 18,
    sugars_100g: 1,
    proteins_100g: 7,
    fat_100g: 2,
    fiber_100g: 5,
    salt_100g: 0.2,
  },
};

export function preparaArchivio(contesto: TestContext, conCatalogo = true) {
  const cartella = mkdtempSync(join(tmpdir(), "fridgebrain-test-"));
  const percorsoCatalogo = join(cartella, "foods.db");
  if (conCatalogo) {
    const catalogo = new DatabaseSync(percorsoCatalogo);
    catalogo.exec(
      "CREATE TABLE prodotti(code TEXT PRIMARY KEY,product_name TEXT,brands TEXT,dati TEXT); CREATE VIRTUAL TABLE ricerca_prodotti USING fts5(product_name,brands,content='prodotti',content_rowid='rowid');",
    );
    const inserisci = catalogo.prepare(
      "INSERT INTO prodotti(code,product_name,brands,dati) VALUES (?,?,?,?)",
    );
    for (const prodotto of prodottiSample)
      inserisci.run(
        prodotto.code,
        prodotto.product_name,
        prodotto.brands ?? "",
        JSON.stringify(prodotto),
      );
    catalogo.exec(
      "INSERT INTO ricerca_prodotti(ricerca_prodotti) VALUES ('rebuild')",
    );
    catalogo.close();
  }
  const archivio = new ArchivioFridgeBrain({
    percorsoDati: join(cartella, "personale"),
    percorsoCatalogo,
  });
  contesto.after(() => {
    archivio.chiudi();
    rmSync(cartella, { recursive: true, force: true });
  });
  return { archivio, cartella, percorsoCatalogo };
}
