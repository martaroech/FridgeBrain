import "fake-indexeddb/auto";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import type {TestContext} from "node:test";
import type {ConfigurazioneArchivio} from "../src/lib/database";
import {ArchivioFridgeBrain} from "../src/lib/servizi";
import {GeneratoreRicetteSimulato} from "../src/lib/motore";
import type {Prodotto} from "../src/lib/tipi";
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

export async function preparaArchivio(contesto:TestContext,conCache=true,configurazione:ConfigurazioneArchivio={}) {
  const archivio=new ArchivioFridgeBrain({nomeDatabase:`fridgebrain-test-${crypto.randomUUID()}`,richiediOff:async()=>Response.json({status:0}),generatore:process.env.FRIDGEBRAIN_GENERATORE==="simulato"?new GeneratoreRicetteSimulato():undefined,...configurazione});
  await archivio.database.open();
  if(conCache)for(const prodotto of prodottiSample)await archivio.salvaCacheOff(prodotto);
  contesto.after(async()=>{await archivio.database.delete();});
  return {archivio};
}
