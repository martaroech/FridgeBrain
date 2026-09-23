# Prodotti Open Food Facts e cache browser

Il catalogo utilizza la tabella IndexedDB `cache_prodotti_off` e le API pubbliche HTTPS di Open Food Facts, direttamente dal browser. Nessun import preliminare, proxy o database alimentare. Gli originali storici in `data/raw/` rimangono intatti e inutilizzati.

## Recupero e ricerca

`recuperaProdotto` valida il barcode e cerca nei dati locali. Una corrispondenza esatta precede gli alias GTIN verificati; a parità di codice, il prodotto personalizzato conserva la precedenza per permettere correzioni manuali. In assenza di risultati viene interrogato `https://world.openfoodfacts.org/api/v2/product/{barcode}.json` con i soli campi utilizzati. Dopo validazione, il prodotto è salvato in IndexedDB. Richieste simultanee dello stesso GTIN nella scheda condividono il recupero.

Il browser controlla User-Agent: l'app si identifica mediante il parametro `user_agent=FridgeBrain/1.0 (https://martaroech.github.io/FridgeBrain/)`, senza credenziali. Inventario e preferenze non vengono trasmessi. Non occorre una chiave API. [Documentazione OFF](https://openfoodfacts.github.io/openfoodfacts-server/api/).

`cercaProdotti` cerca nome, marca e codice solo fra personalizzati e cache, fino a 30 risultati. Tutte le operazioni sono asincrone. La rete resta fuori dalle transazioni IndexedDB; l'inventario copia uno snapshot indipendente del prodotto. Ricevute già registrate funzionano anche dopo la rimozione della cache.

## Schema

| Campo | Contenuto |
| --- | --- |
| `barcode` | Chiave testuale, zeri iniziali conservati |
| `dati` | Oggetto prodotto normalizzato con nomi originali OFF |
| `recuperato_il` | Primo recupero UTC |
| `aggiornato_il` | Ultima scrittura UTC |

L'aggiornamento conserva la prima data e non modifica gli snapshot già in inventario. La cache non scade automaticamente: scansioni successive non richiedono rete. Non è prevista un'interfaccia di aggiornamento periodico. Cache e metadati sono inclusi nel backup JSON.

## Errori e dati mancanti

Barcode numerici da 4 a 32 caratteri; solo GTIN con checksum valido generano alias. OFF deve restituire il codice richiesto o un alias ammesso e un nome non vuoto. I campi opzionali vengono controllati per tipo; nutrienti e allergeni assenti restano sconosciuti.

Timeout di 8 secondi compresa la lettura del corpo, limite 2 MiB, redirect rifiutati. Codici applicativi: 400 barcode non valido, 404 assente, 429 limite richieste, 502 risposta non valida, 503 rete/servizio indisponibile, 504 timeout. Dopo un 429, pausa di un minuto sui nuovi recuperi nella scheda. Nessun risultato negativo in cache e nessun retry automatico ripetuto. I dati locali restano utilizzabili durante gli errori OFF.

Nei test HTTP e browser OFF è simulato, incluse le equivalenze GTIN; venti fixture reali verificano nome esatto, barcode, nutrienti, ingredienti e allergeni. Non si dipende dalla disponibilità del servizio pubblico.
