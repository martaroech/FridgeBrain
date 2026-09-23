import {test as prova,expect,type Page} from "@playwright/test";
import {readFileSync} from "node:fs";
import type {Prodotto} from "../../src/lib/tipi";
export {expect};
export const prodottiSample=JSON.parse(readFileSync("tests/fixtures/prodotti_sample.json","utf8")) as Prodotto[];

/** Accesso nativo usato soltanto per preparare fixture e ispezionare la persistenza reale. */
export async function tabella(pagina:Page,nome:string,operazione:"getAll"|"put"|"delete",valore?:unknown):Promise<any>{
  return pagina.evaluate(({nome,operazione,valore})=>new Promise((risolvi,rifiuta)=>{
    const apertura=indexedDB.open("fridgebrain");
    apertura.onerror=()=>rifiuta(apertura.error);
    apertura.onsuccess=()=>{
      const database=apertura.result;
      const transazione=database.transaction(nome,operazione==="getAll"?"readonly":"readwrite");
      const archivio=transazione.objectStore(nome);
      const richiesta=operazione==="getAll"?archivio.getAll():operazione==="put"?archivio.put(valore):archivio.delete(valore as IDBValidKey);
      transazione.oncomplete=()=>{risolvi(richiesta.result);database.close();};
      transazione.onabort=()=>{rifiuta(transazione.error);database.close();};
    };
  }),{nome,operazione,valore});
}
export interface RispostaProva{ok:()=>boolean;json:()=>Promise<any>}
export interface ArchivioProva{get:(percorso:string)=>Promise<RispostaProva>;post:(percorso:string,opzioni:{data:any})=>Promise<RispostaProva>;put:(percorso:string,opzioni:{data:any})=>Promise<RispostaProva>;delete:(percorso:string)=>Promise<RispostaProva>}
export const test=prova.extend<{archivioLocale:ArchivioProva;intercettaOff:void}>({
  intercettaOff:[async({context:contesto},usa)=>{
    await contesto.route("https://world.openfoodfacts.org/api/v2/product/**",async(rotta)=>{
      const codice=new URL(rotta.request().url()).pathname.split("/").pop()!.replace(/\.json$/,"");
      const prodotto=prodottiSample.find((voce)=>voce.code.padStart(14,"0")===codice.padStart(14,"0"));
      await rotta.fulfill({json:prodotto?{status:1,product:prodotto}:{status:0}});
    });
    await usa();
  },{auto:true}],
  archivioLocale:async({page:pagina},usa)=>{
    await pagina.goto("/FridgeBrain/");
    await expect(pagina.getByRole("heading",{level:1})).toBeVisible();
    const risposta=(dati:unknown):RispostaProva=>({ok:()=>true,json:async()=>dati});
    await usa({
      get:async(percorso)=>{
        if(percorso!=="/api/stato")throw new Error("Fixture di lettura non prevista: "+percorso);
        return risposta({inventario:await tabella(pagina,"inventario","getAll"),spesa:await tabella(pagina,"spesa","getAll"),ricette:await tabella(pagina,"ricette","getAll")});
      },
      delete:async(percorso)=>{const [, ,nome,id]=percorso.split("/");await tabella(pagina,nome==="prodotti"?"prodotti_personalizzati":nome,"delete",nome==="prodotti"?id:Number(id));return risposta({ok:true});},
      put:async(percorso,{data:dati})=>{if(percorso!=="/api/preferenze")throw new Error("Fixture non prevista");await tabella(pagina,"impostazioni","put",{chiave:"preferenze",valore:dati});return risposta(dati);},
      post:async(percorso,{data:dati})=>{
        if(percorso==="/api/prodotti"){
          const prodotto={...dati,personalizzato:true};
          await tabella(pagina,"prodotti_personalizzati","put",{codice:dati.code,dati:prodotto,creato_il:new Date().toISOString()});return risposta(prodotto);
        }
        if(percorso==="/api/inventario"){
          const prodotti=await tabella(pagina,"prodotti_personalizzati","getAll");
          const voce={prodotto:prodotti.find((p:any)=>p.codice===dati.codice).dati,confezioni:1,quantita:null,unita:"g",posizione:"Frigorifero",scadenza:null,scorta_minima:null,inserito_il:new Date().toISOString(),...dati};delete voce.codice;
          voce.id=await tabella(pagina,"inventario","put",voce);return risposta(voce);
        }
        throw new Error("Fixture di scrittura non prevista: "+percorso);
      },
    });
  },
});
