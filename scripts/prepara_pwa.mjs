import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const base = "/FridgeBrain/";
async function elenca(cartella) {
  const voci = await readdir(cartella,{withFileTypes:true});
  return (await Promise.all(voci.map(async(voce)=>voce.isDirectory()?elenca(join(cartella,voce.name)):join(cartella,voce.name)))).flat();
}
const file=(await elenca("out")).filter((nome)=>/\.(html|js|css|svg|png|webmanifest|woff2)$/.test(nome)&&!nome.endsWith("servizio-worker.js")).sort();
const impronta=createHash("sha256");
for(const nome of file)impronta.update(nome).update(await readFile(nome));
const risorse=[...new Set([base,...file.map((nome)=>base+nome.replaceAll("\\","/").replace(/^out\//,"")).map((nome)=>nome===`${base}index.html`?base:nome)])];
const modello=await readFile("public/servizio-worker.js","utf8");
await writeFile("out/servizio-worker.js",modello.replace('"__VERSIONE__"',JSON.stringify(impronta.digest("hex").slice(0,20))).replace('"__RISORSE__"',JSON.stringify(risorse)));
await writeFile("out/.nojekyll","");
console.log(`PWA preparata: ${risorse.length} risorse locali sotto ${base}`);
