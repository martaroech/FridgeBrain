# FridgeBrain

Webapp/PWA personale per inventario alimentare, scadenze, spesa, preferenze e ricette. Si installa su un server Linux/VPS con Docker e Caddy ed è raggiungibile dal telefono via HTTPS. Un solo utente, autenticazione obbligatoria, dati persistenti in SQLite.

Questa versione aggiorna l'architettura della specifica originaria: i prodotti vengono recuperati dalle API Open Food Facts e conservati nel database personale. Non occorrono cataloghi da costruire. I file storici in `data/raw/` non vengono letti o modificati. UI, design system, inventario, motore nutrizionale e provider ricette restano quelli esistenti.

## Avvio pubblico Docker

Prerequisiti: server Linux con Docker Engine e plugin Compose, dominio con record DNS A/AAAA corretto, porte TCP 80 e 443 raggiungibili. Il server deve poter contattare Open Food Facts e le autorità dei certificati via Internet.

```bash
cp .env.example .env
# Modifica .env: dominio, utente, password casuale e contatto Open Food Facts.
mkdir -p data/personali data/caddy/data data/caddy/config
sudo chown -R 1000:1000 data/personali
chmod 600 .env
docker compose up -d --build
```

Per avviare di nuovo l'immagine già costruita basta `docker compose up -d`. Apri `https://IL-TUO-DOMINIO`: il browser chiede utente e password. Caddy ottiene e rinnova il certificato pubblico e reindirizza HTTP a HTTPS. La porta Node 3000 rimane soltanto nella rete Docker. Non serve installare certificati manualmente sul telefono.

Se usi un UID/GID diverso da 1000, adegua `.env` e il proprietario di `data/personali`. [Deployment e aggiornamenti](docs/docker.md).

## Autenticazione e variabili d'ambiente

L'autenticazione HTTP Basic protegge pagine e tutte le API personali, anche accedendo direttamente al processo Node. Nessun database utenti, registrazione o servizio di autenticazione esterno. L'unica API pubblica è `/api/salute`, che restituisce soltanto `{ok:true}`. Manifest, icone, service worker e risorse statiche sono pubblici e non contengono dati personali.

| Variabile                            | Uso                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `FRIDGEBRAIN_UTENTE`                 | Nome dell'unico utente, obbligatorio, senza `:`                                                   |
| `FRIDGEBRAIN_PASSWORD`               | Password obbligatoria, almeno 20 caratteri; usare un valore casuale di 32 byte                    |
| `FRIDGEBRAIN_DOMINIO`                | Nome DNS pubblico, senza protocollo o percorso                                                    |
| `FRIDGEBRAIN_DATI`                   | Directory SQLite nell'avvio Node, predefinita `data`; Docker usa `/app/data`                      |
| `FRIDGEBRAIN_UID`, `FRIDGEBRAIN_GID` | Proprietario del processo e del volume personale Docker, predefiniti 1000                         |
| `FRIDGEBRAIN_OFF_USER_AGENT`         | `FridgeBrain/1.0 (URL dell'installazione; contatto reale)`                                        |
| `FRIDGEBRAIN_OFF_URL`                | Predefinito `https://world.openfoodfacts.org`; cambiare soltanto per test con servizio simulato   |
| `FRIDGEBRAIN_ORIGINI`                | Origini aggiuntive consentite alle modifiche nell'avvio diretto; Compose imposta il dominio HTTPS |
| `FRIDGEBRAIN_GENERATORE`             | `disabilitato` inizialmente, `locale` oppure `simulato` per test                                  |
| `FRIDGEBRAIN_OLLAMA_URL`             | URL locale del provider nell'avvio Node                                                           |
| `FRIDGEBRAIN_OLLAMA_DOCKER_URL`      | URL del provider raggiungibile dal container                                                      |
| `FRIDGEBRAIN_MODELLO`                | Modello Ollama, predefinito `qwen3:8b`                                                            |

Puoi generare una password con `openssl rand -hex 32` sul VPS, oppure con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Inseriscila in `.env`, già escluso da Git e dall'immagine. Non usare le credenziali dei test. Configurazione assente o password troppo corta bloccano l'accesso con 503.

Basic richiede HTTPS su Internet; HTTP è ammesso solo sul loopback per sviluppo. Il browser conserva le credenziali: non c'è un pulsante di logout né una scadenza di sessione. Su dispositivi condivisi usa una finestra privata e chiudila dopo l'uso. Per revocare l'accesso cambia la password e ricrea il container. Chi accede al server o al file `.env` può leggere il segreto: limita i permessi del file e l'accesso amministrativo.

