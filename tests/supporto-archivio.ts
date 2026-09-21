import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ConfigurazioneArchivio } from "../src/lib/database";
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

export function preparaArchivio(
  contesto: TestContext,
  conCache = true,
  configurazione: ConfigurazioneArchivio = {},
) {
  const cartella = mkdtempSync(join(tmpdir(), "fridgebrain-test-"));
  const archivio = new ArchivioFridgeBrain({
    percorsoDati: join(cartella, "personale"),
    richiediOff: async () => Response.json({ status: 0 }),
    ...configurazione,
  });
  if (conCache)
    for (const prodotto of prodottiSample) archivio.salvaCacheOff(prodotto);
  contesto.after(() => {
    archivio.chiudi();
    rmSync(cartella, { recursive: true, force: true });
  });
  return { archivio, cartella };
}
