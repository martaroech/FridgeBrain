import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import type { StatoApplicazione, Prodotto } from "../../src/lib/tipi";

const prodottiSample = JSON.parse(
  readFileSync("tests/fixtures/prodotti_sample.json", "utf8"),
) as Prodotto[];
const campione = prodottiSample[0];
const preferenze = {
  regime: "onnivoro",
  allergeni: [],
  esclusioni: [],
  limiti: [],
  priorita_scadenza: true,
};
function dataTra(giorni: number) {
  const data = new Date();
  data.setDate(data.getDate() + giorni);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
async function vai(pagina: Page, nome: string) {
  await pagina
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: nome, exact: true })
    .click();
}
async function verificaLarghezza(pagina: Page) {
  expect(
    await pagina.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
async function cucinaDiProva(richiesta: APIRequestContext) {
  const codice = "2099999999908";
  await richiesta.delete(`/api/prodotti/${codice}`);
  const prodotto = await richiesta.post("/api/prodotti", {
    data: {
      code: codice,
      product_name: "Ceci lessati",
      brands: "Cucina di prova",
      quantity: "400 g",
      unita_nutrizionale: "g",
      ingredients_text: "Ceci, acqua",
      labels_tags: ["en:vegan", "en:gluten-free"],
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
  });
  expect(prodotto.ok()).toBeTruthy();
  const voce = await richiesta.post("/api/inventario", {
    data: {
      codice,
      confezioni: 1,
      quantita: 400,
      unita: "g",
      posizione: "Dispensa",
      scadenza: dataTra(2),
    },
  });
  expect(voce.ok()).toBeTruthy();
  return voce.json();
}

test.beforeEach(async ({ request: richiesta }) => {
  const stato = (await (
    await richiesta.get("/api/stato")
  ).json()) as StatoApplicazione;
  for (const voce of stato.inventario)
    expect(
      (await richiesta.delete(`/api/inventario/${voce.id}`)).ok(),
    ).toBeTruthy();
  for (const voce of stato.spesa)
    expect((await richiesta.delete(`/api/spesa/${voce.id}`)).ok()).toBeTruthy();
  for (const voce of stato.ricette)
    expect(
      (await richiesta.delete(`/api/ricette/${voce.id}`)).ok(),
    ).toBeTruthy();
  expect(
    (await richiesta.put("/api/preferenze", { data: preferenze })).ok(),
  ).toBeTruthy();
});

test("A e C: barcode reale, aggiunta in frigorifero e scadenza nella Home", async ({
  page: pagina,
}, prova) => {
  const errori: string[] = [];
  pagina.on("pageerror", (errore) => errori.push(errore.message));
  await pagina.goto("/");
  await expect(
    pagina.getByText("Il frigorifero è ancora vuoto."),
  ).toBeVisible();
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-vuoto.png`,
    fullPage: true,
  });
  await vai(pagina, "Aggiungi");
  await pagina
    .getByLabel("Codice a barre", { exact: true })
    .fill(campione.code);
  await pagina
    .getByRole("button", { name: "Cerca prodotto", exact: true })
    .click();
  await expect(
    pagina.getByRole("heading", { name: campione.product_name, exact: true }),
  ).toBeVisible();
  await pagina
    .getByText("Ingredienti, allergeni e nutrienti", { exact: true })
    .click();
  await expect(
    pagina.getByText(campione.ingredients_text!, { exact: true }),
  ).toBeVisible();
  await pagina.getByLabel("Confezioni", { exact: true }).fill("2");
  await pagina.getByLabel("Quantità totale residua").fill("500");
  await pagina
    .getByRole("combobox", { name: "Posizione", exact: true })
    .selectOption("Frigorifero");
  await pagina.getByLabel("Data di scadenza").fill(dataTra(0));
  await pagina.getByRole("button", { name: "Aggiungi all’inventario" }).click();
  await expect(
    pagina.getByRole("button", {
      name: `Apri ${campione.product_name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(pagina.getByText("Scade oggi", { exact: true })).toBeVisible();
  await verificaLarghezza(pagina);
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-inventario.png`,
    fullPage: true,
  });
  await vai(pagina, "Home");
  await expect(
    pagina.getByRole("button", {
      name: `Apri ${campione.product_name}`,
      exact: true,
    }),
  ).toBeVisible();
  await verificaLarghezza(pagina);
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-home.png`,
    fullPage: true,
  });
  expect(errori).toEqual([]);
});

test("B: prodotto sconosciuto, dati manuali, nuova scansione, modifica e consumo", async ({
  page: pagina,
  request: richiesta,
}, prova) => {
  const codice = "2099999999915";
  await richiesta.delete(`/api/prodotti/${codice}`);
  await pagina.goto("/");
  await vai(pagina, "Aggiungi");
  await pagina.getByLabel("Codice a barre", { exact: true }).fill(codice);
  await pagina
    .getByRole("button", { name: "Cerca prodotto", exact: true })
    .click();
  await expect(
    pagina
      .getByRole("alert", { name: "Errore" })
      .filter({ hasText: "Prodotto non trovato" }),
  ).toBeVisible();
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-errore.png`,
    fullPage: true,
  });
  await pagina.getByRole("button", { name: "Inserisci manualmente" }).click();
  await pagina
    .getByLabel("Nome prodotto", { exact: true })
    .fill("Passata di casa");
  await pagina.getByLabel("Marca", { exact: true }).fill("La mia cucina");
  await pagina
    .getByText("Ingredienti, allergeni e valori nutrizionali (opzionali)", {
      exact: true,
    })
    .click();
  await pagina.getByLabel("Ingredienti", { exact: true }).fill("Pomodori");
  await pagina.getByLabel("Calorie (kcal)").fill("30");
  await pagina.getByLabel("Proteine (g)").fill("1.3");
  await pagina.getByLabel("Quantità totale residua").fill("500");
  await pagina.getByLabel("Data di scadenza").fill(dataTra(2));
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-aggiunta.png`,
    fullPage: true,
  });
  await pagina.getByRole("button", { name: "Aggiungi all’inventario" }).click();
  await expect(
    pagina.getByRole("button", { name: "Apri Passata di casa", exact: true }),
  ).toBeVisible();
  await vai(pagina, "Aggiungi");
  await pagina.getByLabel("Codice a barre", { exact: true }).fill(codice);
  await pagina
    .getByRole("button", { name: "Cerca prodotto", exact: true })
    .click();
  await expect(
    pagina.getByRole("heading", { name: "Passata di casa", exact: true }),
  ).toBeVisible();
  await vai(pagina, "Inventario");
  await pagina.getByLabel("Cerca per nome o marca").fill("La mia cucina");
  await pagina
    .getByRole("button", { name: "Apri Passata di casa", exact: true })
    .click();
  const dialogo = pagina.getByRole("dialog");
  await dialogo
    .getByRole("combobox", { name: "Posizione", exact: true })
    .selectOption("Freezer");
  await dialogo.getByLabel("Quantità totale residua").fill("350");
  await dialogo
    .getByText("Avviso scorta minima (opzionale)", { exact: true })
    .click();
  await dialogo.getByLabel("Scorta minima", { exact: true }).fill("300");
  await dialogo.getByRole("button", { name: "Salva modifiche" }).click();
  await pagina
    .getByRole("button", { name: "Apri Passata di casa", exact: true })
    .click();
  await expect(
    dialogo.getByRole("combobox", { name: "Posizione", exact: true }),
  ).toHaveValue("Freezer");
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-dettaglio.png`,
    fullPage: true,
  });
  await dialogo.getByRole("button", { name: "Segna come consumato" }).click();
  await dialogo.getByLabel("Quantità consumata (g)").fill("50");
  await dialogo.getByRole("button", { name: "Conferma consumo" }).click();
  await expect(
    pagina.getByRole("button", { name: "Apri Passata di casa", exact: true }),
  ).toContainText("300 g");
  await expect(
    pagina.getByRole("button", { name: "Apri Passata di casa", exact: true }),
  ).toContainText("In esaurimento");
  await vai(pagina, "Home");
  await pagina
    .getByRole("button", {
      name: "1 prodotto in esaurimento. Controlla le scorte.",
    })
    .click();
  await expect(
    pagina.getByRole("combobox", { name: "Da controllare" }),
  ).toHaveValue("scorte");
  await pagina
    .getByRole("button", { name: "Apri Passata di casa", exact: true })
    .click();
  await dialogo.getByRole("button", { name: "Elimina", exact: true }).click();
  await dialogo.getByRole("button", { name: "Conferma eliminazione" }).click();
  await expect(
    pagina.getByText("Il frigorifero è ancora vuoto."),
  ).toBeVisible();
  await verificaLarghezza(pagina);
});

test("D ed E: ricetta verificata, nutrienti reali e consumo confermato", async ({
  page: pagina,
  request: richiesta,
}, prova) => {
  const voce = await cucinaDiProva(richiesta);
  await pagina.goto("/");
  await vai(pagina, "Ricette");
  await pagina
    .getByText("Limiti nutrizionali per porzione", { exact: true })
    .click();
  await pagina.getByLabel("Calorie: massimo per porzione").fill("200");
  await pagina.getByLabel("Proteine: minimo per porzione").fill("5");
  await pagina
    .getByRole("button", { name: "Trova una ricetta", exact: true })
    .click();
  await expect(
    pagina.getByRole("heading", { name: "Nutrienti per porzione" }),
  ).toBeVisible();
  await expect(
    pagina
      .locator(".nutrizione-ricetta > .nutrizione")
      .getByText("120", { exact: false }),
  ).toBeVisible();
  await expect(pagina.locator(".elenco-ingredienti").first()).toContainText(
    "200 g",
  );
  await pagina
    .getByText("Totale della ricetta e singoli ingredienti", { exact: true })
    .click();
  await verificaLarghezza(pagina);
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-ricetta.png`,
    fullPage: true,
  });
  await pagina
    .getByRole("button", { name: "Ho cucinato questa ricetta" })
    .click();
  await expect(pagina.getByRole("dialog")).toContainText("200 g");
  await pagina
    .getByRole("dialog")
    .getByRole("button", { name: "Conferma consumo" })
    .click();
  await expect(
    pagina.getByRole("button", { name: "Hai già preparato questa ricetta" }),
  ).toBeDisabled();
  const stato = (await (
    await richiesta.get("/api/stato")
  ).json()) as StatoApplicazione;
  expect(
    stato.inventario.find((elemento) => elemento.id === voce.id)?.quantita,
  ).toBe(200);
  await vai(pagina, "Inventario");
  await expect(
    pagina.getByRole("button", { name: "Apri Ceci lessati", exact: true }),
  ).toContainText("200 g");
});

