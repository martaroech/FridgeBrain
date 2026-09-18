import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { StatoApplicazione } from "../../src/lib/tipi";

test.use({ serviceWorkers: "block" });

async function vai(pagina: Page, nome: string) {
  await pagina
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: nome, exact: true })
    .click();
}

test.beforeEach(async ({ request: richiesta }) => {
  const stato = (await (
    await richiesta.get("/api/stato")
  ).json()) as StatoApplicazione;
  for (const voce of stato.inventario)
    await richiesta.delete("/api/inventario/" + voce.id);
  for (const voce of stato.spesa)
    await richiesta.delete("/api/spesa/" + voce.id);
});

for (const guasto of ["risposta persa", "aggiornamento fallito"]) {
  test(
    "aggiunta e consumo ripetuti dopo " + guasto + " non duplicano i movimenti",
    async ({ page: pagina, request: richiesta }) => {
      const codice = "2099999999984";
      await richiesta.delete("/api/prodotti/" + codice);
      expect(
        (
          await richiesta.post("/api/prodotti", {
            data: {
              code: codice,
              product_name: "Riso per la prova di rete",
              quantity: "500 g",
            },
          })
        ).ok(),
      ).toBe(true);
      await pagina.goto("/");
      await vai(pagina, "Aggiungi");
      await pagina.getByLabel("Codice a barre", { exact: true }).fill(codice);
      await pagina.getByRole("button", { name: "Cerca prodotto" }).click();
      await expect(
        pagina.getByRole("heading", { name: "Riso per la prova di rete" }),
      ).toBeVisible();
      async function interrompiUnaVolta(percorso: string) {
        let interrotto = false;
        await pagina.route(
          "**" + (guasto === "risposta persa" ? percorso : "/api/stato"),
          async (rotta) => {
            if (interrotto) return rotta.continue();
            interrotto = true;
            if (guasto === "risposta persa") {
              expect((await rotta.fetch()).ok()).toBe(true);
              await rotta.abort("failed");
            } else
              await rotta.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                  errore:
                    "Aggiornamento momentaneamente non disponibile. Riprova.",
                }),
              });
          },
        );
      }
      await interrompiUnaVolta("/api/inventario");
      await pagina
        .getByRole("button", { name: "Aggiungi all’inventario" })
        .click();
      await expect(pagina.getByRole("alert", { name: "Errore" })).toBeVisible();
      await pagina
        .getByRole("button", { name: "Aggiungi all’inventario" })
        .click();
      const riga = pagina.getByRole("button", {
        name: "Apri Riso per la prova di rete",
        exact: true,
      });
      await expect(riga).toBeVisible();
      let stato = (await (
        await richiesta.get("/api/stato")
      ).json()) as StatoApplicazione;
      expect(stato.inventario.length).toBe(1);
      expect(stato.inventario[0].quantita).toBe(500);
      await pagina.unrouteAll();
      await riga.click();
      await pagina
        .getByRole("button", { name: "Segna come consumato" })
        .click();
      await pagina.getByLabel("Quantità consumata (g)").fill("50");
      await interrompiUnaVolta(
        "/api/inventario/" + stato.inventario[0].id + "/consuma",
      );
      await pagina.getByRole("button", { name: "Conferma consumo" }).click();
      await expect(pagina.getByRole("alert", { name: "Errore" })).toBeVisible();
      await pagina.getByRole("button", { name: "Conferma consumo" }).click();
      await expect(pagina.getByRole("dialog")).not.toBeVisible();
      stato = (await (
        await richiesta.get("/api/stato")
      ).json()) as StatoApplicazione;
      expect(stato.inventario[0].quantita).toBe(450);
    },
  );
}

test("la spesa ripetuta dopo una risposta persa non crea doppioni", async ({
  page: pagina,
  request: richiesta,
}) => {
  await pagina.goto("/");
  await vai(pagina, "Spesa");
  await pagina.getByLabel("Cosa manca?").fill("Limoni");
  let interrotto = false;
  await pagina.route("**/api/spesa", async (rotta) => {
    if (interrotto) return rotta.continue();
    interrotto = true;
    expect((await rotta.fetch()).ok()).toBe(true);
    await rotta.abort("failed");
  });
  await pagina.getByRole("button", { name: "Aggiungi alla spesa" }).click();
  await expect(pagina.getByRole("alert", { name: "Errore" })).toBeVisible();
  await pagina.getByRole("button", { name: "Aggiungi alla spesa" }).click();
  await expect(
    pagina.getByRole("checkbox", { name: "Segna acquistato: Limoni" }),
  ).toBeVisible();
  const stato = (await (
    await richiesta.get("/api/stato")
  ).json()) as StatoApplicazione;
  expect(stato.spesa.length).toBe(1);
});

test("accessibilità delle schermate principali e navigazione da tastiera", async ({
  page: pagina,
}) => {
  await pagina.goto("/");
  await expect(pagina.getByRole("heading", { level: 1 })).toBeVisible();
  await pagina.keyboard.press("Tab");
  await expect(
    pagina.getByRole("link", { name: "Vai al contenuto" }),
  ).toBeFocused();
  await pagina.keyboard.press("Enter");
  await expect(pagina.getByRole("main")).toBeFocused();
  for (const nome of ["Home", "Inventario", "Aggiungi", "Ricette", "Spesa"]) {
    await vai(pagina, nome);
    const risultato = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(risultato.violations, nome).toEqual([]);
  }
  await pagina
    .getByRole("button", { name: "Impostazioni", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page: pagina })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const risposta = await pagina.goto("/pagina-inesistente");
  expect(risposta?.status()).toBe(404);
  await expect(
    pagina.getByRole("heading", { name: "Questa pagina non c’è." }),
  ).toBeVisible();
  await pagina.getByRole("link", { name: "Torna alla Home" }).click();
  await expect(pagina.getByRole("heading", { level: 1 })).toContainText(
    "Buono per te",
  );
});
