# Contratto del client locale

Le schermate conservano `chiamaApi<T>(percorso, metodo?, corpo?, chiave?)`, ma non viene eseguito alcun HTTP verso FridgeBrain. `src/lib/api.ts` traduce gli identificatori storici `/api/...` in metodi asincroni di `ArchivioFridgeBrain`, su IndexedDB. Non esistono route API Next.js, autenticazione o processo applicativo remoto. I tipi in `src/lib/tipi.ts` sono preservati.

| Identificatore interno | Risultato |
| --- | --- |
| `GET /api/stato` | StatoApplicazione consistente in una transazione di lettura |
| `GET /api/prodotti?codice=...` | Prodotto locale o recuperato direttamente da OFF |
| `GET /api/prodotti?q=...` | Fino a 30 prodotti locali |
| `POST /api/prodotti` | Crea prodotto personalizzato validato |
| `PATCH/DELETE /api/prodotti/:codice` | Modifica/elimina personalizzato senza alterare snapshot |
| `GET/POST /api/inventario` | Elenco o aggiunta con snapshot prodotto |
| `GET/PATCH/DELETE /api/inventario/:id` | Dettaglio, modifica o eliminazione con storico |
| `POST /api/inventario/:id/consuma` | Consumo parziale `{quantita}` o totale con corpo vuoto |
| `GET/POST /api/spesa` | Elenco o aggiunta `{nome,quantita}` |
| `PATCH/DELETE /api/spesa/:id` | Spunta, modifica o eliminazione |
| `GET/PUT /api/preferenze` | Legge/salva Preferenze |
| `GET/POST /api/posizioni` | Elenco o aggiunta `{nome}` |
| `DELETE /api/posizioni/:nome` | Rimuove posizione vuota aggiuntiva |
| `GET /api/ricette`, `GET/DELETE /api/ricette/:id` | Ricette salvate e dettaglio |
| `POST /api/ricette` | Disabilitato nella build Pages; provider iniettabile nei test |
| `POST /api/ricette/:id/prepara` | Rivalida e consuma atomicamente una sola volta |
| `GET /api/storico` | Ultimi 200 eventi |

Gli errori sono eccezioni con messaggi italiani e, quando applicabile, il codice numerico precedente (`ErroreApplicazione.stato`), senza risposta HTTP. Creazioni e consumi accettano una chiave di operazione; stessa chiave e stessi dati riutilizzano il risultato, dati differenti producono conflitto. Le ricevute e le modifiche vengono scritte insieme.

Quantità totale residua in g/ml/pz, indipendente dal numero di confezioni. `scorta_minima` positiva nella stessa unità; `null` la disattiva. Scadenze per giorno civile e posizioni verificate. Gli ID sono interi positivi. `catalogo_disponibile` resta `true` per compatibilità, senza promettere disponibilità della rete.

Il motore nutrizionale e `validaRicetta` restano deterministici. Una ricetta salva anche la richiesta iniziale e viene rivalidata rispetto alle preferenze correnti prima del consumo. Generazione Pages disabilitata, provider locale e simulato conservati per sviluppi futuri e test.

## Backup e cancellazione

`esportaBackup(database)` legge insieme tutte le tabelle. `validaBackup(valore)` controlla formato `FridgeBrain`, versione 1 e dati senza modificare il database. `importaBackup(database,valore)` valida nuovamente e sostituisce tutte le tabelle in una transazione; errori provocano rollback. La UI mostra conteggi/data e richiede conferma prima della chiamata. `cancellaDati(database)` svuota tutte le tabelle e ripristina le tre posizioni iniziali, dopo doppia conferma della UI. Limite file 25 MiB. Nessuna sincronizzazione fra dispositivi.
