# FridgeBrain

PWA personale per inventario alimentare, scadenze, quantità, posizioni, spesa, preferenze e ricette salvate. **GitHub Pages ospita solo l'app statica; tutti i dati personali restano nel browser in IndexedDB.** Nessun account, server applicativo, database cloud o segreto.

Indirizzo previsto: **https://martaroech.github.io/FridgeBrain/**. Restano Next.js, componenti React, navigazione a hash, scanner e design system esistenti. La nota iniziale di [SPEC.md](SPEC.md) aggiorna l'architettura originaria.

## Pubblicazione GitHub Pages

**Pubblicazione attiva:** dopo il passaggio della repository a pubblica, GitHub Pages è stato abilitato con origine GitHub Actions e il deployment è riuscito. App disponibile su **https://martaroech.github.io/FridgeBrain/**. Verificati dal sito pubblico HTTPS, manifest, icone, service worker, ricerca OFF e rilettura dalla cache offline.

1. Nella repository `martaroech/FridgeBrain`: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Porta queste modifiche sul ramo `main` e inviale a GitHub.
3. Attendi il workflow **Verifica e pubblicazione GitHub Pages**; il job di deployment mostrerà il collegamento HTTPS.
4. Dal telefono usa **Installa app** oppure, su Safari, **Condividi → Aggiungi alla schermata Home**. Consenti la fotocamera quando richiesto.

