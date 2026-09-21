# Prodotti Open Food Facts e cache

L'accesso runtime usa esclusivamente l'API pubblica v2 per barcode e la tabella SQLite personale `cache_prodotti_off`. Non sono richiesti import preliminari. Gli originali storici in `data/raw/` rimangono intatti e inutilizzati.

## Contratto

`GET /api/prodotti?codice=...` conserva la risposta `Prodotto` esistente. Le corrispondenze esatte precedono gli alias GTIN verificati; a parità di codice il personalizzato precede la cache. Se manca il prodotto, `recuperaProdotto` interroga `/api/v2/product/{barcode}.json` con campi selezionati e User-Agent FridgeBrain configurabile. Richieste contemporanee dello stesso GTIN condividono il recupero.

`cercaProdotti` interroga soltanto cache e personalizzati per nome, marca e codice con parametri SQL. Non chiama la ricerca remota OFF. `prodotto` resta sincrono per le transazioni d'inventario; il confine HTTP chiama il recupero asincrono prima dell'aggiunta. Le ricevute idempotenti già registrate restano utilizzabili anche svuotando la cache.

## Schema versione 3

| Colonna         | Contenuto                                            |
| --------------- | ---------------------------------------------------- |
| `barcode`       | Chiave primaria testuale, mantiene gli zeri iniziali |
| `dati`          | JSON normalizzato con campi originali OFF            |
| `recuperato_il` | Primo recupero UTC                                   |
| `aggiornato_il` | Ultima scrittura UTC                                 |

La migrazione è additiva. L'upsert conserva il primo recupero e aggiorna prodotto e data dell'ultima scrittura. Non vengono modificati snapshot d'inventario o ricette.

La cache non scade automaticamente. Per un aggiornamento puntuale amministrativo, ferma l'app ed esegui un backup; con un client SQLite elimina soltanto `DELETE FROM cache_prodotti_off WHERE barcode='CODICE';`, poi riavvia e scansiona nuovamente. La ricerca successiva ripopola la riga. Non eliminare il database personale. Un'interfaccia di aggiornamento automatico della cache è fuori da questa migrazione.

## Validazione ed errori

Codici numerici da 4 a 32 caratteri mantengono compatibilità con codici interni esistenti; soltanto GTIN con checksum valido generano alias. OFF deve restituire il codice richiesto o un alias ammesso e un nome non vuoto. Campi opzionali sono verificati per tipo; dati mancanti non diventano zero o assenze certificate. Il motore nutrizionale e le regole alimentari esistenti interpretano i dati.

Tempo massimo 8 secondi inclusa lettura del corpo; massimo 2 MiB, redirect rifiutati. 400 codice non valido; 404 prodotto assente; 429 limite richieste con pausa di un minuto; 502 risposta non valida; 503 rete o servizio indisponibile; 504 timeout. Errori non salvati in cache e nessun retry automatico ripetuto. Il servizio ufficiale non richiede una chiave API per queste letture. Usare `FRIDGEBRAIN_OFF_USER_AGENT` con nome, versione e URL/contatto reale.

Riferimenti: [API OFF](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/) e [regole di utilizzo](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md). Nei test tutte le risposte sono simulate; venti fixture reali verificano nome, barcode, nutrienti, ingredienti e allergeni.
