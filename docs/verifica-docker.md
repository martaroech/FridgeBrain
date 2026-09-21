# Verifica Docker della migrazione

La configurazione corrente usa Caddy pubblico su 80/443 e app sulla sola rete interna. Le precedenti prove con catalogo montato e certificati domestici non descrivono più questa versione.

Collaudo eseguito il 21 settembre 2026 con Docker Desktop Linux: build standalone riuscita, configurazione Compose valida, Caddy su porte di prova loopback 3080/3443 e certificato locale per localhost. Verificati redirect HTTP→HTTPS, rifiuto anonimo 401 di pagina/API, autenticazione corretta, rifiuto di origine estranea 403, recupero HTTP da OFF simulato, inserimento inventario e UI in tre formati. Dopo arresto del servizio OFF simulato e riavvio dell'app, cache e inventario sono rimasti disponibili; un barcode nuovo ha restituito 503. Backup SQLite dal container riuscito. I contenitori di prova sono stati rimossi conservando gli artefatti in `data/verifica-migrazione/`.

Procedura riproducibile: configurare `.env`, eseguire `docker compose config --quiet`, costruire l'immagine, avviare Compose e controllare salute, risposta 401 anonima, accesso autenticato e persistenza dopo riavvio. Le API personali richiedono autenticazione anche accedendo direttamente al processo Node. Per una verifica locale isolata si possono sovrascrivere dominio con `localhost`, porte con valori loopback e directory con archivi di prova; in questo caso il certificato locale non è pubblico.

Il collaudo pubblico richiede un dominio reale raggiungibile sulle porte 80/443. Vedere [deployment](docker.md). I dati persistono solo nel volume personale e nei volumi Caddy, mai nell'immagine.
