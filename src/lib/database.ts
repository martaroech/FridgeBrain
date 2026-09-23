import Dexie, { type Table } from "dexie";
import type { EventoStorico, Preferenze, Prodotto, Ricetta, RichiestaRicetta, VoceInventario, VoceSpesa } from "./tipi";
import type { GeneratoreRicette } from "./motore";

export interface ConfigurazioneArchivio {
  nomeDatabase?: string;
  richiediOff?: typeof fetch;
  indirizzoOff?: string;
  attesaOffMs?: number;
  generatore?: GeneratoreRicette;
}
export interface ProdottoSalvato { codice: string; dati: Prodotto; creato_il: string }
export interface ProdottoCache { barcode: string; dati: Prodotto; recuperato_il: string; aggiornato_il: string }
export interface RicettaSalvata { id?: number; dati: Ricetta; richiesta: RichiestaRicetta }
export interface OperazioneSalvata { chiave: string; firma: string; risultato: unknown; creato_il: string }
export const posizioniIniziali = ["Frigorifero", "Freezer", "Dispensa"];

/** Archivio del solo browser corrente. Nessun collegamento a servizi di persistenza. */
export class DatabaseFridgeBrain extends Dexie {
  inventario!: Table<VoceInventario, number>;
  prodotti_personalizzati!: Table<ProdottoSalvato, string>;
  cache_prodotti_off!: Table<ProdottoCache, string>;
  posizioni!: Table<{nome: string}, string>;
  spesa!: Table<VoceSpesa, number>;
  impostazioni!: Table<{chiave: string; valore: Preferenze}, string>;
  ricette!: Table<RicettaSalvata, number>;
  storico!: Table<EventoStorico, number>;
  operazioni!: Table<OperazioneSalvata, string>;

  constructor(configurazione: ConfigurazioneArchivio = {}) {
    super(configurazione.nomeDatabase ?? "fridgebrain");
    this.version(1).stores({
      inventario: "++id, posizione, scadenza",
      prodotti_personalizzati: "codice",
      cache_prodotti_off: "barcode",
      posizioni: "nome",
      spesa: "++id",
      impostazioni: "chiave",
      ricette: "++id",
      storico: "++id",
      operazioni: "chiave",
    });
    this.on("populate", async () => { await this.posizioni.bulkPut(posizioniIniziali.map((nome) => ({ nome }))); });
    this.on("versionchange", () => this.close());
  }
  transazione<T>(operazione: () => Promise<T>): Promise<T> {
    return this.transaction("rw", this.tables, operazione);
  }
  chiudi(): void { this.close(); }
}

export async function richiediPersistenza(): Promise<boolean> {
  try { return typeof navigator !== "undefined" && !!(await navigator.storage?.persist?.()); }
  catch { return false; }
}
