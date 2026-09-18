# Avvio con Docker

Il progetto usa un'immagine costruita in più fasi: Node.js 24 compila Next.js, mentre l'immagine finale contiene soltanto l'applicazione standalone, le risorse locali e Python per l'importazione del catalogo. Il gestore pnpm 11.19.0 usa il lockfile con `--frozen-lockfile`. I dump, i database e le dipendenze installate sul computer sono esclusi dal contesto di build tramite `.dockerignore`.

## Prerequisiti

- Docker Engine con Docker Compose oppure Docker Desktop con contenitori Linux avviato.
- Internet per il primo download delle immagini e delle dipendenze durante la build. Dopo la preparazione, l'uso dell'applicazione e l'importazione funzionano senza Internet.
- Spazio per immagini, catalogo e database personale.
- Per il riconoscimento dei prodotti, un `foods.db` generato dal sample o dal dump; l'applicazione si avvia anche senza catalogo e permette prodotti personalizzati.

Su Windows verificare che Docker Desktop usi il motore Linux/WSL 2. Il comando `docker version` deve mostrare sia Client sia Server. L'errore relativo a `dockerDesktopLinuxEngine` indica solitamente che il motore non è ancora avviato.

## Avvio ordinario

Dalla radice del repository:

```bash
docker compose up -d
docker compose ps
```

La prima esecuzione costruisce l'immagine. Aprire [FridgeBrain locale](http://localhost:3000). Il controllo di salute interroga `/api/salute`; il catalogo assente non rende indisponibile l'app.

Il servizio predefinito pubblica la porta soltanto su `127.0.0.1`. Per fermarlo: `docker compose stop`. Per rimuovere il contenitore senza perdere i dati: `docker compose down`.

Su Linux preparare le directory prima dell'avvio e assegnarle all'utente che esegue FridgeBrain:

```bash
mkdir -p data/personali data/processed
```

I valori predefiniti del processo sono UID e GID 1000. Se l'utente locale usa identificativi diversi, impostare `FRIDGEBRAIN_UID` e `FRIDGEBRAIN_GID` nel file `.env` ai valori restituiti da `id -u` e `id -g`. Le directory devono essere scrivibili da questo utente. Docker Desktop gestisce la condivisione dei percorsi Windows senza richiedere `chown`.

## Archivi e persistenza

| Dato sul computer | Percorso nel contenitore | Accesso dell'app |
| --- | --- | --- |
| `data/personali/fridgebrain.db` | `/app/data/fridgebrain.db` | Lettura e scrittura |
| `data/processed/foods.db` | `/app/catalogo/foods.db` | Sola lettura |
| `data/raw/*.jsonl.gz` | Non montato nell'app | Nessuno |

L'esecuzione Docker usa `data/personali`, mentre lo sviluppo locale usa per impostazione iniziale `data/fridgebrain.db`. Questa separazione evita che due server modifichino contemporaneamente lo stesso inventario. Per trasferire un inventario esistente, fermare entrambi i server e copiare il database con gli eventuali file `-wal` e `-shm` nella cartella scelta. Non avviare contemporaneamente due processi contro lo stesso archivio durante una migrazione.

Per il backup fermare il servizio e salvare tutta `data/personali/`, quindi riavviare. `foods.db` è rigenerabile e non serve nel backup essenziale. Ricostruire l'immagine non modifica questi dati.

## Preparazione del catalogo dentro Docker

Lo strumento di importazione condivide l'immagine dell'applicazione, ma è escluso dall'avvio ordinario tramite il profilo `strumenti`. Ha il dump montato in sola lettura e nessuna rete. Dopo la prima build:

```bash
docker compose run --rm importazione --campione
```

Dopo aver verificato il sample, per preparare il catalogo completo:

```bash
docker compose stop fridgebrain
docker compose run --rm importazione --completo
docker compose up -d
```

È possibile usare un file specifico:

```bash
docker compose run --rm importazione --origine /app/data/raw/nuovo-dump.jsonl.gz
```

Il servizio importa in `/app/data/processed/foods.db`, cioè `data/processed/foods.db` sul computer. Non può accedere al database personale. Gli originali restano compressi e non vengono modificati. Per dettagli e test vedere [Catalogo alimentare](catalogo.md).

## Modello locale facoltativo

In `.env` impostare:

```dotenv
FRIDGEBRAIN_GENERATORE=locale
FRIDGEBRAIN_OLLAMA_DOCKER_URL=http://host.docker.internal:11434
FRIDGEBRAIN_MODELLO=qwen3:8b
```

Ollama e il modello scelto devono essere già installati e raggiungibili dal contenitore. L'indirizzo `host.docker.internal` è configurato anche per Docker Engine Linux. Ollama deve accettare connessioni dall'interfaccia locale raggiunta da Docker; limitarne l'accesso alla rete fidata. Applicare le modifiche con `docker compose up -d`. La modalità predefinita `disabilitato` lascia operative tutte le funzioni principali.