test("lista della spesa, preferenze persistenti e storico", async ({
  page: pagina,
}, prova) => {
  await pagina.goto("/");
  await vai(pagina, "Spesa");
  await pagina.getByLabel("Cosa manca?").fill("Pomodori");
  await pagina.getByLabel("Quantità", { exact: true }).fill("500 g");
  await pagina.getByRole("button", { name: "Aggiungi alla spesa" }).click();
  await pagina
    .getByRole("checkbox", { name: "Segna acquistato: Pomodori" })
    .click();
  await expect(
    pagina.getByRole("checkbox", { name: "Da comprare: Pomodori" }),
  ).toBeChecked();
  await pagina.getByRole("button", { name: "Modifica Pomodori" }).click();
  await pagina
    .getByRole("dialog")
    .getByLabel("Quantità", { exact: true })
    .fill("1 kg");
  await pagina.getByRole("button", { name: "Salva elemento" }).click();
  await expect(pagina.getByText("1 kg", { exact: true })).toBeVisible();
  await verificaLarghezza(pagina);
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-spesa.png`,
    fullPage: true,
  });
  await pagina
    .getByRole("button", { name: "Impostazioni", exact: true })
    .click();
  await pagina
    .getByRole("combobox", { name: "Stile alimentare", exact: true })
    .selectOption("vegetariano");
  await pagina
    .getByText("Allergeni e ingredienti da evitare", { exact: true })
    .click();
  await pagina.getByRole("checkbox", { name: "Glutine", exact: true }).check();
  await pagina.getByRole("button", { name: "Salva preferenze" }).click();
  await expect(pagina.getByRole("status")).toContainText("Preferenze salvate");
  await pagina.reload();
  await expect(
    pagina.getByRole("combobox", { name: "Stile alimentare", exact: true }),
  ).toHaveValue("vegetariano");
  await pagina
    .getByText("Allergeni e ingredienti da evitare", { exact: true })
    .click();
  await expect(
    pagina.getByRole("checkbox", { name: "Glutine", exact: true }),
  ).toBeChecked();
  await verificaLarghezza(pagina);
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-impostazioni.png`,
    fullPage: true,
  });
});

