# Verifica della migrazione GitHub Pages

La nota iniziale di `SPEC.md` prevale sulle disposizioni storiche incompatibili. Il lavoro riprende il working tree esistente e conserva interfaccia, design system, scanner, tipi di dominio, nutrizione, allergeni, regole e logica delle ricette. Non è stato ricostruito il progetto.

## Requisiti ed evidenze — 23 settembre 2026

| Requisito | Implementazione e verifica |
| --- | --- |
| App statica su project site | Next.js `output: "export"`, `out/`, base path `/FridgeBrain`; build riuscita |
| Nessun backend | Eliminati route API, proxy, autenticazione, SQLite e configurazione Docker/Caddy |
| Compatibilità UI | `chiamaApi` usa il dispatcher locale asincrono; nessuna richiesta a API FridgeBrain |
| Persistenza browser | Dexie/IndexedDB con schema versionato e nove tabelle; riapertura e transazioni concorrenti testate |
| OFF diretto | HTTPS dal browser, normalizzazione, GTIN, cache, timeout/404/429/rete; mock nei test |
| Lookup reale | Nutella `3017620422003` recuperata dal browser; seconda ricerca dopo ricaricamento senza rete OFF |
| Inventario e spesa | CRUD, posizioni, scadenze, scorte, manuali, consumi e idempotenza verificati |
| Nutrizione e regole | Motore deterministico e provider riutilizzabili conservati; generazione AI disabilitata in Pages |
| Backup | Tutte le tabelle in JSON versione 1; validazione, riepilogo e conferma; rollback provato su errore di scrittura |
| Cancellazione | Doppia conferma con testo CANCELLA; preferenze e posizioni iniziali ripristinate |
| PWA | Manifest/icone, installabilità Chromium, precache, uso/modifiche offline e aggiornamento senza perdita dati |
| Scanner | Decoder ZXing su flusso video EAN, alias UPC, singola lettura e seconda scansione dalla cache; permesso negato gestito |
| Tre formati e accessibilità | 39 prove Playwright su smartphone, tablet e desktop; axe e focus tastiera |
| Repository | Checkpoint committati e pushati; dati originali conservati, `data/` ignorata |
| GitHub Actions | Action ufficiali, Node/pnpm, controlli, build, E2E, caricamento out e deployment solo da main |

Comandi riproducibili: `pnpm controlla`, `pnpm test` (83 superati), `pnpm build`, `pnpm test:e2e` (39 superati). Dopo la correzione del modulo preferenze, ripetuti typecheck, suite unitaria, build e i tre E2E backup interessati, tutti superati. I test lavorano con archivi isolati, senza dati personali o dipendenze dalla disponibilità reale di OFF.

Ispezionate le schermate effettive nei tre formati. Nessun redesign o normalizzazione globale dei fine-riga. La verifica Linux su GitHub ha individuato icone presenti localmente ma ignorate dalla regola preesistente `Icon?`: aggiunta un'eccezione limitata a `public/icone/` e versionate le cinque risorse esistenti, senza cambiare le altre esclusioni.

## Pubblicazione e limiti residui

**GitHub Pages non è ancora attivo.** L'API GitHub ha restituito 422: «Your current plan does not support GitHub Pages for this repository». La repository è privata. Per pubblicare è necessario renderla pubblica oppure usare un piano compatibile, poi selezionare Pages → GitHub Actions e rilanciare il workflow su main. La visibilità non è stata modificata e non è stato acquistato alcun piano. Il job di verifica resta distinto dal job di deployment, così questo vincolo non impedisce il collaudo del codice.

Dati esclusivamente nel browser, nessuna sincronizzazione tra dispositivi o recupero cloud. Cancellare i dati del sito può cancellare l'inventario. Backup/trasferimento tramite JSON (limite 25 MiB), senza conversione automatica degli archivi delle versioni server. Nessuna crittografia o autenticazione locale. Generatore AI disabilitato; account, sincronizzazione, OCR e riconoscimento visivo restano fuori ambito.

L'installazione su telefono fisico e l'accesso all'URL pubblico richiedono la risoluzione del vincolo Pages; installabilità, percorso, permessi e decodifica sono stati verificati in Chromium con formati mobile. [Dettagli del collaudo Pages](verifica-pages.md).
