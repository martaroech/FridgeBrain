import test from "node:test";
import assert from "node:assert/strict";
import {preparaArchivio,prodottoProva} from "./supporto-archivio";
import {cancellaDati,esportaBackup,importaBackup,validaBackup} from "../src/lib/backup";
import {ArchivioFridgeBrain} from "../src/lib/servizi";
import {GeneratoreRicetteSimulato,preferenzeIniziali} from "../src/lib/motore";

async function preparaDati(contesto: Parameters<typeof preparaArchivio>[0]) {
  const {archivio}=await preparaArchivio(contesto,true,{generatore:new GeneratoreRicetteSimulato()});
  await archivio.salvaProdotto(prodottoProva);
  await archivio.aggiungiInventario({codice:prodottoProva.code,quantita:400,unita:"g",scadenza:"2099-01-01"},"aggiunta");
  await archivio.aggiungiSpesa({nome:"Limoni",quantita:"2 pz"},"spesa");
  await archivio.salvaPreferenze(preferenzeIniziali);
  const ricetta=await archivio.generaRicetta({...preferenzeIniziali,persone:2,tempo_massimo:30});
  await archivio.preparaRicetta(ricetta.id);
  return archivio;
}

test("backup JSON versionato conserva tutte le tabelle, le ricette e le ricevute",async(contesto)=>{
  const archivio=await preparaDati(contesto);
  const backup=validaBackup(JSON.stringify(await esportaBackup(archivio.database)));
  for(const righe of Object.values(backup.dati))assert.ok(righe.length>0);
  await cancellaDati(archivio.database);
  assert.equal((await archivio.inventario()).length,0);
  assert.deepEqual(await archivio.posizioni(),["Frigorifero","Freezer","Dispensa"]);
  await importaBackup(archivio.database,JSON.stringify(backup));
  assert.deepEqual((await esportaBackup(archivio.database)).dati,backup.dati);
  const ricetta=(await archivio.ricette())[0];
  await archivio.preparaRicetta(ricetta.id);
  assert.deepEqual((await esportaBackup(archivio.database)).dati,backup.dati);
  await archivio.aggiungiSpesa({nome:"Limoni",quantita:"2 pz"},"spesa");
  assert.equal((await archivio.spesa()).length,1);
});

test("backup incompatibili, riferimenti errati e dati malformati non modificano nulla",async(contesto)=>{
  const archivio=await preparaDati(contesto);
  const backup=await esportaBackup(archivio.database);
  const invalide=[
    (copia:any)=>copia.versione=2,
    (copia:any)=>delete copia.dati.storico,
    (copia:any)=>copia.dati.inventario.push(copia.dati.inventario[0]),
    (copia:any)=>copia.dati.inventario[0].quantita=-1,
    (copia:any)=>copia.dati.inventario[0].posizione="Non esiste",
    (copia:any)=>copia.dati.cache_prodotti_off[0].dati.code="altro",
    (copia:any)=>copia.dati.ricette[0].dati.nutrizione.per_porzione.calorie="infinito",
    (copia:any)=>copia.dati.ricette[0].dati.passaggi=null,
  ];
  for(const modifica of invalide){
    const copia=structuredClone(backup);modifica(copia);
    await assert.rejects(importaBackup(archivio.database,copia));
    assert.deepEqual((await esportaBackup(archivio.database)).dati,backup.dati);
  }
  await assert.rejects(importaBackup(archivio.database,"{non valido"),/JSON valido/);
});

test("errore di scrittura durante importazione ripristina anche le tabelle già sostituite",async(contesto)=>{
  const archivio=await preparaDati(contesto);
  const backup=await esportaBackup(archivio.database);
  const nuovo=structuredClone(backup);nuovo.dati.inventario=[];
  const fallisci=()=>{throw new Error("Spazio esaurito nella prova");};
  archivio.database.spesa.hook("creating",fallisci);
  await assert.rejects(importaBackup(archivio.database,nuovo),/Spazio esaurito/);
  archivio.database.spesa.hook("creating").unsubscribe(fallisci);
  assert.deepEqual((await esportaBackup(archivio.database)).dati,backup.dati);
});

test("due schede che consumano contemporaneamente non possono superare la quantità disponibile",async(contesto)=>{
  const {archivio}=await preparaArchivio(contesto,false);
  await archivio.salvaProdotto(prodottoProva);
  const voce=await archivio.aggiungiInventario({codice:prodottoProva.code,quantita:100});
  const altra=new ArchivioFridgeBrain({nomeDatabase:archivio.database.name});
  try {
    const risultati=await Promise.allSettled([archivio.consumaInventario(voce.id,{quantita:70},"prima"),altra.consumaInventario(voce.id,{quantita:70},"seconda")]);
    assert.equal(risultati.filter((r)=>r.status==="fulfilled").length,1);
    assert.equal((await archivio.voce(voce.id)).quantita,30);
    assert.equal((await archivio.storico()).length,1);
  }finally{altra.chiudi();}
});