test("scanner con permesso negato e inserimento manuale sempre disponibile", async ({
  page: pagina,
}, prova) => {
  await pagina.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("Permesso negato", "NotAllowedError")),
    });
  });
  await pagina.goto("/");
  await vai(pagina, "Aggiungi");
  await expect(
    pagina
      .getByRole("alert", { name: "Errore" })
      .filter({ hasText: "Permesso fotocamera negato" }),
  ).toBeVisible();
  await expect(
    pagina.getByLabel("Codice a barre", { exact: true }),
  ).toBeVisible();
  await verificaLarghezza(pagina);
  await pagina.screenshot({
    path: `data/verifica-visuale/verifica-${prova.project.name}-scanner.png`,
    fullPage: true,
  });
});

test("PWA installabile e copia leggibile quando il server domestico è irraggiungibile", async ({
  page: pagina,
  context: contesto,
  request: richiesta,
}) => {
  await cucinaDiProva(richiesta);
  await pagina.goto("/");
  await pagina.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(
    pagina.getByRole("button", { name: "Apri Ceci lessati", exact: true }),
  ).toBeVisible();
  const manifest = await (await richiesta.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  expect((await richiesta.get(manifest.icons[0].src)).ok()).toBeTruthy();
  const diagnostica = await contesto.newCDPSession(pagina);
  const installabilita = await diagnostica.send("Page.getInstallabilityErrors");
  expect(installabilita.installabilityErrors).toEqual([]);
  await diagnostica.detach();
  await expect
    .poll(() =>
      pagina.evaluate(async () => Boolean(await caches.match("/api/stato"))),
    )
    .toBe(true);
  await contesto.setOffline(true);
  await pagina.reload();
  await expect(pagina.getByText(/Stai consultando una copia/)).toBeVisible();
  await vai(pagina, "Inventario");
  await expect(
    pagina.getByRole("button", { name: "Apri Ceci lessati", exact: true }),
  ).toBeVisible();
  await vai(pagina, "Spesa");
  await pagina.getByLabel("Cosa manca?").fill("Carote");
  await pagina.getByRole("button", { name: "Aggiungi alla spesa" }).click();
  await expect(pagina.getByRole("alert", { name: "Errore" })).toContainText(
    "Stai consultando una copia offline",
  );
  await contesto.setOffline(false);
  await pagina.getByRole("button", { name: "Aggiorna connessione" }).click();
  await expect(
    pagina.getByText("Server di casa non raggiungibile.", { exact: true }),
  ).not.toBeVisible();
  await pagina.getByRole("button", { name: "Aggiungi alla spesa" }).click();
  await expect(
    pagina.getByRole("checkbox", { name: "Segna acquistato: Carote" }),
  ).toBeVisible();
});

test("fotocamera: decodifica EAN reale, evita doppie letture e riparte per un altro prodotto", async ({
  page: pagina,
}) => {
  // Il flusso video contiene barre reali: viene eseguito il decoder ZXing dell'app.
  const dispari = [
    "0001101",
    "0011001",
    "0010011",
    "0111101",
    "0100011",
    "0110001",
    "0101111",
    "0111011",
    "0110111",
    "0001011",
  ];
  const pari = [
    "0100111",
    "0110011",
    "0011011",
    "0100001",
    "0011101",
    "0111001",
    "0000101",
    "0010001",
    "0001001",
    "0010111",
  ];
  const parita = [
    "LLLLLL",
    "LLGLGG",
    "LLGGLG",
    "LLGGGL",
    "LGLLGG",
    "LGGLLG",
    "LGGGLL",
    "LGLGLG",
    "LGLGGL",
    "LGGLGL",
  ][Number(campione.code[0])];
  let barre = "101";
  for (let indice = 1; indice <= 6; indice++)
    barre += (parita[indice - 1] === "L" ? dispari : pari)[
      Number(campione.code[indice])
    ];
  barre += "01010";
  for (let indice = 7; indice <= 12; indice++)
    barre += [...dispari[Number(campione.code[indice])]]
      .map((cifra) => (cifra === "0" ? "1" : "0"))
      .join("");
  barre += "101";
  await pagina.addInitScript((sequenza) => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const tela = document.createElement("canvas");
        tela.width = 800;
        tela.height = 480;
        const contesto = tela.getContext("2d")!;
        const disegna = () => {
          contesto.fillStyle = "white";
          contesto.fillRect(0, 0, 800, 480);
          contesto.fillStyle = "black";
          [...sequenza].forEach((cifra, indice) => {
            if (cifra === "1") contesto.fillRect(160 + indice * 5, 100, 5, 280);
          });
        };
        disegna();
        const flusso = tela.captureStream(15);
        const temporizzatore = window.setInterval(disegna, 60);
        const traccia = flusso.getVideoTracks()[0];
        const ferma = traccia.stop.bind(traccia);
        traccia.stop = () => {
          clearInterval(temporizzatore);
          ferma();
        };
        (window as unknown as { flussoProva: MediaStream }).flussoProva =
          flusso;
        return flusso;
      },
    });
  }, barre);
  let ricerche = 0;
  pagina.on("request", (richiesta) => {
    if (richiesta.url().includes("/api/prodotti?codice=")) ricerche++;
  });
  await pagina.goto("/");
  await vai(pagina, "Aggiungi");
  await expect(
    pagina.getByRole("heading", { name: campione.product_name, exact: true }),
  ).toBeVisible();
  expect(ricerche).toBe(1);
  expect(
    await pagina.evaluate(() =>
      (window as unknown as { flussoProva: MediaStream }).flussoProva
        .getTracks()
        .every((traccia) => traccia.readyState === "ended"),
    ),
  ).toBe(true);
  await pagina.getByRole("button", { name: "Cambia prodotto" }).click();
  await pagina.getByRole("button", { name: "Apri fotocamera" }).click();
  await expect(
    pagina.getByRole("heading", { name: campione.product_name, exact: true }),
  ).toBeVisible();
  expect(ricerche).toBe(2);
});

test("tutti i flussi locali bloccano qualsiasi richiesta Internet", async ({
  page: pagina,
  context: contesto,
}) => {
  const esterne: string[] = [];
  await contesto.route("**/*", (percorso) => {
    const indirizzo = new URL(percorso.request().url());
    if (!["127.0.0.1", "localhost"].includes(indirizzo.hostname)) {
      esterne.push(indirizzo.href);
      return percorso.abort();
    }
    return percorso.continue();
  });
  await pagina.goto("/");
  for (const nome of ["Inventario", "Spesa", "Ricette", "Aggiungi", "Home"]) {
    await vai(pagina, nome);
    await verificaLarghezza(pagina);
  }
  expect(esterne).toEqual([]);
});