## Rete domestica, fotocamera e PWA

Per l'accesso da altri dispositivi si può impostare `FRIDGEBRAIN_INDIRIZZO` all'indirizzo della scheda di rete locale. Non configurare inoltri di porta sul router. Fotocamera, service worker e installazione PWA richiedono un contesto sicuro: `localhost` sul computer oppure HTTPS con certificato attendibile sui telefoni. La semplice apertura di un indirizzo IP HTTP da smartphone non abilita queste API del browser.

Un reverse proxy HTTPS locale può inoltrare al servizio sulla porta 3000. Aggiungere l'origine completa, per esempio `https://fridgebrain.casa`, a `FRIDGEBRAIN_ORIGINI`, separando più origini con virgole. Se si cambia la porta HTTP, aggiornare anche le origini corrispondenti. Non serve alcun servizio cloud.

### Procedura HTTPS locale inclusa

Il profilo facoltativo `https` avvia Caddy e il `Caddyfile` del repository. `tls internal` genera i certificati con un'autorità locale, senza ACME, account o DNS pubblico; sui dispositivi va installato il certificato pubblico dell'autorità. [Documentazione Caddy](https://caddyserver.com/docs/automatic-https#local-https).

1. Individuare l'indirizzo privato del computer nella rete domestica (`ipconfig` su Windows), per esempio `192.168.1.50`. È consigliabile mantenere questo indirizzo stabile nelle impostazioni DHCP del router.
2. Creare `.env` da `.env.example` e impostare i valori seguenti, sostituendo l'IP di esempio con quello reale:

```dotenv
FRIDGEBRAIN_DOMINIO_HTTPS=192.168.1.50
FRIDGEBRAIN_HTTPS_INDIRIZZO=192.168.1.50
FRIDGEBRAIN_HTTPS_PORTA=8443
FRIDGEBRAIN_ORIGINI=http://localhost:3000,http://127.0.0.1:3000,https://192.168.1.50:8443
```

3. Avviare il profilo e copiare il certificato pubblico:

```bash
docker compose --profile https up -d
docker compose cp https:/data/caddy/pki/authorities/local/root.crt data/fridgebrain-ca.crt
```

4. Trasferire soltanto `data/fridgebrain-ca.crt` al telefono, per esempio via cavo. Non trasferire `root.key` né la cartella `data/caddy`, che contiene le chiavi dell'autorità locale.
5. Su Android, aprire **Impostazioni → Sicurezza e privacy → Altre impostazioni di sicurezza → Crittografia e credenziali → Installa un certificato → Certificato CA**, quindi selezionare il file. I nomi possono variare per produttore. [Guida Google](https://support.google.com/pixelphone/answer/2844832?hl=it).
6. Su iPhone/iPad, aprire il certificato, installare il profilo nelle impostazioni e abilitare esplicitamente l'attendibilità in **Impostazioni → Generali → Info → Impostazioni attendibilità certificati** per l'autorità Caddy. L'installazione del profilo da sola non abilita necessariamente la fiducia SSL. [Guida Apple](https://support.apple.com/it-it/102390).
7. Collegare il telefono alla stessa rete Wi-Fi e aprire `https://192.168.1.50:8443`. Verificare che il browser non mostri errori di certificato; quindi consentire la fotocamera quando richiesta e aggiungere FridgeBrain alla schermata Home dal browser.

Se il firewall del computer blocca la porta, consentire TCP 8443 soltanto sulla rete privata domestica. Non aprire porte del router. Il file `Caddyfile` non pubblica automaticamente HTTP né contatta servizi per ottenere certificati. La CA persiste in `data/caddy/`; cancellarla richiederebbe installare il nuovo certificato sui telefoni. Il profilo HTTPS non viene avviato da `docker compose up -d` senza `--profile https`.

## Diagnostica e aggiornamenti

```bash
docker compose config
docker compose logs --tail=100 fridgebrain
docker compose exec fridgebrain node -e "fetch('http://127.0.0.1:3000/api/salute').then(risposta=>risposta.json()).then(console.log)"
docker compose up -d --build
```

- `permission denied` sul database: verificare proprietario e permessi di `data/personali` e UID/GID configurati.
- Catalogo indisponibile: controllare `data/processed/foods.db` e i log dell'importazione.
- Porta occupata: impostare `FRIDGEBRAIN_PORTA` a una porta libera e aggiornare `FRIDGEBRAIN_ORIGINI`.
- Provider locale irraggiungibile: verificare URL Docker, modello installato e ascolto di Ollama sulla rete locale.
- Motore Docker non raggiungibile: avviare Docker Desktop, attendere lo stato operativo e ripetere `docker version`.

Durante la preparazione su questa macchina è stato avviato Docker Desktop senza reset o modifiche distruttive. Il motore Linux risponde correttamente: Docker Engine 29.8.0, Docker Desktop 4.91.0, Compose 5.5.1. La verifica della build e dell'avvio dell'applicazione viene eseguita dopo il completamento delle schermate.
