# FridgeBrain

La tua cucina, in ordine: una PWA in italiano per ricordare cosa hai in casa, controllare le scadenze, preparare la spesa e creare ricette con i prodotti disponibili.

FridgeBrain gira sul tuo computer o server domestico. Dopo l’installazione e la preparazione del catalogo, le funzioni principali non richiedono Internet. Smartphone e tablet si collegano al server sulla rete di casa. Nessun account, servizio nutrizionale remoto o immagine di prodotto scaricata durante l’uso.

## Avvio rapido con Docker

Occorre Docker con il motore Linux avviato e Docker Compose. Su Windows avvia Docker Desktop. Il repository contiene già i dataset originali in `data/raw/`; non decomprimerli.

Se il catalogo `data/processed/foods.db` è già presente:

```bash
docker compose up -d
```

Apri [FridgeBrain](http://localhost:3000). Il primo avvio costruisce l’immagine e richiede Internet per le dipendenze; i successivi no. Il generatore creativo è inizialmente disabilitato, mentre tutte le altre funzioni sono disponibili.

Se il catalogo non è stato preparato:

```bash
docker compose build
docker compose run --rm importazione --campione
docker compose up -d
```

Il sample è piccolo e serve per sviluppo: riconosce solo i suoi 456 prodotti. Per l’utilizzo quotidiano prepara il dump completo con la procedura seguente. Anche senza catalogo puoi creare e usare prodotti personalizzati.

I dati personali Docker si trovano in `data/personali/fridgebrain.db`. Il catalogo si trova in `data/processed/foods.db`, montato in sola lettura nell’app. I dump e i database non vengono inclusi nell’immagine. Su Linux prepara le directory con un proprietario coerente con UID/GID del container: vedi [istruzioni Docker](docs/docker.md).

## Installazione e sviluppo senza Docker

Requisiti: Node.js 24 o successivo, Python 3.10 o successivo, pnpm 11.19.0. Python usa solo la libreria standard. Il driver SQLite è quello integrato in Node 24.

```bash
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
python scripts/costruisci_database_alimenti.py --campione
pnpm dev
```

Apri [localhost:3000](http://localhost:3000). Per personalizzare i percorsi o il provider, copia `.env.example` in `.env` e modifica i valori desiderati. Non è obbligatorio creare `.env` per l’avvio locale.

Avvio di produzione, necessario anche per verificare la PWA:

```bash
pnpm build
pnpm start
```

In esecuzione diretta i dati personali sono in `data/fridgebrain.db`. Le sessioni Docker, dimostrativa e di test hanno directory distinte per non mescolare i dati. Per passare da esecuzione diretta a Docker usa un backup consistente del database personale e ripristinalo come `data/personali/fridgebrain.db` a container fermo.

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

## Catalogo Open Food Facts

I file in `data/raw/` sono immutabili per la pipeline. L’importer identifica il sample dal file `.jsonl.gz` più piccolo e il dump completo dal più grande; puoi indicare un percorso esplicito. La lettura è streaming, con righe e blocchi limitati, senza salvare copie decompresse.

```bash
# Analisi della struttura e rigenerazione delle 20 fixture reali
python scripts/analizza_sample.py

# Catalogo di sviluppo
python scripts/costruisci_database_alimenti.py --campione

# Test importer prima dell’elaborazione completa
python -m unittest discover -s tests -p "test_*.py" -v
```

Per il dump completo, arresta l’app prima di sostituire il catalogo, specialmente su Windows:

```bash
docker compose stop fridgebrain
python scripts/costruisci_database_alimenti.py --completo
docker compose up -d
```

Oppure interamente in Docker:

```bash
docker compose stop fridgebrain
docker compose run --rm importazione --completo
docker compose up -d
```

Origine e destinazione esplicite:

```bash
python scripts/costruisci_database_alimenti.py --origine data/raw/nuovo-dump.jsonl.gz --destinazione data/processed/foods.db
```

L’importazione completa richiede tempo e spazio libero per il nuovo database, gli indici e il catalogo precedente. Ogni 50.000 record viene riportato l’avanzamento. La sostituzione avviene solo dopo la verifica di integrità; un gzip troncato o un import vuoto non distruggono il catalogo funzionante. Nessuna operazione dell’importer tocca `fridgebrain.db`. Dettagli e misure in [catalogo](docs/catalogo.md).

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

## Smartphone, PWA e assenza di Internet

La navigazione inferiore offre Home, Inventario, Aggiungi, Ricette e Spesa. Tablet e desktop usano lo stesso design system con una composizione più ampia. I controlli sono utilizzabili da tastiera e le scadenze hanno sempre un’indicazione testuale.

La PWA include manifest, icone locali e service worker in produzione. Usa **Installa app** o **Aggiungi alla schermata Home** nel browser. Fotocamera, service worker e installazione su smartphone richiedono HTTPS affidabile; `http://localhost` è ammesso sul computer stesso. Un semplice indirizzo `http://192.168...` permette l’inserimento manuale, ma non garantisce lo scanner o l’installazione. La procedura HTTPS domestica è in [Docker e HTTPS](docs/docker.md).

**Senza Internet, con server e rete domestica disponibili:** inventario, scanner, catalogo, scadenze, spesa, nutrienti e modello già installato funzionano normalmente. Font, icone e libreria barcode sono locali.

**Senza collegamento al server domestico:** dopo un accesso riuscito in produzione, il service worker conserva l’interfaccia e l’ultima copia di inventario, spesa e ricette. La UI indica chiaramente data e modalità di consultazione. Le modifiche richiedono il server; non esiste una coda di sincronizzazione che rischi di duplicare consumi. Al ritorno della connessione la copia viene aggiornata. La cache contiene dati personali: usa un profilo browser privato su dispositivi condivisi e cancella i dati del sito per rimuoverla.

## Test e verifica

```bash
pnpm controlla
pnpm test:importazione
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

La suite browser richiede la build già creata con `pnpm build`: prepara automaticamente `data/processed/foods-sample.db` dal sample e avvia il server sulla porta 3100. Usa il database isolato `data/test-browser`, il generatore simulato e tre formati: smartphone (390 px), tablet (820 px), desktop (1440 px). Copre barcode reali, decodifica video con ZXing, prodotti manuali, scadenze, scorte, consumo, spesa, preferenze, ricette, PWA dal primo accesso, blocco delle modifiche offline, ritorno della connessione, risposte perse e accessibilità con axe e tastiera. Non sostituisce il catalogo completo. Puoi indicare l’eseguibile Python tramite `FRIDGEBRAIN_PYTHON`.

Le schermate di verifica sono in `data/verifica-visuale/`; immagini degli errori e tracce in `test-results/`; il report navigabile è in `playwright-report/`.

Per una cucina dimostrativa separata:

```bash
pnpm exec tsx scripts/prepara_demo.ts
```

Imposta `FRIDGEBRAIN_DATI=data/demo` prima di avviare l’app. Lo script non modifica il catalogo o l’inventario reale e non sovrascrive una demo esistente. I prodotti e i valori della demo sono dichiaratamente sintetici.

## Database e backup

| Archivio | Contenuto | Politica |
| --- | --- | --- |
| `data/processed/foods.db` | Prodotti OFF, indice barcode, ricerca FTS5, metadati | Rigenerabile, sola lettura nell’app |
| `data/fridgebrain.db` | Dati personali nell’avvio diretto | Persistente, SQLite WAL |
| `data/personali/fridgebrain.db` | Dati personali nell’avvio Docker | Persistente, montaggio scrivibile |
| `data/demo/`, `data/test-browser/` | Anteprima e test | Separati dai dati reali |

Il database personale contiene tabelle italiane: `inventario`, `prodotti_personalizzati`, `posizioni`, `spesa`, `impostazioni`, `ricette`, `storico`, `operazioni`. Ogni voce dell’inventario conserva una copia del prodotto: la rigenerazione del catalogo non modifica ciò che possiedi.

Backup consistente anche con app aperta:

```bash
python scripts/backup_dati.py --origine data/fridgebrain.db --destinazione data/backup/fridgebrain-2026-09-18.db
# Per Docker usare --origine data/personali/fridgebrain.db
```

Scegli un nome nuovo per ogni backup; lo script non sovrascrive backup esistenti. Copia poi il file su un supporto diverso. In alternativa arresta completamente il server e salva il database personale insieme a eventuali file `-wal` e `-shm`: non copiare soltanto `.db` mentre l’app sta scrivendo.

Per ripristinare, arresta il server, conserva i dati attuali in una cartella di sicurezza e metti il backup verificato in una **nuova** directory con nome `fridgebrain.db`. Imposta `FRIDGEBRAIN_DATI` su quella directory, oppure usa la directory montata da Docker. Non affiancare al database ripristinato vecchi file WAL. Riavvia e verifica inventario e storico. `foods.db` non è indispensabile nel backup.

## Struttura

```text
src/app/                    Pagina Next.js e API
src/components/             Schermate e componenti italiani condivisi
src/lib/tipi.ts             Contratti del dominio
src/lib/database.ts         Connessioni e schema SQLite
src/lib/servizi.ts          Validazione e operazioni applicative
src/lib/motore.ts           Nutrizione, regole e provider ricette
scripts/                    Importazione, analisi, backup e demo
tests/                      Test Python, TypeScript e browser
public/                     Manifest, service worker e icone locali
docs/                       Design system, catalogo, API e Docker
data/                       Originali e dati persistenti, esclusi da Git
```

Design system: avorio, bianco, salvia, verde profondo, grafite, ambra e rosso tenue; caratteri di sistema; spaziatura su base 4 px; raggi moderati; icone outline e liste con separatori. [Decisioni visuali](docs/design-system.md) e [contratto API](docs/contratto-api.md).

## Risoluzione dei problemi

| Problema | Azione |
| --- | --- |
| Docker non si connette al motore | Avvia Docker Desktop in modalità container Linux e verifica `docker info` |
| Catalogo non disponibile | Genera `foods.db` e controlla `FRIDGEBRAIN_CATALOGO` / montaggio in sola lettura |
| Barcode assente | Il sample ha copertura limitata; prepara il dump completo o crea il prodotto personalizzato |
| Database bloccato durante sostituzione | Arresta i processi Node e il container che tengono aperto il catalogo, poi ripeti l’import |
| Fotocamera negata o assente | Controlla permessi, HTTPS e altre applicazioni che usano la camera; il codice manuale è sempre disponibile |
| Nessun ingrediente utilizzabile | Registra quantità totali in g/ml coerenti, controlla scadenze e dichiarazioni richieste dalle restrizioni |
| Nessuna ricetta conforme | Controlla disponibilità e limiti numerici; dati sconosciuti non possono verificare un limite |
| Modello locale non risponde | Avvia Ollama, verifica modello installato e indirizzo locale, poi riavvia l’app |
| UI vecchia dopo aggiornamento | Ricarica con rete locale disponibile; se necessario cancella la cache del sito e riapri |
| Porta occupata | Cambia `FRIDGEBRAIN_PORTA` in Docker oppure usa `pnpm start --port 3001` |

Diagnostica Docker: `docker compose logs --tail 100 fridgebrain`. Le API restituiscono messaggi in italiano e non espongono dettagli del database. Il server è progettato per una rete domestica fidata; non pubblicarlo su Internet. Docker espone inizialmente solo `127.0.0.1`.

## Attribuzione e versioni future

Il catalogo e le fixture reali provengono da [Open Food Facts](https://world.openfoodfacts.org/), la cui banca dati è distribuita sotto [ODbL](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/). Gli originali e i dati personali non vengono aggiunti a Git.

Esclusi dalla V1 come da `SPEC.md`: OCR di scadenze/ingredienti/nutrienti, riconoscimento visivo o scontrini, aggiornamenti automatici del catalogo, account e sincronizzazione cloud, accesso pubblico, app native, analisi avanzate dei consumi e previsione degli acquisti. Le posizioni sono modellate in una tabella estensibile; nuovi provider ricette possono implementare la stessa interfaccia senza assumere compiti deterministici.
