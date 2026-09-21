import { createServer } from "node:http";
import { readFileSync } from "node:fs";
/** Avvia OFF simulato e applicazione isolata: nessuna richiesta al servizio reale. */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const radice = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prodotti = JSON.parse(
  readFileSync(resolve(radice, "tests/fixtures/prodotti_sample.json"), "utf8"),
);
const servizioOff = createServer((richiesta, risposta) => {
  const codice = new URL(richiesta.url, "http://localhost").pathname.match(
    /\/product\/(\d+)\.json$/,
  )?.[1];
  const prodotto = prodotti.find((voce) => voce.code === codice);
  risposta.setHeader("Content-Type", "application/json");
  risposta.end(
    JSON.stringify(prodotto ? { status: 1, product: prodotto } : { status: 0 }),
  );
});
await new Promise((pronto) => servizioOff.listen(3101, "127.0.0.1", pronto));
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  { cwd: radice, stdio: "inherit" },
);
process.on("SIGINT", () => server.kill("SIGINT"));
process.on("SIGTERM", () => server.kill("SIGTERM"));
server.on("error", () => {
  console.error("Avvio del server di test non riuscito.");
  process.exit(1);
});
server.on("exit", (codice) => process.exit(codice ?? 0));
