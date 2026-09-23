"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Dialogo, Errore } from "./comuni";
import { archivioApplicazione } from "@/lib/servizi";
import { richiediPersistenza } from "@/lib/database";
import { esportaBackup, importaBackup, validaBackup, cancellaDati, dimensioneMassimaBackup, type BackupFridgeBrain } from "@/lib/backup";

export function GestioneBackup({aggiorna,notifica}:{aggiorna:()=>Promise<void>;notifica:(testo:string)=>void}) {
  const [errore,impostaErrore]=useState("");
  const [impegnato,impostaImpegnato]=useState(false);
  const [backup,impostaBackup]=useState<BackupFridgeBrain|null>(null);
  const [cancellazione,impostaCancellazione]=useState(0);
  const [conferma,impostaConferma]=useState("");
  const file=useRef<HTMLInputElement>(null);
  async function esegui(operazione:()=>Promise<void>) {impostaErrore("");impostaImpegnato(true);try {await operazione();}catch(errore){impostaErrore(errore instanceof Error?errore.message:"Operazione non riuscita. I dati precedenti sono conservati.");}finally{impostaImpegnato(false);}}
  async function esporta(){await esegui(async()=>{
    const backup=await esportaBackup(archivioApplicazione().database);const testo=JSON.stringify(backup,null,2);
    if(new TextEncoder().encode(testo).byteLength>dimensioneMassimaBackup)throw new Error("Il backup supera 25 MiB. Contatta il manutentore prima di trasferire i dati.");
    const indirizzo=URL.createObjectURL(new Blob([testo],{type:"application/json"}));const collegamento=document.createElement("a");collegamento.href=indirizzo;collegamento.download=`fridgebrain-${new Date().toISOString().slice(0,10)}.json`;collegamento.click();setTimeout(()=>URL.revokeObjectURL(indirizzo),1000);notifica("Backup esportato. Conservane una copia al sicuro.");
  });}
  async function leggi(scelto?:File){if(!scelto)return;await esegui(async()=>{if(scelto.size>dimensioneMassimaBackup)throw new Error("Il backup supera il limite di 25 MiB.");impostaBackup(validaBackup(await scelto.text()));});}
  return <section className="dettagli">
    <h3>Backup e dati locali</h3>
    <p>I dati restano in questo browser. Altri dispositivi non sono sincronizzati. Esporta un backup prima di cancellare i dati del sito o cambiare dispositivo.</p>
    <div className="azioni-dialogo">
      <button className="pulsante secondario" disabled={impegnato} onClick={esporta}><Download size={18}/>Esporta backup</button>
      <button className="pulsante secondario" disabled={impegnato} onClick={()=>file.current?.click()}><Upload size={18}/>Importa backup</button>
    </div>
    <input ref={file} type="file" accept="application/json,.json" aria-label="File di backup" hidden onChange={(evento)=>{void leggi(evento.target.files?.[0]);evento.target.value="";}}/>
    <p><button className="pulsante secondario" disabled={impegnato} onClick={()=>void esegui(async()=>{const concessa=await richiediPersistenza();notifica(concessa?"Memorizzazione persistente concessa.":"Il browser non ha concesso la persistenza. Continua a esportare backup regolari.");})}>Proteggi la memorizzazione</button></p>
    <button className="pulsante pericolo" disabled={impegnato} onClick={()=>{impostaCancellazione(1);impostaConferma("");}}>Cancella tutti i dati locali</button>
    {!backup && !cancellazione && <Errore testo={errore}/>}
    {backup && <Dialogo titolo="Importare questo backup?" chiudi={()=>{if(!impegnato)impostaBackup(null);}}>
      <p>Backup del {new Date(backup.esportato_il).toLocaleString("it-IT")}. Sostituirà tutti i dati di questo browser.</p>
      <ul>{Object.entries(backup.dati).map(([nome,righe])=><li key={nome}>{nome.replaceAll("_"," ")}: {righe.length}</li>)}</ul>
      <p>Esporta prima i dati attuali se vuoi conservarli. Gli altri dispositivi non verranno modificati.</p><Errore testo={errore}/>
      <div className="azioni-dialogo"><button className="pulsante secondario" disabled={impegnato} onClick={()=>impostaBackup(null)}>Annulla</button><button className="pulsante primario" disabled={impegnato} onClick={()=>void esegui(async()=>{await importaBackup(archivioApplicazione().database,backup);impostaBackup(null);await aggiorna();notifica("Backup importato.");})}>Conferma e sostituisci i dati</button></div>
    </Dialogo>}
    {!!cancellazione && <Dialogo titolo={cancellazione===1?"Cancellare i dati locali?":"Conferma definitiva"} chiudi={()=>{if(!impegnato)impostaCancellazione(0);}}>
      <p>Inventario, prodotti, cache, spesa, preferenze, ricette e storico verranno eliminati da questo browser. Senza un backup non potrai recuperarli.</p>
      {cancellazione===2 && <label>Scrivi CANCELLA per confermare<input value={conferma} onChange={(evento)=>impostaConferma(evento.target.value)} autoComplete="off"/></label>}
      <Errore testo={errore}/><div className="azioni-dialogo"><button className="pulsante secondario" disabled={impegnato} onClick={()=>impostaCancellazione(0)}>Annulla</button>{cancellazione===1?<button className="pulsante pericolo" onClick={()=>impostaCancellazione(2)}>Continua con la cancellazione</button>:<button className="pulsante pericolo" disabled={impegnato||conferma!=="CANCELLA"} onClick={()=>void esegui(async()=>{await cancellaDati(archivioApplicazione().database);impostaCancellazione(0);await aggiorna();notifica("Dati locali cancellati.");})}>Elimina definitivamente</button>}</div>
    </Dialogo>}
  </section>;
}
