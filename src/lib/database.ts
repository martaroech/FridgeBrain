import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface ConfigurazioneArchivio {
  percorsoDati?: string;
  percorsoCatalogo?: string;
}

/** I due archivi non sono collegati: ogni alimento posseduto conserva una copia dei dati. */
export class DatabaseFridgeBrain {
  readonly personale: DatabaseSync;
  readonly percorsoPersonale: string;
  readonly percorsoCatalogo: string;
  private alimenti: DatabaseSync | null = null;
  private improntaCatalogo = "";

  constructor(configurazione: ConfigurazioneArchivio = {}) {
    const cartella = resolve(
      /* turbopackIgnore: true */ configurazione.percorsoDati ??
        process.env.FRIDGEBRAIN_DATI ??
        "data",
    );
    this.percorsoPersonale = resolve(cartella, "fridgebrain.db");
    this.percorsoCatalogo = resolve(
      /* turbopackIgnore: true */ configurazione.percorsoCatalogo ??
        process.env.FRIDGEBRAIN_CATALOGO ??
        "data/processed/foods.db",
    );
    if (this.percorsoCatalogo === this.percorsoPersonale)
      throw new Error(
        "Il catalogo alimentare e i dati personali devono usare file diversi.",
      );
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
    this.personale.exec("PRAGMA user_version=2");
  }

  catalogo(): DatabaseSync | null {
    try {
      if (!existsSync(this.percorsoCatalogo)) {
        this.chiudiCatalogo();
        return null;
      }
      const stato = statSync(this.percorsoCatalogo);
      const impronta = `${stato.ino}:${stato.size}:${stato.mtimeMs}`;
      if (this.alimenti && this.improntaCatalogo === impronta)
        return this.alimenti;
      this.chiudiCatalogo();
      this.alimenti = new DatabaseSync(this.percorsoCatalogo, {
        readOnly: true,
      });
      this.alimenti
        .prepare(
          "SELECT code, product_name, brands, dati FROM prodotti LIMIT 0",
        )
        .all();
      this.improntaCatalogo = impronta;
      return this.alimenti;
    } catch {
      this.chiudiCatalogo();
      return null;
    }
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

  chiudiCatalogo(): void {
    this.alimenti?.close();
    this.alimenti = null;
    this.improntaCatalogo = "";
  }

  chiudi(): void {
    this.chiudiCatalogo();
    this.personale.close();
  }
}
