# Verifica static export e PWA

Verifica locale del 23 settembre 2026, sulla migrazione esistente.

- `pnpm controlla`: superato.
- `pnpm test`: 83 test superati, nessuno ignorato.
- `pnpm build`: export statico riuscito in `out/`; solo pagine statiche, nessuna route API. Il precache comprende 24 risorse sotto `/FridgeBrain/`.
- `pnpm test:e2e`: 39 prove superate su smartphone 390×844, tablet 820×1180 e desktop 1440×1000.
- IndexedDB: persistenza dopo riapertura, snapshot indipendenti dalla cache, transazioni, idempotenza e consumi concorrenti verificati.
- PWA: manifest e icone, installabilità Chromium, uso e modifica offline, scanner ZXing, aggiornamento del service worker e conservazione dei dati verificati.
- OFF: mock nei test automatici. Prova separata sul servizio reale dal browser: `3017620422003` riconosciuto come Nutella; seconda ricerca dopo ricaricamento senza nuova richiesta HTTPS. Confermato accesso diretto senza proxy.
- Schermate di backup su smartphone, impostazioni su tablet e Home su desktop ispezionate visivamente. Nessun redesign.

Il workflow verifica anche il branch di migrazione, ma carica/pubblica Pages soltanto da `main`. Il collaudo locale non certifica un'installazione su telefono fisico: questa richiede l'URL pubblicato e il consenso ai permessi del dispositivo.

## Verifica del sito pubblicato

Deployment di main riuscito dopo l'attivazione di Pages sulla repository resa pubblica dall'utente: [esecuzione GitHub Actions](https://github.com/martaroech/FridgeBrain/actions/runs/35831650009).

Su `https://martaroech.github.io/FridgeBrain/`: HTTP 200, nessun errore JavaScript, manifest standalone, tre icone con risposta 200 e service worker con scope corretto. Barcode `3017620422003` riconosciuto come Nutella tramite OFF; dopo ricaricamento e disconnessione, seconda ricerca riuscita dalla cache IndexedDB. Una sola richiesta OFF complessiva.