## Installazione e sviluppo senza Docker

Requisiti: Node.js 24 e pnpm 11.19.0. Python 3.10+ è facoltativo, per backup e relativi test. SQLite è integrato in Node.

```bash
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
cp .env.example .env
# Configura utente e password anche per lo sviluppo.
pnpm dev
```

Apri `http://127.0.0.1:3000`. Per la produzione locale e per verificare la PWA: `pnpm build` e `pnpm start`. Questi comandi ascoltano sul loopback; per la pubblicazione usare Docker/Caddy. In esecuzione diretta i dati sono in `data/fridgebrain.db`, in Docker in `data/personali/fridgebrain.db`.

## Uso quotidiano

1. Apri **Aggiungi**, inquadra il barcode oppure inseriscilo manualmente.
2. Controlla nome, ingredienti, allergeni e nutrienti. Indica confezioni, posizione e scadenza.
3. La **quantità totale residua** è la somma del contenuto di tutte le confezioni. È opzionale per l’inventario, necessaria in grammi o millilitri per le ricette. Non viene moltiplicata automaticamente per il numero di confezioni.
4. In **Inventario** cerca nome o marca, filtra per posizione/scadenza, ordina e apri un prodotto per modificarlo, consumarlo in parte o eliminarlo.
   L’avviso **Scorta minima** è opzionale: indica una soglia nella stessa unità della quantità residua. Al raggiungimento della soglia il prodotto appare come **In esaurimento** nella Home e nel filtro inventario; nessuna previsione dei consumi viene inventata.
5. La **Home** distingue prodotti scaduti, in scadenza oggi, entro tre e sette giorni. I prodotti scaduti non vengono proposti per le ricette.
6. In **Spesa** aggiungi, modifica, spunta o rimuovi gli elementi. Quelli acquistati restano in fondo alla lista.
7. In **Impostazioni** salva preferenze, allergeni, esclusioni e limiti nutrizionali. Lo storico distingue consumi, eliminazioni e ricette preparate.

Se un barcode non è presente puoi creare il prodotto manualmente, inclusi dati nutrizionali e dichiarazioni del produttore. Sarà riconosciuto nelle ricerche successive e rimarrà nel database personale.

## Prodotti Open Food Facts

La stessa API `GET /api/prodotti?codice=...` cerca prima i prodotti personalizzati e la cache SQLite, comprese le equivalenze GTIN già supportate. Solo un barcode sconosciuto provoca una richiesta HTTPS a Open Food Facts. La risposta viene verificata e normalizzata mantenendo i nomi originali dei campi, poi salvata in `cache_prodotti_off`. Scansionare nuovamente un prodotto non richiede Internet verso OFF. Non serve una chiave API.

Il recupero ha un limite di 8 secondi e 2 MiB di risposta. Prodotti assenti, codici non validi, timeout, rete indisponibile, risposte malformate e limite di richieste hanno messaggi distinti. Dopo un 429 il server sospende nuovi recuperi per un minuto; cache e prodotti personali restano disponibili. Non vengono memorizzati risultati negativi. Le ricerche per nome o marca sono limitate ai prodotti già in cache e a quelli personali: non interrogano la ricerca remota OFF.

La cache non scade automaticamente e non viene aggiornata a ogni scansione. Per forzare il recupero di un prodotto, un amministratore può eliminare la sola riga corrispondente dalla cache, a server fermo e dopo un backup. Inventario e ricette mantengono i propri snapshot. [Schema e gestione cache](docs/catalogo.md).

Il server trasmette a OFF il barcode richiesto e lo User-Agent configurato, non inventario, preferenze o credenziali dell'utente. Il browser comunica soltanto con FridgeBrain. [Documentazione API OFF](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/).

## Ricette e modello locale

Il generatore creativo usa un provider astratto. La configurazione iniziale `disabilitato` è intenzionale: l’app funziona senza LLM e mostra chiaramente l’indisponibilità della generazione. Nessuna chiamata viene dirottata verso servizi cloud.

