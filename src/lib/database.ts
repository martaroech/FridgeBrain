import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface ConfigurazioneArchivio {
  percorsoDati?: string;
  richiediOff?: typeof fetch;
  indirizzoOff?: string;
  attesaOffMs?: number;
}

/** Ogni alimento posseduto conserva uno snapshot indipendente dalla cache OFF. */
export class DatabaseFridgeBrain {
  readonly personale: DatabaseSync;
  readonly percorsoPersonale: string;

  constructor(configurazione: ConfigurazioneArchivio = {}) {
    const cartella = resolve(
      /* turbopackIgnore: true */ configurazione.percorsoDati ??
        process.env.FRIDGEBRAIN_DATI ??
        "data",
    );
    this.percorsoPersonale = resolve(cartella, "fridgebrain.db");
    mkdirSync(dirname(this.percorsoPersonale), { recursive: true });
    this.personale = new DatabaseSync(this.percorsoPersonale);
    this.personale.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS posizioni (nome TEXT PRIMARY KEY);
      INSERT OR IGNORE INTO posizioni(nome) VALUES ('Frigorifero'), ('Freezer'), ('Dispensa');
      CREATE TABLE IF NOT EXISTS prodotti_personalizzati (
        codice TEXT PRIMARY KEY, dati TEXT NOT NULL CHECK(json_valid(dati)), creato_il TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cache_prodotti_off (
        barcode TEXT PRIMARY KEY,
        dati TEXT NOT NULL CHECK(json_valid(dati)),
        recuperato_il TEXT NOT NULL,
        aggiornato_il TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prodotto TEXT NOT NULL CHECK(json_valid(prodotto)),
        confezioni INTEGER NOT NULL CHECK(confezioni > 0),
        quantita REAL CHECK(quantita IS NULL OR quantita > 0),
        unita TEXT NOT NULL CHECK(unita IN ('g','ml','pz')),
        posizione TEXT NOT NULL REFERENCES posizioni(nome) ON UPDATE CASCADE,
        scadenza TEXT, inserito_il TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS indice_inventario_scadenza ON inventario(scadenza);
      CREATE INDEX IF NOT EXISTS indice_inventario_posizione ON inventario(posizione);
      CREATE TABLE IF NOT EXISTS spesa (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, quantita TEXT NOT NULL,
        completato INTEGER NOT NULL DEFAULT 0 CHECK(completato IN (0,1)), inserito_il TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS impostazioni (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL CHECK(json_valid(valore)));
      CREATE TABLE IF NOT EXISTS ricette (
        id INTEGER PRIMARY KEY AUTOINCREMENT, dati TEXT NOT NULL CHECK(json_valid(dati)),
        richiesta TEXT NOT NULL CHECK(json_valid(richiesta)), creata_il TEXT NOT NULL, preparata_il TEXT
      );
      CREATE TABLE IF NOT EXISTS storico (
        id INTEGER PRIMARY KEY AUTOINCREMENT, azione TEXT NOT NULL, descrizione TEXT NOT NULL, creato_il TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS indice_storico_data ON storico(creato_il DESC);
      CREATE TABLE IF NOT EXISTS operazioni (
        chiave TEXT PRIMARY KEY, firma TEXT NOT NULL, creato_il TEXT NOT NULL
      );
    `);
    const colonne = this.personale
      .prepare("PRAGMA table_info(inventario)")
      .all();
    if (!colonne.some((colonna) => colonna.name === "scorta_minima")) {
      this.personale.exec(
        "ALTER TABLE inventario ADD COLUMN scorta_minima REAL CHECK(scorta_minima IS NULL OR scorta_minima > 0)",
      );
    }
    this.personale.exec("PRAGMA user_version=3");
  }

  transazione<T>(operazione: () => T): T {
    this.personale.exec("BEGIN IMMEDIATE");
    try {
      const risultato = operazione();
      this.personale.exec("COMMIT");
      return risultato;
    } catch (errore) {
      this.personale.exec("ROLLBACK");
      throw errore;
    }
  }

  chiudi(): void {
    this.personale.close();
  }
}
