/* La versione e le risorse sono inserite dopo next build. Nessun dato personale in Cache Storage. */
const versione = "__VERSIONE__";
const risorse = "__RISORSE__";
const archivio = `fridgebrain-pages-${versione}`;
const base = new URL("./", self.location.href).pathname;
self.addEventListener("install", (evento) => {
  evento.waitUntil((async()=>{
    const cache = await caches.open(archivio);
    await cache.addAll(risorse);
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener("message", (evento)=>{ if(evento.data?.tipo==="ATTIVA") void self.skipWaiting(); });
self.addEventListener("activate", (evento)=>{
  evento.waitUntil((async()=>{
    for(const chiave of await caches.keys()) if(chiave.startsWith("fridgebrain-") && chiave!==archivio)await caches.delete(chiave);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (evento)=>{
  const richiesta=evento.request;const url=new URL(richiesta.url);
  if(richiesta.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(base))return;
  // Solo file noti della build: niente API, prodotti OFF o copie di IndexedDB.
  const chiave=richiesta.mode==="navigate" && [base,`${base}index.html`].includes(url.pathname)?base:url.pathname;
  if(!risorse.includes(chiave))return;
  evento.respondWith((async()=>{const cache=await caches.open(archivio);return await cache.match(chiave) ?? fetch(richiesta);})());
});
