import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { ArchivioFridgeBrain } from "../src/lib/servizi";
import { dataLocale } from "../src/lib/motore";
import type { Prodotto } from "../src/lib/tipi";

const cartella = resolve("data/demo");
if (existsSync(join(cartella, "fridgebrain.db"))) {
  console.log(
    "La cucina dimostrativa esiste già in data/demo. Nessun dato è stato modificato.",
  );
  process.exit(0);
}
const archivio = new ArchivioFridgeBrain({ percorsoDati: cartella });
const prodotti: Prodotto[] = [
  {
    code: "2000000000015",
    product_name: "Ceci lessati",
    brands: "Cucina dimostrativa",
    quantity: "400 g",
    ingredients_text: "Ceci, acqua",
    labels_tags: ["en:vegan", "en:gluten-free"],
    unita_nutrizionale: "g",
    nutriments: {
      "energy-kcal_100g": 120,
      carbohydrates_100g: 18,
      sugars_100g: 1,
      proteins_100g: 7,
      fat_100g: 2,
      fiber_100g: 5,
      salt_100g: 0.2,
    },
  },
  {
    code: "2000000000022",
    product_name: "Passata di pomodoro",
    brands: "Cucina dimostrativa",
    quantity: "500 g",
    ingredients_text: "Pomodoro",
    labels_tags: ["en:vegan", "en:gluten-free"],
    unita_nutrizionale: "g",
    nutriments: {
      "energy-kcal_100g": 30,
      carbohydrates_100g: 4.5,
      sugars_100g: 3.6,
      proteins_100g: 1.3,
      fat_100g: 0.2,
      fiber_100g: 1.5,
      salt_100g: 0.1,
    },
  },
  {
    code: "2000000000039",
    product_name: "Yogurt bianco",
    brands: "Cucina dimostrativa",
    quantity: "250 g",
    ingredients_text: "Latte, fermenti lattici",
    allergens_tags: ["en:milk"],
    ingredients_analysis_tags: ["en:vegetarian"],
    unita_nutrizionale: "g",
    nutriments: {
      "energy-kcal_100g": 62,
      carbohydrates_100g: 4.6,
      sugars_100g: 4.6,
      proteins_100g: 3.5,
      fat_100g: 3.3,
      fiber_100g: 0,
      salt_100g: 0.12,
    },
  },
  {
    code: "2000000000046",
    product_name: "Piselli surgelati",
    brands: "Cucina dimostrativa",
    quantity: "600 g",
    ingredients_text: "Piselli",
    labels_tags: ["en:vegan", "en:gluten-free"],
    unita_nutrizionale: "g",
    nutriments: {
      "energy-kcal_100g": 70,
      carbohydrates_100g: 8,
      sugars_100g: 3,
      proteins_100g: 5,
      fat_100g: 0.7,
      fiber_100g: 5,
      salt_100g: 0.01,
    },
  },
];
try {
  for (const [indice, prodotto] of prodotti.entries()) {
    archivio.salvaProdotto(prodotto);
    const data = new Date();
    data.setDate(data.getDate() + [2, 7, 1, 60][indice]);
    archivio.aggiungiInventario({
      codice: prodotto.code,
      confezioni: 1,
      quantita: [400, 500, 250, 600][indice],
      unita: "g",
      posizione: ["Dispensa", "Dispensa", "Frigorifero", "Freezer"][indice],
      scadenza: dataLocale(data),
    });
  }
  archivio.aggiungiSpesa({ nome: "Limoni", quantita: "2 pezzi" });
  archivio.aggiungiSpesa({ nome: "Pane integrale", quantita: "1 confezione" });
  console.log(
    "Cucina dimostrativa creata in data/demo. I dati e valori sono esempi, separati dal catalogo e dall’inventario personale.",
  );
} finally {
  archivio.chiudi();
}
