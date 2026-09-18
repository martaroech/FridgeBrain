import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

test("la cucina demo resta separata dai dati personali e una seconda esecuzione non la modifica", (contesto) => {
  const cartella = mkdtempSync(join(tmpdir(), "fridgebrain-demo-"));
  contesto.after(() => rmSync(cartella, { recursive: true, force: true }));
  const catalogo = join(cartella, "catalogo.db");
  const alimenti = new DatabaseSync(catalogo);
  alimenti.exec(
    "CREATE TABLE prodotti(code TEXT PRIMARY KEY,product_name TEXT,brands TEXT,dati TEXT)",
  );
  alimenti.close();
  const catalogoPrima = readFileSync(catalogo);
  const esegui = () =>
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        resolve("scripts/prepara_demo.ts"),
      ],
      {
        cwd: cartella,
        env: {
          ...process.env,
          FRIDGEBRAIN_DATI: join(cartella, "personali"),
          FRIDGEBRAIN_CATALOGO: catalogo,
        },
        encoding: "utf8",
      },
    );
  assert.match(esegui(), /Cucina dimostrativa creata/);
  const percorsoDemo = join(cartella, "data", "demo", "fridgebrain.db");
  const archivio = new DatabaseSync(percorsoDemo, { readOnly: true });
  try {
    assert.equal(
      archivio.prepare("PRAGMA integrity_check").get()?.integrity_check,
      "ok",
    );
    assert.equal(
      archivio
        .prepare("SELECT COUNT(*) AS totale FROM prodotti_personalizzati")
        .get()?.totale,
      4,
    );
    assert.equal(
      archivio.prepare("SELECT COUNT(*) AS totale FROM inventario").get()
        ?.totale,
      4,
    );
    assert.equal(
      archivio.prepare("SELECT COUNT(*) AS totale FROM spesa").get()?.totale,
      2,
    );
    assert.equal(
      archivio.prepare("SELECT SUM(quantita) AS totale FROM inventario").get()
        ?.totale,
      1750,
    );
    assert.deepEqual(
      archivio
        .prepare("SELECT DISTINCT posizione FROM inventario ORDER BY posizione")
        .all()
        .map((voce) => voce.posizione),
      ["Dispensa", "Freezer", "Frigorifero"],
    );
  } finally {
    archivio.close();
  }
  assert.equal(
    existsSync(join(cartella, "personali", "fridgebrain.db")),
    false,
  );
  assert.equal(existsSync(join(cartella, "data", "fridgebrain.db")), false);
  assert.deepEqual(readFileSync(catalogo), catalogoPrima);
  const prima = readFileSync(percorsoDemo);
  assert.match(esegui(), /Nessun dato è stato modificato/);
  assert.deepEqual(readFileSync(percorsoDemo), prima);
});
