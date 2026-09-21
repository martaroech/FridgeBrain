import test from "node:test";
import assert from "node:assert/strict";
import { gestisciRichiesta } from "../src/lib/api";
import { verificaAccesso } from "../src/lib/autenticazione";
import { preparaArchivio } from "./supporto-archivio";

process.env.FRIDGEBRAIN_UTENTE = "prova";
process.env.FRIDGEBRAIN_PASSWORD = "password-solo-test-molto-lunga";
const autorizzazione =
  "Basic " +
  Buffer.from("prova:password-solo-test-molto-lunga").toString("base64");

test("letture e scritture personali richiedono autenticazione senza alterare i dati", async (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  for (const percorso of [
    "stato",
    "inventario",
    "prodotti",
    "spesa",
    "preferenze",
    "posizioni",
    "ricette",
    "storico",
  ]) {
    for (const metodo of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const risposta = await gestisciRichiesta(
        new Request(`http://localhost/api/${percorso}`, { method: metodo }),
        archivio,
      );
      assert.equal(risposta.status, 401);
      assert.equal(risposta.headers.get("cache-control"), "no-store");
      assert.match(
        risposta.headers.get("www-authenticate")!,
        /Basic realm="FridgeBrain"/,
      );
    }
  }
  assert.deepEqual(archivio.inventario(), []);
  assert.deepEqual(archivio.spesa(), []);
  const risposta = await gestisciRichiesta(
    new Request("http://localhost/api/stato", {
      headers: { authorization: autorizzazione },
    }),
    archivio,
  );
  assert.equal(risposta.status, 200);
});

test("credenziali errate e intestazioni malformate non autorizzano l'accesso", () => {
  for (const authorization of [
    "",
    "Bearer token",
    "Basic ###",
    "Basic " + Buffer.from("prova:errata").toString("base64"),
    "Basic " +
      Buffer.from("intruso:password-solo-test-molto-lunga").toString("base64"),
  ])
    assert.equal(
      verificaAccesso(
        new Request("http://localhost/", { headers: { authorization } }),
      )?.status,
      401,
    );
  assert.equal(
    verificaAccesso(
      new Request("http://localhost/", {
        headers: { authorization: autorizzazione },
      }),
    ),
    null,
  );
});

test("configurazione assente o password corta blocca l'accesso anche con credenziali corrispondenti", () => {
  const precedente = process.env.FRIDGEBRAIN_PASSWORD;
  try {
    for (const password of ["", "breve"]) {
      process.env.FRIDGEBRAIN_PASSWORD = password;
      assert.equal(
        verificaAccesso(new Request("http://localhost/"))?.status,
        503,
      );
    }
  } finally {
    process.env.FRIDGEBRAIN_PASSWORD = precedente;
  }
});

test("la salute pubblica non espone dati né apre il database", async () => {
  const risposta = await gestisciRichiesta(
    new Request("http://localhost/api/salute"),
  );
  assert.deepEqual(await risposta.json(), { ok: true });
});
