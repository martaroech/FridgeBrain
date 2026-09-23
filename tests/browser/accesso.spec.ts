import {test,expect,tabella} from "./supporto";
import {readFile,writeFile} from "node:fs/promises";

test("backup esportato, riepilogo di importazione, annullamento e doppia conferma di cancellazione",async({page:pagina,archivioLocale:archivio},prova)=>{
  await archivio.post("/api/prodotti",{data:{code:"2099999999908",product_name:"Fagioli di casa",nutriments:{proteins_100g:7}}});
  await archivio.post("/api/inventario",{data:{codice:"2099999999908",quantita:400}});
  await pagina.reload();
  await pagina.getByRole("button",{name:"Impostazioni",exact:true}).click();
  const scaricamento=pagina.waitForEvent("download");
  await pagina.getByRole("button",{name:"Esporta backup",exact:true}).click();
  const file=await scaricamento;const percorso=await file.path();
  const contenuto=await readFile(percorso!,"utf8");const backup=JSON.parse(contenuto);
  expect(backup.versione).toBe(1);expect(backup.dati.inventario[0].prodotto.product_name).toBe("Fagioli di casa");
  await pagina.getByLabel("File di backup").setInputFiles({name:"errato.json",mimeType:"application/json",buffer:Buffer.from('{"versione":900}')});
  await expect(pagina.getByRole("alert",{name:"Errore"})).toBeVisible();
  expect((await tabella(pagina,"inventario","getAll")).length).toBe(1);
  await pagina.getByRole("button",{name:"Cancella tutti i dati locali"}).click();
  await pagina.getByRole("dialog").getByRole("button",{name:"Annulla"}).click();
  expect((await tabella(pagina,"inventario","getAll")).length).toBe(1);
  await pagina.getByRole("button",{name:"Cancella tutti i dati locali"}).click();
  await pagina.getByRole("button",{name:"Continua con la cancellazione"}).click();
  await expect(pagina.getByRole("button",{name:"Elimina definitivamente"})).toBeDisabled();
  await pagina.getByLabel("Scrivi CANCELLA per confermare").fill("CANCELLA");
  await pagina.getByRole("button",{name:"Elimina definitivamente"}).click();
  await expect(pagina.getByRole("dialog")).not.toBeVisible();
  expect((await tabella(pagina,"inventario","getAll")).length).toBe(0);
  await pagina.getByLabel("File di backup").setInputFiles({name:"backup.json",mimeType:"application/json",buffer:Buffer.from(contenuto)});
  await expect(pagina.getByRole("dialog")).toContainText("inventario: 1");
  await pagina.screenshot({path:`data/verifica-visuale/backup-${prova.project.name}.png`,fullPage:true});
  expect((await tabella(pagina,"inventario","getAll")).length).toBe(0);
  await pagina.getByRole("button",{name:"Conferma e sostituisci i dati"}).click();
  await expect(pagina.getByRole("dialog")).not.toBeVisible();
  await pagina.reload();
  expect((await tabella(pagina,"inventario","getAll"))).toEqual(backup.dati.inventario);
});

test("GitHub Pages serve solo file statici e due browser non condividono dati",async({page:pagina,context:contesto,browser,archivioLocale:archivio})=>{
  await archivio.post("/api/prodotti",{data:{code:"2099999999908",product_name:"Solo in questo browser"}});
  await archivio.post("/api/inventario",{data:{codice:"2099999999908",quantita:100}});
  expect((await contesto.request.get("/FridgeBrain/api/stato")).status()).toBe(404);
  await expect(pagina.locator('link[rel="manifest"]')).toHaveAttribute("href","/FridgeBrain/manifest.webmanifest");
  const altro=await browser.newContext();
  try {
    const nuova=await altro.newPage();await nuova.goto("http://127.0.0.1:3100/FridgeBrain/");
    await expect(nuova.getByText("Il frigorifero è ancora vuoto.")).toBeVisible();
  }finally{await altro.close();}
  expect(await pagina.evaluate(()=>Object.keys(localStorage))).toEqual([]);
});

test("nuovo deployment aggiorna il service worker senza perdere i dati IndexedDB",async({page:pagina,archivioLocale:archivio})=>{
  await archivio.post("/api/prodotti",{data:{code:"2099999999908",product_name:"Conservato dopo aggiornamento"}});
  await archivio.post("/api/inventario",{data:{codice:"2099999999908",quantita:100}});
  await pagina.reload();
  await pagina.evaluate(()=>navigator.serviceWorker.ready.then(()=>undefined));
  const file="out/servizio-worker.js";const precedente=await readFile(file,"utf8");
  const versione=`prova-${Date.now()}`;
  try {
    await writeFile(file,precedente.replace(/const versione = "[^"]+"/,`const versione = "${versione}"`));
    await pagina.evaluate(async()=>{const registrazione=await navigator.serviceWorker.getRegistration();await registrazione!.update();});
    await expect(pagina.getByRole("button",{name:"Aggiorna app"})).toBeVisible();
    await pagina.getByRole("button",{name:"Aggiorna app"}).click();
    await expect(pagina.getByRole("button",{name:"Aggiorna app"})).not.toBeVisible();
    await pagina.getByRole("navigation").getByRole("button",{name:"Inventario",exact:true}).click();
    await expect(pagina.getByRole("button",{name:"Apri Conservato dopo aggiornamento",exact:true})).toBeVisible();
    await expect.poll(()=>pagina.evaluate(()=>caches.keys())).toEqual([`fridgebrain-pages-${versione}`]);
    expect((await tabella(pagina,"inventario","getAll")).length).toBe(1);
  }finally{await writeFile(file,precedente);}
});