Per collegare [Ollama](https://docs.ollama.com/), installalo sul server e scarica un modello compatibile durante la preparazione, ad esempio:

```bash
ollama pull qwen3:8b
```

Configura `.env`:

```dotenv
FRIDGEBRAIN_GENERATORE=locale
FRIDGEBRAIN_MODELLO=qwen3:8b
FRIDGEBRAIN_OLLAMA_URL=http://127.0.0.1:11434
FRIDGEBRAIN_OLLAMA_DOCKER_URL=http://host.docker.internal:11434
```

Riavvia l’app (`docker compose up -d --force-recreate` per applicare le variabili al container). Ollama deve essere raggiungibile dal container; vedi [Docker](docs/docker.md). Il provider usa `/api/chat`, risposta JSON e richieste limitate nel tempo. Il modello va dimensionato in base alla memoria e alla velocità della macchina. L’indirizzo configurato deve appartenere alla macchina o alla rete locale.

La pipeline seleziona prima gli ingredienti compatibili, poi richiede una proposta e controlla nuovamente inventario, quantità, scadenze, porzioni, tempi, allergeni e nutrienti. Sono consentiti al massimo tre tentativi. Le preferenze salvate non possono essere indebolite dai parametri della singola richiesta. **Ho cucinato questa ricetta** mostra prima le quantità da sottrarre; la conferma avviene in una transazione e non può consumare due volte la stessa ricetta.

`FRIDGEBRAIN_GENERATORE=simulato` è riservato a sviluppo e test. Produce una proposta esplicitamente contrassegnata come simulazione, non una ricetta culinaria. Le quantità e i calcoli rimangono reali. I test verificano anche il contratto HTTP del provider locale con un server di prova locale; non richiedono di installare un modello.

## Nutrizione e restrizioni

- Calorie, carboidrati, zuccheri, proteine, grassi, fibre e sale sono calcolati per ingrediente, totale e porzione a partire dai dati per 100 g/100 ml. L’energia in kJ viene convertita quando necessario.
- Un valore mancante, negativo o incoerente resta **sconosciuto**, mentre uno zero dichiarato resta zero. Se un ingrediente manca di un nutriente, il totale di quel nutriente non è completo e viene mostrato come sconosciuto.
- Nessuna conversione arbitraria fra grammi, millilitri e pezzi. Per un prodotto personalizzato indica la base nutrizionale riportata in etichetta; per OFF la base segue i metadati e l’unità della confezione. Verifica le etichette per alimenti diluiti o preparati.
- I limiti sono numeri espliciti per porzione, non etichette mediche. Un limite che non può essere verificato impedisce l’accettazione della ricetta.
- Allergeni e tracce esplicitamente presenti escludono il prodotto. Una lista vuota e un dato assente non sono una dichiarazione di assenza: con una restrizione attiva l’app adotta una politica conservativa e li esclude, salvo dichiarazione esplicita compatibile.
- Vegetariano e vegano richiedono dichiarazioni o analisi degli ingredienti compatibili. «Senza lattosio» non significa «senza latte».

L’etichetta originale resta il riferimento per allergeni e dichiarazioni. Open Food Facts e FridgeBrain non forniscono certificazioni mediche.

## Smartphone e PWA

UI e navigazione restano invariate: Home, Inventario, Aggiungi, Ricette, Spesa; stesso design system su smartphone, tablet e desktop. Da HTTPS usa «Installa app» o «Aggiungi alla schermata Home». La fotocamera richiede HTTPS e il consenso del browser; l'inserimento manuale è sempre disponibile.

La PWA conserva soltanto risorse statiche. Pagine e dati personali richiedono il server e l'autenticazione; in assenza di collegamento compare «Connessione assente». Le vecchie copie personali della precedente versione vengono eliminate all'attivazione del nuovo service worker. Non c'è sincronizzazione differita. Dopo l'aggiornamento apri l'app con connessione disponibile su ciascun dispositivo per attivare il nuovo worker.

Se solo Open Food Facts è irraggiungibile, restano utilizzabili inventario, prodotti già in cache, prodotti manuali, spesa e calcoli. Un barcode mai recuperato richiede Internet dal server. Il provider ricette mantiene i propri requisiti di configurazione e disponibilità.

## Test e verifica

```bash
pnpm controlla
pnpm test
pnpm test:backup
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

I test riutilizzano le fixture dei 20 prodotti reali già presenti. OFF viene simulato con risposte e server HTTP locali: nessun test dipende dal servizio pubblico, dai file originali o da un catalogo generato. I test browser avviano l'app sulla porta 3100, OFF simulato sulla 3101 e usano `data/test-browser`, credenziali esclusivamente di prova e provider simulato. Lascia entrambe le porte libere. Coprono tre formati (390, 820 e 1440 px), scanner video, inventario, scadenze, spesa, ricette, errori, accessibilità, autenticazione e PWA.

Schermate in `data/verifica-visuale/`, tracce in `test-results/`, report in `playwright-report/`. Per una cucina dimostrativa separata: `pnpm exec tsx scripts/prepara_demo.ts`, poi avvia con `FRIDGEBRAIN_DATI=data/demo`. I valori dimostrativi sono sintetici; il tuo inventario non viene modificato.

## SQLite, migrazione e backup

Un solo database `fridgebrain.db` in modalità WAL contiene `inventario`, `prodotti_personalizzati`, `posizioni`, `spesa`, `impostazioni`, `ricette`, `storico`, `operazioni` e la nuova `cache_prodotti_off` (barcode, JSON prodotto, primo recupero, ultimo aggiornamento).

Lo schema versione 3 aggiunge la cache senza ricreare le tabelle personali. Esegui un backup prima dell'aggiornamento e mantieni lo stesso volume. Gli alimenti già posseduti conservano ingredienti, nutrienti e allergeni anche se non sono ancora presenti nella nuova cache. Non vengono importati automaticamente nella cache i dati del vecchio catalogo.

Backup consistente con app aperta:

```bash
python scripts/backup_dati.py --origine data/fridgebrain.db --destinazione data/backup/fridgebrain-copia.db
# Oppure dentro Docker, senza installare Python sul VPS:
docker compose exec fridgebrain python3 scripts/backup_dati.py --origine /app/data/fridgebrain.db --destinazione /app/data/backup/fridgebrain-copia.db
```

Scegli un nome nuovo ogni volta e copia il backup su un supporto diverso. Non copiare solo il file `.db` mentre l'app scrive: possono esserci transazioni nei file WAL. Per ripristinare, ferma l'app, conserva l'archivio attuale e metti il backup verificato in una nuova directory con nome `fridgebrain.db`, senza vecchi file WAL; configura la directory o il montaggio Docker e riavvia. I dati personali Docker sono in `data/personali/`; i certificati Caddy in `data/caddy/`.

## Struttura e design

```text
src/app/                    Pagina Next.js e API
src/proxy.ts                Protezione delle pagine
src/components/             Schermate e componenti condivisi
src/lib/tipi.ts             Contratti del dominio invariati
src/lib/database.ts         Schema SQLite e migrazione
src/lib/servizi.ts          Cache e operazioni applicative
src/lib/open-food-facts.ts  Client OFF e normalizzazione
src/lib/autenticazione.ts   Autenticazione dell'unico utente
src/lib/motore.ts           Nutrizione, regole e provider ricette invariati
scripts/                    Backup, demo, risorse e server test
tests/                      Test TypeScript, backup Python e browser
public/                     Manifest, service worker e icone
data/                       Dati persistenti, esclusi da Git e dall'immagine
```

Palette avorio, salvia, verde profondo, grafite, ambra e rosso tenue; caratteri di sistema, spaziatura su base 4 px, raggi moderati. [Design system](docs/design-system.md) e [contratto API](docs/contratto-api.md).

## Risoluzione dei problemi

| Problema                 | Azione                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Accesso 503              | Configura utente e password casuale di almeno 20 caratteri e ricrea il container        |
| Accesso 401              | Verifica credenziali; chiudi il profilo privato per scartare quelle memorizzate         |
| Certificato non emesso   | Controlla DNS A/AAAA, firewall 80/443, log Caddy e assenza di altri servizi sulle porte |
| Barcode assente          | Verifica il codice o crea il prodotto manualmente                                       |
| Errore OFF 429           | Attendi almeno un minuto; i prodotti già salvati restano disponibili                    |
| Errore OFF 502/503/504   | Controlla connessione in uscita, URL OFF e disponibilità del servizio, poi riprova      |
| Scrittura SQLite fallita | Verifica spazio libero e UID/GID della directory personale                              |
| Fotocamera negata        | Verifica HTTPS, permessi e altre applicazioni che usano la camera                       |
| Modifiche rifiutate 403  | Apri il dominio configurato; verifica origine HTTPS e riavvia dopo modifiche a .env     |
| UI vecchia               | Riapri online; se necessario cancella i dati del sito e accedi di nuovo                 |
| Ricette non disponibili  | Configura il provider locale oppure controlla quantità, scadenze e restrizioni          |

Diagnostica: `docker compose logs --tail 100 fridgebrain https`. Non pubblicare segreti o il contenuto del database nei log condivisi.

## Attribuzione e limiti

Prodotti e fixture provengono da [Open Food Facts](https://world.openfoodfacts.org/), banca dati [ODbL](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/). L'etichetta originale resta il riferimento per allergeni e nutrienti.

Restano esclusi multiutenza, PostgreSQL, OCR, riconoscimento visivo e sincronizzazione senza server. Nessuna migrazione sostanziale del provider AI. Il rilascio pubblico richiede il tuo dominio, VPS e credenziali: la repository prepara il deployment ma non crea un server né pubblica automaticamente un'istanza.
