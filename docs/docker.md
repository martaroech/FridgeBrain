# Deployment pubblico con Docker e Caddy

## Preparazione Linux/VPS

1. Installa Docker Engine con Compose e copia la repository sul server.
2. Configura un nome DNS, ad esempio `cucina.example.org`, verso l'IP pubblico del VPS. Se pubblichi un record AAAA anche IPv6 deve raggiungere il server.
3. Consenti TCP 80 e 443 nel firewall. Non esporre 3000 né la porta Ollama.
4. Copia `.env.example` in `.env`. Imposta dominio senza protocollo, utente, password casuale (almeno 20 caratteri) e User-Agent OFF con contatto reale. Non aggiungere `.env` a Git.
5. Prepara i volumi:

```bash
mkdir -p data/personali data/caddy/data data/caddy/config
sudo chown -R 1000:1000 data/personali
chmod 600 .env
docker compose up -d --build
docker compose ps
```

Il UID/GID della directory personale deve coincidere con `FRIDGEBRAIN_UID` e `FRIDGEBRAIN_GID`. Copia un eventuale backup esistente in `data/personali/fridgebrain.db` **prima dell'avvio**, senza vecchi WAL. L'app aggiunge automaticamente la tabella cache preservando i dati personali.

Apri il dominio HTTPS dal telefono e inserisci le credenziali nella richiesta del browser. Puoi installare la PWA e concedere il permesso della fotocamera. Il dominio deve essere pubblico e raggiungibile: un nome di esempio non può ottenere un certificato valido. [Requisiti HTTPS automatico Caddy](https://caddyserver.com/docs/automatic-https).

## Architettura e persistenza

Caddy è il punto d'ingresso pubblico, con redirect HTTP→HTTPS, certificati automatici e HSTS. L'app ascolta su 3000 nella rete privata Compose, senza porta pubblicata sull'host. L'autenticazione viene comunque verificata anche dall'app. Caddy non registra le credenziali nei log di accesso: non è abilitato un access log dedicato.

| Directory host      | Destinazione       | Contenuto                                     |
| ------------------- | ------------------ | --------------------------------------------- |
| `data/personali`    | `/app/data`        | SQLite personale, cache OFF, eventuali backup |
| `data/caddy/data`   | `/data` di Caddy   | Certificati e stato TLS                       |
| `data/caddy/config` | `/config` di Caddy | Configurazione persistente Caddy              |

L'immagine usa Node 24, build Next standalone e utente non privilegiato. Python resta disponibile solo per il backup consistente. Dipendenze installate con lockfile pnpm; dati, segreti, fixture e dump esclusi dal contesto tramite `.dockerignore`. Una ricostruzione dell'immagine non cancella i volumi.

Il processo risponde a `/api/salute` senza esporre dati personali. Per verificare la configurazione autenticata, apri anche la Home: la salute del processo da sola non prova la correttezza delle credenziali.

## Aggiornamento, credenziali e backup

Prima dell'aggiornamento esegui un backup con nome nuovo:

```bash
docker compose exec fridgebrain python3 scripts/backup_dati.py --origine /app/data/fridgebrain.db --destinazione /app/data/backup/prima-aggiornamento.db
docker compose up -d --build
```

Per cambiare password modifica `.env` e usa `docker compose up -d --force-recreate fridgebrain`. Le credenziali precedenti non saranno più accettate. Basic non prevede un logout applicativo: usa un profilo privato su dispositivi condivisi. Non pubblicare un avvio Node HTTP su Internet.

Salva altrove i backup verificati e conserva `.env` e stato Caddy in un luogo protetto. Per ripristinare arresta l'app, conserva la directory attuale e usa una nuova directory personale contenente il backup rinominato `fridgebrain.db`; non riutilizzare WAL precedenti. Riavvia e controlla inventario e storico.

## Provider ricette invariato

Per Ollama sullo stesso VPS usa `FRIDGEBRAIN_GENERATORE=locale` e `FRIDGEBRAIN_OLLAMA_DOCKER_URL=http://host.docker.internal:11434`; l'host deve accettare connessioni dalla rete Docker. Proteggi la porta dal traffico pubblico. Il modello deve già essere installato e compatibile con le risorse disponibili. L'app non richiede Ollama per inventario, scanner, spesa o nutrienti.

## Diagnostica

`docker compose logs --tail 100 fridgebrain https` mostra errori di avvio e TLS. Per certificati controlla DNS, porte occupate e firewall; per SQLite controlla permessi e spazio libero. Le API OFF richiedono DNS e uscita HTTPS dal container. Non cambiare `FRIDGEBRAIN_OFF_URL` in produzione. Dopo il rilascio apri online l'app su ciascun dispositivo per eliminare tramite il nuovo service worker le copie personali della vecchia versione.
