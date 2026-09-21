/* Solo risorse statiche. API e pagine richiedono sempre il server autenticato. */
const versione = "fridgebrain-v2-risorse";
const iniziali = [
  "/manifest.webmanifest",
  "/icone/icona-192.png",
  "/icone/icona-512.png",
  "/icone/icona-maskable.png",
];
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(versione)
      .then((archivio) => archivio.addAll(iniziali))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (evento) => {
  // Elimina anche le copie personali create dalle precedenti versioni locali.
  evento.waitUntil(
    caches
      .keys()
      .then((chiavi) =>
        Promise.all(
          chiavi
            .filter(
              (chiave) =>
                chiave.startsWith("fridgebrain-") && chiave !== versione,
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
  if (richiesta.mode === "navigate") {
    evento.respondWith(
      fetch(richiesta).catch(
        () =>
          new Response(
            '<!doctype html><html lang="it"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FridgeBrain · Connessione assente</title><body style="font-family:system-ui;background:#faf9f5;color:#263b32;padding:32px"><h1>Connessione assente</h1><p>Ricollegati al server per accedere ai tuoi dati.</p><a href="/">Riprova</a></body></html>',
            {
              status: 503,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
              },
            },
          ),
      ),
    );
    return;
  }
  if (
    indirizzo.pathname.startsWith("/_next/static/") ||
    iniziali.includes(indirizzo.pathname)
  ) {
    evento.respondWith(
      (async () => {
        const archivio = await caches.open(versione);
        const salvata = await archivio.match(richiesta);
        if (salvata) return salvata;
        const risposta = await fetch(richiesta);
        if (risposta.ok) await archivio.put(richiesta, risposta.clone());
        return risposta;
      })(),
    );
  }
});
