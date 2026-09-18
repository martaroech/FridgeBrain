/** Prepara il catalogo isolato prima che il server possa aprirlo, anche su Windows. */
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const radice = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const preparazione = spawnSync(
  process.env.FRIDGEBRAIN_PYTHON ?? "python",
  [
    "scripts/costruisci_database_alimenti.py",
    "--campione",
    "--destinazione",
    "data/processed/foods-sample.db",
  ],
  { encoding: "utf8", cwd: radice },
);
if (preparazione.error || preparazione.status !== 0) {
  console.error(
    "Preparazione del catalogo di test non riuscita: " +
      (preparazione.error?.message ?? preparazione.stderr),
  );
  process.exit(1);
}
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
