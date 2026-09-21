# Verifica della migrazione per hosting pubblico

Il requisito aggiornato sostituisce le parti di `SPEC.md` relative al catalogo da dump, al funzionamento completamente offline e all'accesso soltanto domestico. La specifica storica non viene riscritta; il comportamento corrente e le istruzioni operative sono nel README.

La migrazione preserva UI, scanner, tipi del dominio, inventario, scadenze, posizioni, spesa, preferenze, nutrizione deterministica, provider ricette, SQLite e struttura Docker/Caddy. Lo schema versione 3 aggiunge la cache OFF senza cancellare i dati. Solo il confine HTTP recupera prodotti remoti; le operazioni transazionali restano sincrone.

Test riproducibili: `pnpm controlla`, `pnpm test`, `pnpm test:backup`, `pnpm build`, `pnpm test:e2e`. OFF è simulato anche nei flussi browser. I test esistenti indipendenti dal catalogo sono mantenuti; quelli dipendenti dal catalogo sono adattati alla cache. Sono aggiunte prove di recupero HTTP, errori, timeout, limite richieste, aggiornamento cache, migrazione e protezione dell'accesso.

Il service worker non conserva più dati personali o pagine: elimina le vecchie cache e mostra un avviso senza dati quando il server è irraggiungibile. Il browser continua a caricare scanner, font e icone senza servizi esterni. Il server contatta OFF solo per barcode sconosciuti.

La verifica locale non equivale a un deployment pubblico: DNS, VPS, credenziali e rilascio del certificato per il dominio reale restano operazioni dell'amministratore.

## Esito del 21 settembre 2026

- Typecheck e build Next.js completati senza errori.
- 86 test TypeScript superati, inclusi test HTTP OFF e autenticazione.
- 4 test Python di backup superati.
- 42 test Playwright superati sui tre formati; installabilità PWA, scanner, accessibilità, flussi esistenti e protezione degli accessi verificati.
- Build Docker e collaudo HTTPS locale, persistenza dopo riavvio senza OFF e backup dal container superati; dettagli in [verifica Docker](verifica-docker.md).
- Prova manuale aggiuntiva sul servizio pubblico: barcode `3017620422003` recuperato come Nutella con ingredienti e 56 campi nutrizionali. Questa prova non fa parte della suite automatica e non ne condiziona l'esito.
- Schermate effettivamente ispezionate nei tre formati, senza modifiche al design system. Artefatti in `data/verifica-visuale/` e `data/verifica-migrazione/`.
- `data/` resta esclusa da Git; nessun database, dump o segreto aggiunto al versionamento. Nessuna nuova dipendenza software.

## File interessati

- Backend: `src/lib/database.ts`, `src/lib/servizi.ts`, `src/lib/api.ts`; nuovi `src/lib/open-food-facts.ts`, `src/lib/autenticazione.ts`, `src/proxy.ts`.
- Interfaccia: solo testi pertinenti in `src/app/layout.tsx`, `src/components/aggiunta.tsx`, `src/components/applicazione.tsx`, `src/components/comuni.tsx`, `src/components/organizzazione.tsx`.
- PWA: `public/servizio-worker.js`, `public/manifest.webmanifest`.
- Configurazione: `.env.example`, `docker-compose.yml`, `Caddyfile`, `Dockerfile`, `package.json`, `playwright.config.ts`.
- Test e strumenti: `tests/api.test.ts`, `tests/barcode.test.ts`, `tests/inventario.test.ts`, `tests/demo.test.ts`, `tests/supporto-archivio.ts`, `tests/browser/flussi.spec.ts`, `scripts/avvia_test_browser.mjs`, `scripts/prepara_demo.ts`; nuovi `tests/open-food-facts.test.ts`, `tests/autenticazione.test.ts`, `tests/browser/accesso.spec.ts`.
- Documentazione: `README.md`, `docs/catalogo.md`, `docs/contratto-api.md`, `docs/docker.md`, `docs/verifica-specifica.md`, `docs/verifica-docker.md`.
- Rimossi esclusivamente gli strumenti obsoleti `scripts/analizza_sample.py`, `scripts/costruisci_database_alimenti.py`, `tests/test_importazione.py`.

Invariati `src/lib/motore.ts`, `src/lib/tipi.ts`, `src/app/globals.css`, lockfile, `.gitignore`, `SPEC.md` e file originali in `data/raw/`. Gli altri test non dipendenti dal catalogo sono conservati.
