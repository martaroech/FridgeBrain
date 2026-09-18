/* La rete domestica resta la fonte autorevole. Nessuna modifica viene simulata offline. */
const versione = "fridgebrain-v1-2";
const risorse = `${versione}-risorse`;
const dati = `${versione}-dati`;
const iniziali = [
  "/",
  "/manifest.webmanifest",
  "/icone/icona-192.png",
  "/icone/icona-512.png",
  "/icone/icona-maskable.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const archivio = await caches.open(risorse);
      await archivio.addAll(iniziali);
      const pagina = await archivio.match("/");
      const contenuto = await pagina.text();
      const percorsi = [
        ...contenuto.matchAll(
          /(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/g,
        ),
      ].map((risultato) => risultato[1].replaceAll("&amp;", "&"));
      await archivio.addAll([...new Set(percorsi)]);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chiavi) =>
        Promise.all(
          chiavi
            .filter(
              (chiave) =>
                chiave.startsWith("fridgebrain-") &&
                !chiave.startsWith(versione),
            )
            .map((chiave) => caches.delete(chiave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  const indirizzo = new URL(richiesta.url);
  if (richiesta.method !== "GET" || indirizzo.origin !== self.location.origin)
    return;
  if (indirizzo.pathname === "/api/stato") {
    evento.respondWith(
      (async () => {
        const archivio = await caches.open(dati);
        try {
          const risposta = await fetch(richiesta);
          if (risposta.ok) {
            const contenuto = await risposta.clone().json();
            await archivio.put(
              "/api/stato",
              Response.json({
                ...contenuto,
                aggiornato_il: new Date().toISOString(),
              }),
            );
          }
          return risposta;
        } catch {
          const salvata = await archivio.match("/api/stato");
          if (!salvata)
            return Response.json(
              {
                errore:
                  "Il server di casa non è raggiungibile e non è ancora disponibile una copia locale.",
              },
              { status: 503 },
            );
          return Response.json(
            { ...(await salvata.json()), copia_offline: true },
            { headers: { "X-FridgeBrain-Offline": "1" } },
          );
        }
      })(),
    );
    return;
  }
  if (indirizzo.pathname.startsWith("/api/")) return;
  if (richiesta.mode === "navigate") {
    evento.respondWith(
      (async () => {
        const archivio = await caches.open(risorse);
        try {
          const risposta = await fetch(richiesta);
          if (risposta.ok) await archivio.put("/", risposta.clone());
          return risposta;
        } catch {
          return (await archivio.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }
  if (
    indirizzo.pathname.startsWith("/_next/static/") ||
    iniziali.includes(indirizzo.pathname)
  ) {
    evento.respondWith(
      (async () => {
        const archivio = await caches.open(risorse);
        const salvata = await archivio.match(richiesta);
        if (salvata) return salvata;
        const risposta = await fetch(richiesta);
        if (risposta.ok) await archivio.put(richiesta, risposta.clone());
        return risposta;
      })(),
    );
  }
});
