# Verifica reale di Docker

Verifiche eseguite il 18 settembre 2026 su Windows con Docker Desktop 4.91.0, Docker Engine Linux 29.8.0 e Docker Compose 5.5.1. Le prove hanno utilizzato dati dedicati in `data/test-docker/verifica-20260918/`, esclusi da Git, senza modificare l'inventario personale o gli originali in `data/raw/`.

## Immagine e configurazione

- `docker compose config --quiet`: superato.
- Prima build completa con dipendenze del lockfile: superata; compilazione Next.js nel contenitore in circa 8,6 secondi.
- Contesto della prima build: circa 243 KB. Dataset, database, dipendenze del computer e artefatti locali sono esclusi da `.dockerignore`.
- Prima immagine verificata: 447.982.293 byte; processo applicativo eseguito come utente `node`, non come amministratore.
- Montaggi verificati tramite `docker inspect`: `/app/data` in lettura/scrittura e `/app/catalogo` in sola lettura.
- Avvio Compose in progetto di prova separato, porta HTTP `127.0.0.1:3200`, con attesa del controllo di salute: superato.

## Flussi applicativi nel contenitore

| Controllo | Risultato |
| --- | --- |
| Pagina principale, manifest, service worker e icona PWA | HTTP 200 |
| Salute e disponibilità del catalogo | Corrette |
| 20 barcode delle fixture ricavate dal sample | Codice, nome e nutrienti identici ai dati attesi |
| 20 lookup consecutivi tramite HTTP dal computer | 310 ms complessivi, inclusi parsing e confronti |
| Aggiunta prodotto del catalogo | Prodotto e quantità corretti |
| Cambio posizione e consumo parziale | Quantità finale 400 g, posizione Freezer |
| Creazione prodotto personalizzato e nuovo lookup | Corretti |
| Aggiunta e completamento della spesa | Corretti |
| Preferenze alimentari | Salvate e rilette |
| Richiesta ricetta con provider disabilitato | HTTP 503 con errore esplicito, altre funzioni operative |
| Riavvio del contenitore | Inventario, spesa e preferenze conservati |
| Rimozione del solo catalogo di prova | Inventario e personalizzati conservati; lookup OFF HTTP 503 |
| Ripristino del catalogo di prova | Catalogo nuovamente disponibile senza interventi sul database personale |

La prima richiesta immediatamente successiva a `docker restart` è arrivata prima che il server fosse pronto; ripetuta dopo la disponibilità del servizio, la verifica di persistenza è passata. L'avvio operativo usa `docker compose up -d --wait` quando occorre attendere la disponibilità prima di eseguire altri comandi.

## Esecuzione senza rete

Un secondo contenitore è stato avviato con `--network none`, catalogo sample in sola lettura e archivio personale distinto. `docker inspect` conferma rete `none`, nessun indirizzo IP e nessun gateway. Le richieste di prova sono state eseguite con `docker exec` verso l'interfaccia locale del contenitore.

Sono passati pagina HTML, risorse PWA, 20 lookup esatti, creazione di personalizzati, inventario, posizioni, consumo, spesa e preferenze. I 20 lookup hanno richiesto complessivamente 102 ms nell'ambiente di prova.

Il provider simulato è stato abilitato esplicitamente soltanto nel contenitore di test. La ricetta prodotta ha restituito 120 kcal e 7 g di proteine per porzione, calcolati dai nutrienti del prodotto di prova; la preparazione ha ridotto l'inventario da 300 a 200 g. Non è stata necessaria alcuna connessione Internet né un modello installato.

## Importazione nel contenitore senza rete

L'importer Python incluso nell'immagine è stato eseguito in un contenitore temporaneo con `--network none`, `data/raw/` montata in sola lettura e destinazione dedicata all'esperimento.

| Misura del sample | Risultato |
| --- | ---: |
| Dimensione gzip originale | 1.414.002 byte |
| Record analizzati | 485 |
| Prodotti importati | 456 |
| Record ignorati, senza nome | 29 |
| Record malformati | 0 |
| Prodotti con nutrienti | 105 |
| Prodotti con ingredienti | 139 |
| Prodotti con allergeni | 84 |
| Tempo dichiarato dall'importer | 0,396 s |
| Database generato | 1.372.160 byte |

Non sono state create copie complete decompresse. La prova riguarda il sample; la verifica del dump completo viene documentata separatamente.

## HTTPS locale

Il profilo Caddy è stato avviato con porta di prova `127.0.0.1:3443` e dati della CA separati. Il certificato per `localhost` è stato emesso dalla CA interna. Una richiesta Node.js con il certificato pubblico della CA indicato esplicitamente ha verificato il certificato del server (`authorized: true`) e negoziato TLS 1.3. Sono passati lettura della salute, creazione/eliminazione di una voce spesa tramite origine HTTPS autorizzata e rifiuto HTTP 403 di un'origine esterna.

Non è stato modificato l'archivio delle autorità fidate di Windows. `curl` con backend Schannel richiede di disabilitare il solo controllo di revoca per questa CA privata priva di CRL (`--ssl-no-revoke`), mantenendo il controllo del certificato con `--cacert`; la verifica principale Node.js non disabilita la validazione TLS. L'installazione della CA e l'accesso da telefoni fisici restano operazioni del dispositivo, descritte in [Avvio con Docker](docker.md).

## Backup e dati dimostrativi

Il backup del database personale del contenitore è stato eseguito mentre il servizio era attivo, usando `scripts/backup_dati.py`. La copia supera `PRAGMA integrity_check` e conserva entrambe le voci d'inventario e le quantità attese.

Sono stati aggiunti ed eseguiti quattro test Python in `tests/test_backup.py`: inclusione dei dati WAL con archivio aperto, indipendenza della copia dalle modifiche successive, rifiuto di sovrascrivere una copia esistente, gestione dell'origine assente e di un archivio corrotto senza lasciare backup parziali. Esito: **4 test passati**.

Il test `tests/demo.test.ts` esegue realmente `prepara_demo.ts` in una cartella temporanea: **1 test passato**. Verifica quattro prodotti e voci d'inventario, due elementi della spesa, le tre posizioni iniziali, nessuna modifica al catalogo e nessun database nell'area personale. Una seconda esecuzione conserva il database dimostrativo senza modificarlo.

## Limiti delle prove

I tempi sono misure indicative su questa macchina, non benchmark universali. Il test di ricette senza rete usa il provider simulato esplicitamente dichiarato; non misura un modello Ollama reale. La disponibilità delle risorse PWA via HTTP non sostituisce le prove browser di installabilità e comportamento offline, documentate con la verifica applicativa generale.
