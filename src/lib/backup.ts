import type { DatabaseFridgeBrain, ProdottoCache, ProdottoSalvato, RicettaSalvata, OperazioneSalvata } from "./database";
import { posizioniIniziali } from "./database";
import type { VoceInventario, VoceSpesa, EventoStorico, Preferenze } from "./tipi";
import { validaCodice, validaScadenza, validaPreferenze, validaProdotto, validaRichiesta } from "./servizi";
import { normalizzaProdottoOff } from "./open-food-facts";

export interface BackupFridgeBrain {
  applicazione: "FridgeBrain";
  versione: 1;
  esportato_il: string;
  dati: {
    inventario: VoceInventario[];
    prodotti_personalizzati: ProdottoSalvato[];
    cache_prodotti_off: ProdottoCache[];
    posizioni: {nome:string}[];
    spesa: VoceSpesa[];
    impostazioni: {chiave:string; valore:Preferenze}[];
    ricette: RicettaSalvata[];
    storico: EventoStorico[];
    operazioni: OperazioneSalvata[];
  };
}
export const dimensioneMassimaBackup = 25 * 1024 * 1024;
const tabelle = ["inventario","prodotti_personalizzati","cache_prodotti_off","posizioni","spesa","impostazioni","ricette","storico","operazioni"] as const;
function richiedi(valido: unknown): asserts valido { if (!valido) throw new Error("Backup non valido: struttura o dati non compatibili. Nessun dato è stato modificato."); }
function oggetto(valore: unknown): Record<string, unknown> { richiedi(valore && typeof valore === "object" && !Array.isArray(valore)); return valore as Record<string,unknown>; }
function stringa(valore: unknown, massimo=10000): asserts valore is string { richiedi(typeof valore === "string" && valore.length <= massimo); }
function positivo(valore: unknown, intero=false) { richiedi(typeof valore === "number" && Number.isFinite(valore) && valore>0 && (!intero || Number.isSafeInteger(valore))); }
function data(valore: unknown) { stringa(valore,40);richiedi(/^\d{4}-\d{2}-\d{2}T/.test(valore) && Number.isFinite(Date.parse(valore))); }
function prodotto(valore: unknown) {
  const dati=oggetto(valore); const codice=validaCodice(dati.code);
  if(dati.personalizzato===true) validaProdotto(dati); else normalizzaProdottoOff(dati,[codice]);
  if(dati.unita_nutrizionale!==undefined) richiedi(dati.unita_nutrizionale==="g"||dati.unita_nutrizionale==="ml");
}
function valoriNutrizionali(valore:unknown) {
  const dati=oggetto(valore);
  for(const nome of ["calorie","carboidrati","zuccheri","proteine","grassi","fibre","sale"]){ const numero=dati[nome];richiedi(numero===null || (typeof numero==="number" && Number.isFinite(numero) && numero>=0)); }
}

