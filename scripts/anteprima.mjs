/** Solo anteprima statica di out/: nessuna API o logica applicativa. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
const radice=resolve("out");
const porta=Number(process.env.PORT ?? 3000);
const tipi={html:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json",webmanifest:"application/manifest+json",svg:"image/svg+xml",png:"image/png",woff2:"font/woff2",txt:"text/plain"};
createServer(async(richiesta,risposta)=>{
  const url=new URL(richiesta.url,"http://localhost");
  if(url.pathname==="/FridgeBrain"){risposta.writeHead(308,{Location:"/FridgeBrain/"});risposta.end();return;}
  try {
    if(!["GET","HEAD"].includes(richiesta.method)||!url.pathname.startsWith("/FridgeBrain/"))throw new Error("Indirizzo non disponibile");
    let percorso=resolve(radice,decodeURIComponent(url.pathname.slice("/FridgeBrain/".length))||"index.html");
    if(!percorso.startsWith(radice+sep))throw new Error("Percorso non valido");
    if((await stat(percorso)).isDirectory())percorso=resolve(percorso,"index.html");
    const contenuto=await readFile(percorso);
    risposta.writeHead(200,{"Content-Type":tipi[percorso.split(".").at(-1)]??"application/octet-stream","Cache-Control":"no-cache"});risposta.end(richiesta.method==="HEAD"?undefined:contenuto);
  }catch{risposta.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});risposta.end(await readFile(resolve(radice,"404.html")).catch(()=>"Pagina non trovata."));}
}).listen(porta,"127.0.0.1",()=>console.log(`Anteprima statica: http://127.0.0.1:${porta}/FridgeBrain/`));
