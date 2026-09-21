import { test, expect } from "@playwright/test";

test("pagina e API personali rifiutano accessi anonimi e password errate", async ({
  browser,
}) => {
  for (const credenziali of [
    undefined,
    { username: "prova", password: "errata" },
  ]) {
    const contesto = await browser.newContext({ httpCredentials: credenziali });
    try {
      for (const percorso of [
        "/",
        "/api/stato",
        "/api/inventario",
        "/api/ricette",
        "/api/prodotti?codice=12345678",
      ]) {
        const risposta = await contesto.request.get(
          `http://127.0.0.1:3100${percorso}`,
        );
        expect(risposta.status()).toBe(401);
        expect(risposta.headers()["www-authenticate"]).toContain(
          'realm="FridgeBrain"',
        );
      }
      expect(
        (
          await contesto.request.post("http://127.0.0.1:3100/api/spesa", {
            data: { nome: "Intruso" },
          })
        ).status(),
      ).toBe(401);
      expect(
        await (
          await contesto.request.get("http://127.0.0.1:3100/api/salute")
        ).json(),
      ).toEqual({ ok: true });
    } finally {
      await contesto.close();
    }
  }
});

test("l'aggiornamento PWA elimina le vecchie copie personali e non memorizza le API", async ({
  page: pagina,
}) => {
  await pagina.goto("/manifest.webmanifest");
  await pagina.evaluate(async () => {
    const archivio = await caches.open("fridgebrain-v1-2-dati");
    await archivio.put(
      "/api/stato",
      Response.json({ inventario: [{ nome: "Dato vecchio" }] }),
    );
  });
  await pagina.goto("/");
  await pagina.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      pagina.evaluate(async () =>
        (await caches.keys()).includes("fridgebrain-v1-2-dati"),
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      pagina.evaluate(async () => Boolean(await caches.match("/api/stato"))),
    )
    .toBe(false);
  expect(
    await pagina.evaluate(async () => Boolean(await caches.match("/"))),
  ).toBe(false);
});
