# Contratto applicativo

Next.js App Router, Node 24, `node:sqlite`; tipi condivisi in `src/lib/tipi.ts`.
Risposte JSON dirette; errori `{errore: string}`, stato HTTP coerente. Nessun accesso remoto salvo provider LLM locale esplicitamente configurato.

- `GET /api/stato` → StatoApplicazione.
- `GET /api/prodotti?codice=...` → Prodotto; 404 se assente, 503 catalogo mancante (cercare prima personalizzati).
- `GET /api/prodotti?q=...` → Prodotto[] massimo 30.
- `POST /api/prodotti` → prodotto personalizzato; corpo Prodotto, validazione server.
- `POST /api/inventario` → VoceInventario; corpo `{codice, confezioni, quantita, unita, posizione, scadenza}`. Quantità totale residua misurata in g/ml/pz, opzionale; non per confezione. Il prodotto viene copiato in snapshot nel database personale.
- `PATCH /api/inventario/:id` → voce; campi confezioni, quantita, unita, posizione, scadenza.
- `DELETE /api/inventario/:id` → `{ok:true}`; storico eliminazione.
- `POST /api/inventario/:id/consuma` → `{ok:true}`; corpo `{quantita?:number}`, assente consuma intero; consumo parziale richiede quantità misurata.
- `POST /api/spesa` corpo `{nome,quantita}` → VoceSpesa.
- `PATCH /api/spesa/:id` corpo `{completato?,nome?,quantita?}` → voce.
- `DELETE /api/spesa/:id` → `{ok:true}`.
- `PUT /api/preferenze` corpo Preferenze → preferenze.
- `POST /api/ricette` corpo RichiestaRicetta → Ricetta; richiede provider configurato, non abilita simulazione implicitamente.
- `POST /api/ricette/:id/prepara` → `{ok:true}`; rilegge inventario e valida transazionalmente quantità, scadenze e restrizioni, impedisce doppio consumo.
- `GET /api/storico` → EventoStorico[] ultimi 200.
- `GET /api/salute` → `{ok:true,catalogo_disponibile:boolean}`.

Il motore in `src/lib/motore.ts` espone `generaRicettaVerificata(inventario, richiesta, configurazione?)`: restituisce la proposta con nutrizione, avvisi, nomi degli ingredienti e provider. `validaRicetta(proposta,inventario,richiesta)` verifica quantità, scadenze e restrizioni oppure solleva un errore. Il backend salva la richiesta insieme alla ricetta per rivalidarla prima del consumo.

`POST /api/prodotti`, `POST /api/inventario`, `POST /api/spesa` e il consumo inventario accettano `Idempotency-Key`: una ripetizione con la stessa chiave e gli stessi dati restituisce l’esito già registrato. Il riutilizzo con dati diversi restituisce 409. Il client conserva la chiave durante i tentativi della stessa operazione; una nuova aggiunta intenzionale usa una nuova chiave.

Il campo inventario facoltativo `scorta_minima` è una quantità positiva nella stessa unità del residuo. `null` disattiva l’avviso; la soglia richiede una quantità residua misurata. Lo schema personale versione 2 aggiunge la colonna senza ricreare tabelle o cancellare dati. Il catalogo OFF rimane alla versione 1.

Sono disponibili anche gli elenchi `GET /api/inventario`, `/api/spesa`, `/api/ricette`, `/api/preferenze`, `/api/posizioni`; i dettagli inventario e ricetta per identificatore; modifica/eliminazione prodotti personalizzati; eliminazione ricette; aggiunta e rimozione delle posizioni aggiuntive. Le tre posizioni iniziali sono protette. Le API usano JSON, corpi limitati a 128 KiB e controlli di origine per le modifiche; gli header proxy non autorizzano automaticamente nuove origini.
Configurazione da ambiente: FRIDGEBRAIN_DATI (default data), FRIDGEBRAIN_CATALOGO (default data/processed/foods.db), FRIDGEBRAIN_GENERATORE (disabilitato|locale|simulato), FRIDGEBRAIN_OLLAMA_URL, FRIDGEBRAIN_MODELLO. Provider simulato esclusivamente sviluppo/test, esplicitamente etichettato. Frontend riporta stato server.