Il workflow usa le action ufficiali GitHub e verifica tipi, test, build ed E2E prima di caricare soltanto `out/`. Le pull request verso `main` vengono verificate senza deployment. Nessuna chiave API o password da configurare. [Documentazione GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Next.js usa `output: "export"`, `basePath: "/FridgeBrain"` e slash finale. Asset, manifest, icone e service worker rispettano questo percorso; la navigazione `#inventario`, `#aggiungi`, ecc. non richiede riscritture. Per rinominare il progetto aggiorna `next.config.ts`, `src/lib/percorsi.ts`, `scripts/prepara_pwa.mjs`, anteprima e test.

## Sviluppo e anteprima

Requisiti: Node.js 24 e pnpm 11.19.0. Nessuna variabile d'ambiente applicativa obbligatoria.

```bash
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

Apri `http://127.0.0.1:3000/FridgeBrain/`. Il service worker viene registrato solo in produzione. Per verificare la PWA:

```bash
pnpm build
pnpm start
```

`pnpm build` esegue `next build`, genera `out/` e prepara precache e versione del service worker con `scripts/prepara_pwa.mjs`: **usa il comando completo**. `pnpm start` è un'anteprima locale dei soli file statici, non un server applicativo da pubblicare. Ascolta sul loopback; `PORT` cambia la porta. Sul telefono usa Pages HTTPS: un indirizzo LAN HTTP non abilita fotocamera/PWA.

## Persistenza e backup

IndexedDB `fridgebrain`, schema versione 1 gestito con Dexie:

| Archivio | Contenuto |
| --- | --- |
| `inventario` | Snapshot prodotto, quantità totale, confezioni, posizione, scadenza, scorta minima |
| `prodotti_personalizzati` | Prodotti inseriti manualmente |
| `cache_prodotti_off` | Barcode, prodotto, primo recupero e ultimo aggiornamento |
| `posizioni` | Frigorifero, Freezer, Dispensa e posizioni aggiuntive |
| `spesa` | Elementi, quantità e stato acquistato |
| `impostazioni` | Preferenze, allergeni, esclusioni e limiti |
| `ricette` | Ricette, richiesta, nutrienti e stato di preparazione |
| `storico` | Consumi, eliminazioni e preparazioni |
| `operazioni` | Ricevute per evitare duplicazioni nei tentativi ripetuti |

Operazioni asincrone; modifiche correlate, consumo ricette e importazione sono atomici. OFF viene contattato fuori dalle transazioni. Nessun dato personale in localStorage o nei file di Pages.

**Dispositivi, profili e origini differenti non sono sincronizzati.** Gli aggiornamenti normali conservano IndexedDB. Cancellare dati del sito/browser, eliminare il profilo o usare navigazione privata può cancellare l'inventario. L'app richiede persistent storage quando supportato; il browser può rifiutarlo e non sostituisce il backup. Altre pagine sulla stessa origine `martaroech.github.io` condividono i permessi di archiviazione del browser.

In **Impostazioni → Backup e dati locali**:

- **Esporta backup** scarica tutte le tabelle in un JSON versionato, cache e ricevute incluse. Conservalo al sicuro: contiene dati personali e non è cifrato.
- **Importa backup** valida formato/versione, identificatori e contenuti, mostra data e conteggi, poi chiede **Conferma e sostituisci i dati**. Non unisce archivi. File non validi o scritture fallite lasciano intatti i dati precedenti. Limite attuale: 25 MiB per file.
- **Cancella tutti i dati locali** richiede prima conferma, poi di digitare `CANCELLA`. Ripristina le tre posizioni iniziali; non elimina backup scaricati o dati su altri dispositivi.

Export/import è il metodo di backup e trasferimento. Gli archivi delle precedenti versioni server non vengono convertiti automaticamente. I file originali in `data/` restano intatti, esclusi da Git e inutilizzati dalla nuova app.

## Open Food Facts

Il barcode viene cercato prima nei prodotti personali e nella cache IndexedDB. Solo se manca viene interrogata direttamente dal browser l'API HTTPS `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. Nessun proxy o chiave API. La risposta viene validata, normalizzata e salvata mantenendo la nomenclatura OFF (`product_name`, `nutriments`, `ingredients_text`, `allergens_tags`, ecc.).

Il browser controlla l'header User-Agent: l'app si identifica tramite il parametro `user_agent=FridgeBrain/1.0 (https://martaroech.github.io/FridgeBrain/)`. Le richieste omettono le credenziali. OFF riceve il barcode e i normali dati della connessione, non inventario, preferenze o backup. Nessun analytics, font remoto o servizio cloud aggiuntivo.

Limite di 8 secondi e 2 MiB per risposta. Errori distinti per codice non valido, prodotto assente, rete indisponibile, timeout, dati non validi e rate limiting. Dopo un 429 nuovi recuperi sospesi per un minuto nella scheda; i prodotti locali restano utilizzabili. Richieste simultanee dello stesso GTIN nella scheda condividono il recupero. Ricerche per nome/marca esclusivamente locali, fino a 30 risultati.

La cache non scade automaticamente: una nuova scansione dello stesso prodotto non contatta OFF. Gli snapshot dell'inventario mantengono i dati presenti all'aggiunta. [Dettagli cache](docs/catalogo.md) e [API OFF](https://openfoodfacts.github.io/openfoodfacts-server/api/).

## Uso quotidiano

1. Apri **Aggiungi**, scansiona o inserisci il barcode. Puoi inserire manualmente prodotti sconosciuti anche offline.
2. Controlla nome, ingredienti, nutrienti e allergeni; indica posizione, confezioni e scadenza. La **quantità totale residua** comprende tutte le confezioni e non viene moltiplicata automaticamente.
3. In **Inventario** cerca, filtra e ordina; apri un prodotto per modificarlo, spostarlo, consumarlo o eliminarlo. **Scorta minima** è una soglia esplicita nella stessa unità del residuo.
4. La **Home** evidenzia prodotti da consumare prima, scaduti e in esaurimento. In **Spesa** annota ciò che manca e spunta gli acquisti.
5. In **Impostazioni** salva preferenze, allergeni ed esclusioni, gestisci posizioni, consulta lo storico e scarica regolarmente un backup.

## Nutrizione e ricette

Il motore deterministico è conservato: calorie, carboidrati, zuccheri, proteine, grassi, fibre e sale per ingrediente, ricetta e porzione, dai dati per 100 g/ml. Valori mancanti rimangono sconosciuti; zero esplicito resta zero. Nessuna conversione arbitraria fra grammi, millilitri e pezzi. Quantità, scadenze, allergeni, dieta e limiti numerici sono verificati prima dell'accettazione e del consumo di una ricetta.

**Il generatore AI è disabilitato nella build Pages.** Non occorre Ollama e non vengono chiamate API AI. L'astrazione provider locale/simulato e la validazione restano nel codice e nei test per sviluppi futuri. Le ricette salvate e trasferite tramite backup sono consultabili e possono essere segnate come preparate: quantità e preferenze correnti vengono rivalidate, senza doppio consumo.

Allergene presente, assenza dichiarata e dato sconosciuto restano distinti; una lista vuota non certifica assenza. L'etichetta originale resta il riferimento: Open Food Facts e FridgeBrain non forniscono certificazioni mediche.

## PWA, offline e aggiornamenti

Dopo il primo caricamento completo online, il service worker conserva HTML, JavaScript, CSS, icone e scanner per l'uso offline. Inventario, cache, personalizzati, spesa, impostazioni e ricette salvate restano disponibili e modificabili senza connessione. **Un barcode nuovo richiede Internet verso OFF.** Nessuna coda di sincronizzazione: l'archivio è già locale.

Ogni build produce una versione PWA basata sui file. Quando il nuovo worker ha scaricato tutte le risorse compare **Aggiorna app**: salva eventuali modifiche nei moduli, poi premi per attivarlo e ricaricare. IndexedDB viene conservato; le vecchie cache statiche vengono eliminate. Chiudi o ricarica anche eventuali altre schede. Per ricevere aggiornamenti devi riaprire l'app online.

## Test

```bash
pnpm controlla
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Su Linux: `pnpm exec playwright install --with-deps chromium` installa anche le dipendenze di sistema. Playwright avvia l'anteprima statica sulla porta 3100 sotto `/FridgeBrain/`.

La suite usa `fake-indexeddb` per la logica e IndexedDB reale in Chromium per gli E2E. OFF è simulato con fixture HTTP; nessun test dipende dal servizio pubblico. Copertura di lookup e alias GTIN, 20 prodotti reali, cache, errori HTTP, inventario, quantità/scadenze/posizioni, personalizzati, spesa, nutrienti/allergeni/regole, transazioni concorrenti, backup, scanner ZXing, installabilità, offline, aggiornamenti PWA, accessibilità e tre formati. [Rapporto di verifica](docs/verifica-specifica.md).

## Struttura

```text
src/app/                    Pagine statiche Next.js, metadati e CSS esistenti
src/components/             Interfaccia React, scanner e gestione backup
src/lib/tipi.ts             Tipi del dominio
src/lib/database.ts         Schema e transazioni IndexedDB con Dexie
src/lib/servizi.ts          Operazioni asincrone e cache
src/lib/api.ts              Dispatcher locale compatibile con la UI
src/lib/open-food-facts.ts  Client HTTPS browser e normalizzazione OFF
src/lib/backup.ts           Backup, validazione, importazione e cancellazione
src/lib/motore.ts           Nutrizione, regole e provider riutilizzabili
public/                     Manifest, modello del service worker e icone
scripts/                    Preparazione PWA e anteprima statica locale
.github/workflows/          Verifica e deployment GitHub Pages
out/                        Build pubblicabile generata, ignorata da Git
```

I nomi `/api/...` nei componenti sono solo identificatori interni del dispatcher locale: **non esistono route HTTP applicative**. [Contratto client](docs/contratto-api.md). Design avorio, salvia e verde profondo invariato: [design system](docs/design-system.md). `data/` rimane esclusa da Git e non contiene la persistenza della nuova app browser.

## Problemi comuni

| Problema | Soluzione |
| --- | --- |
| Pagina o asset 404 | Apri `/FridgeBrain/` con maiuscole corrette; pubblica `out/` tramite Actions |
| Pubblicazione non parte | Abilita Pages con origine GitHub Actions e controlla il ramo `main` |
| Inventario vuoto su altro dispositivo | Importa il backup; nessuna sincronizzazione automatica |
| Barcode sconosciuto | Verifica la connessione o inseriscilo manualmente |
| OFF non risponde / 429 | Riprova dopo almeno un minuto; i prodotti salvati restano disponibili |
| Archivio non disponibile | Consenti la memorizzazione del sito; usa un profilo normale supportato |
| Spazio esaurito | Esporta il backup, libera spazio e riprova |
| Fotocamera negata | Consenti il permesso, verifica HTTPS e chiudi altre app che usano la camera |
| Versione precedente | Riapri online e premi Aggiorna app; esporta prima di cancellare dati del sito |
| Generazione ricette disabilitata | Comportamento previsto in questa versione statica |

## Attribuzione e limiti

Prodotti e fixture: [Open Food Facts](https://world.openfoodfacts.org/), banca dati [ODbL](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).

Nessuna autenticazione: chi accede al profilo browser può vedere i dati. Non sono implementati sincronizzazione, crittografia, account, AI cloud, OCR o riconoscimento visivo. L'installazione su telefono fisico richiede pubblicazione e consenso dell'utente; i test verificano installabilità e fotocamera simulata su Chromium.