/** Valida tutto prima di aprire la transazione che sostituisce i dati. */
export function validaBackup(valore: unknown): BackupFridgeBrain {
  let contenuto: unknown=valore;
  if(typeof valore==="string") {
    if(new TextEncoder().encode(valore).byteLength>dimensioneMassimaBackup) throw new Error("Il backup supera il limite di 25 MiB.");
    try {contenuto=JSON.parse(valore);} catch {throw new Error("Il file non contiene un backup JSON valido.");}
  }
  const backup=oggetto(contenuto);
  if(backup.applicazione!=="FridgeBrain" || backup.versione!==1) throw new Error("Versione o formato del backup non supportato. Nessun dato è stato modificato.");
  data(backup.esportato_il);
  const dati=oggetto(backup.dati);
  for(const nome of tabelle) {
    const righe=dati[nome]; richiedi(Array.isArray(righe) && righe.length<=100000);
    const chiavi=new Set<unknown>();
    for(const riga of righe) {
      const voce=oggetto(riga);
      const campo=nome==="posizioni"?"nome":nome==="prodotti_personalizzati"?"codice":nome==="cache_prodotti_off"?"barcode":["operazioni","impostazioni"].includes(nome)?"chiave":"id";
      const chiave=voce[campo]; if(campo==="id") positivo(chiave,true); else {stringa(chiave,100);richiedi(chiave.length>0);}
      richiedi(!chiavi.has(chiave));chiavi.add(chiave);
    }
  }
  const copia=structuredClone(backup) as unknown as BackupFridgeBrain;
  const archivi=copia.dati;
  const posizioni=archivi.posizioni.map((voce)=>voce.nome);
  richiedi(posizioniIniziali.every((nome)=>posizioni.includes(nome)) && new Set(posizioni.map((nome)=>nome.toLowerCase())).size===posizioni.length);
  posizioni.forEach((nome)=>{stringa(nome,60);richiedi(nome.trim()===nome && nome.length>0);});
  for(const voce of archivi.prodotti_personalizzati) {prodotto(voce.dati);richiedi(voce.codice===voce.dati.code && voce.dati.personalizzato===true);data(voce.creato_il);}
  for(const voce of archivi.cache_prodotti_off) {prodotto(voce.dati);richiedi(voce.barcode===voce.dati.code && !voce.dati.personalizzato);data(voce.recuperato_il);data(voce.aggiornato_il);}
  for(const voce of archivi.inventario) {
    prodotto(voce.prodotto);positivo(voce.confezioni,true);richiedi(voce.confezioni<=100000);
    richiedi(["g","ml","pz"].includes(voce.unita) && posizioni.includes(voce.posizione));
    if(voce.quantita!==null){positivo(voce.quantita,voce.unita==="pz");richiedi(voce.quantita<=1_000_000);}
    if(voce.scorta_minima!=null){positivo(voce.scorta_minima,voce.unita==="pz");richiedi(voce.quantita!==null && voce.scorta_minima<=1_000_000);}
    richiedi(voce.scadenza===null || validaScadenza(voce.scadenza)===voce.scadenza);data(voce.inserito_il);
  }
  for(const voce of archivi.spesa){stringa(voce.nome,200);richiedi(voce.nome.trim().length>0);stringa(voce.quantita,100);richiedi(typeof voce.completato==="boolean");data(voce.inserito_il);}
  for(const voce of archivi.impostazioni){richiedi(voce.chiave==="preferenze");validaPreferenze(voce.valore);}
  for(const riga of archivi.ricette){
    validaRichiesta(riga.richiesta);const voce=oggetto(riga.dati);stringa(voce.titolo,1000);positivo(voce.minuti);positivo(voce.porzioni,true);
    richiedi(Array.isArray(voce.ingredienti) && voce.ingredienti.length>0 && voce.ingredienti.length<=100);
    for(const elemento of voce.ingredienti){const ingrediente=oggetto(elemento);positivo(ingrediente.inventario_id,true);positivo(ingrediente.quantita);richiedi(["g","ml","pz"].includes(String(ingrediente.unita)));}
    for(const elenco of [voce.passaggi,voce.avvisi]){richiedi(Array.isArray(elenco) && elenco.length<=100);for(const riga of elenco)stringa(riga);}
    richiedi(Array.isArray(voce.passaggi) && voce.passaggi.length>0);
    for(const [codice,nome] of Object.entries(oggetto(voce.nomi_ingredienti))){richiedi(/^[1-9]\d*$/.test(codice));stringa(nome,1000);}
    const nutrizione=oggetto(voce.nutrizione);valoriNutrizionali(nutrizione.totale);valoriNutrizionali(nutrizione.per_porzione);
    richiedi(Array.isArray(nutrizione.ingredienti));for(const riga of nutrizione.ingredienti){const ingrediente=oggetto(riga);positivo(ingrediente.inventario_id,true);stringa(ingrediente.nome,1000);valoriNutrizionali(ingrediente.valori);}
    data(voce.creata_il);if(voce.preparata_il!==null)data(voce.preparata_il);stringa(voce.provider,100);
  }
  for(const voce of archivi.storico){stringa(voce.azione,100);stringa(voce.descrizione);data(voce.creato_il);}
  for(const voce of archivi.operazioni){stringa(voce.firma,100000);data(voce.creato_il);}
  return copia;
}
export async function esportaBackup(database: DatabaseFridgeBrain): Promise<BackupFridgeBrain> {
  return database.transaction("r",database.tables,async()=>({applicazione:"FridgeBrain",versione:1,esportato_il:new Date().toISOString(),dati:{
    inventario:await database.inventario.toArray(),prodotti_personalizzati:await database.prodotti_personalizzati.toArray(),cache_prodotti_off:await database.cache_prodotti_off.toArray(),posizioni:await database.posizioni.toArray(),spesa:await database.spesa.toArray(),impostazioni:await database.impostazioni.toArray(),ricette:await database.ricette.toArray(),storico:await database.storico.toArray(),operazioni:await database.operazioni.toArray(),
  }}));
}
export async function importaBackup(database: DatabaseFridgeBrain,valore:unknown):Promise<void>{
  const backup=validaBackup(valore);
  await database.transazione(async()=>{for(const nome of tabelle){await database.table(nome).clear();await database.table(nome).bulkPut(backup.dati[nome]);}});
}
export async function cancellaDati(database: DatabaseFridgeBrain):Promise<void>{
  await database.transazione(async()=>{for(const tabella of database.tables)await tabella.clear();await database.posizioni.bulkPut(posizioniIniziali.map((nome)=>({nome})));});
}
