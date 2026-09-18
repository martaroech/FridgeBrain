# Catalogo alimentare locale

Il catalogo deriva esclusivamente dai file originali Open Food Facts in `data/raw/`. Python legge il flusso gzip riga per riga: non vengono salvate copie decompresse e non viene caricato l'intero dataset in memoria. Non sono necessarie dipendenze Python esterne né chiamate Internet.

## File identificati e analisi del sample

I file sono identificati automaticamente dalla dimensione, senza dipendere dal nome. L'opzione predefinita seleziona il più piccolo; `--completo` seleziona il più grande. Per directory contenenti altri dump usare `--origine`.

| Ruolo | File disponibile | Byte compressi |
| --- | --- | ---: |
| Sample | `data/raw/openfoodfacts-sample.jsonl.gz` | 1.414.002 |
| Dump completo | `data/raw/openfoodfacts-full.jsonl.gz` | 12.891.694.064 |

Il sample contiene 485 oggetti JSON. Il campo `code` è sempre una stringa; `product_name` è presente in 458 record, ma può essere vuoto. `nutriments` è un oggetto in 399 record e contiene valori in 108; 144 prodotti hanno `ingredients`, 186 hanno `ingredients_text` (anche vuoto), 480 hanno `allergens_tags` (anche vuoto). La distinzione tra campo mancante, vuoto e valore esplicito è quindi necessaria.

L'analisi automatica individua 99 prodotti con GTIN valido e nutrienti. Le 20 fixture in `tests/fixtures/prodotti_sample.json` sono estratte dal sample, privilegiando marca, ingredienti e allergeni. Non sono prodotti inventati. I barcode sono stringhe, mantengono gli zeri iniziali e superano la verifica della cifra di controllo GTIN.

```bash
python scripts/analizza_sample.py
python scripts/costruisci_database_alimenti.py --campione
python -m unittest discover -s tests -p test_importazione.py -v
```

`analizza_sample.py` riscrive soltanto il piccolo file delle fixture. Per selezionare un sample diverso: `python scripts/analizza_sample.py --origine data/raw/altro-sample.jsonl.gz`.

## Schema stabile del database

Il file generato predefinito è `data/processed/foods.db`.

```sql
CREATE TABLE prodotti (
    code TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    brands TEXT,
    dati TEXT NOT NULL CHECK(json_valid(dati))
);
CREATE TABLE metadati (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL);
CREATE VIRTUAL TABLE ricerca_prodotti USING fts5(
    product_name, brands, content='prodotti', content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);
```

La chiave primaria indicizza il lookup esatto del barcode. FTS5 indicizza nome e marca; la ricerca ignora gli accenti. Le interrogazioni devono sempre utilizzare parametri SQL.

`dati` contiene un oggetto JSON con i nomi originali OFF: identità, quantità, porzione, categorie, paesi, ingredienti, analisi ingredienti, allergeni, tracce, etichette, nutrienti, Nutri-Score, gruppo NOVA e data di modifica. Sono conservati anche `product_quantity_unit`, `nutrition_data_per`, `nutrition_data_prepared_per`, `serving_quantity` e i valori originali `nutriments`, affinché l'app possa interpretare correttamente solidi, liquidi e prodotti preparati. Non vengono importate immagini, contributori o cronologia editoriale.

`metadati` registra versione dello schema, origine, licenza dichiarata, data UTC dell'importazione e statistiche. La consultazione dell'applicazione usa il catalogo in sola lettura. I prodotti personalizzati appartengono al database personale `fridgebrain.db` e non al catalogo.

## Qualità e politica di importazione

- Riga JSON illeggibile, codifica non valida, valore non finito o struttura non oggetto: record ignorato e contato.
- Barcode mancante, numerico anziché stringa o non composto da cifre ASCII: record ignorato. Non si tenta di ricostruire zeri iniziali perduti.
- Nome mancante o vuoto: fallback a `product_name_it`, poi `product_name_en`; senza un nome utilizzabile il record è ignorato.
- I codici numerici OFF non standard sono conservati: il controllo GTIN è obbligatorio per le fixture, non un filtro distruttivo dell'intero catalogo.
- Campi del tipo errato: non vengono reinterpretati come dati validi.
- Nutriente assente: resta assente, non diventa zero. I valori originali rimangono invariati; il motore nutrizionale valida il loro utilizzo.
- `allergens_tags: []` rimane una lista vuota; il campo mancante resta mancante. Nessuno dei due significa certificazione di assenza di allergeni.
- Barcode duplicato: vince l'ultima occorrenza del file. Le statistiche finali contano i prodotti effettivamente presenti.
- Una singola riga superiore a 32 MiB viene scartata per limitare la memoria, senza interrompere le righe successive.

Il gzip viene letto fino alla fine, così sono rilevati troncamenti e checksum non validi. I prodotti vengono inseriti in blocchi di 1.000, con cache SQLite di circa 32 MiB. Gli indici sono costruiti alla fine. Un catalogo temporaneo nella stessa directory viene verificato con `PRAGMA integrity_check`, sincronizzato su disco e sostituito atomicamente al precedente. Un gzip corrotto, un import senza prodotti o un errore impediscono la sostituzione. Non vengono mai modificati gli originali né `fridgebrain.db`.

## Misure e test effettivi

Prima elaborazione del sample, Windows e Python 3.14.7:

| Misura | Risultato |
| --- | ---: |
| Prodotti analizzati | 485 |
| Prodotti importati | 456 |
| Ignorati senza nome | 29 |
| Prodotti con nutrienti | 105 |
| Prodotti con ingredienti | 139 |
| Prodotti con allergeni dichiarati | 84 |
| Dimensione database con indici | 1.372.160 byte |
| Durata dell'importazione | 0,148 secondi |
| 2.000 lookup reali con parsing e confronti | 0,580 secondi |
| Media per lookup compreso il controllo | 0,290 millisecondi |

Sono misure indicative della macchina locale, non una garanzia sui dump completi. La suite verifica import compresso, record corrotti, codifica, dati mancanti, dati inconsistenti, duplicati, GTIN, nutrienti e unità, ingredienti, allergeni, indici, integrità, conservazione del database precedente e isolamento del database personale. Verifica ogni fixture contro nome, barcode e dati originali, ed esegue altri 2.000 lookup contro il sample originale quando disponibile. In CI senza dataset originali rimangono eseguibili tutte le verifiche sintetiche e quelle sulle fixture reali compresse al momento del test.

## Elaborazione del dump completo e aggiornamenti

Dopo il successo dei test sul sample e nella fase finale di preparazione del progetto:

```bash
python scripts/costruisci_database_alimenti.py --completo
```

Con origine o destinazione esplicite:

```bash
python scripts/costruisci_database_alimenti.py --origine data/raw/nuovo-dump.jsonl.gz --destinazione data/processed/foods.db
```

Prevedere spazio libero per il nuovo database e gli indici, oltre al catalogo precedente finché non termina la sostituzione. L'importazione completa può richiedere diversi minuti o più a seconda di CPU e disco. Ogni 50.000 record viene mostrato l'avanzamento; le statistiche definitive appaiono al termine.

Arrestare il server prima di sostituire il catalogo, soprattutto su Windows, dove una connessione SQLite aperta può impedire la rinomina. Riavviare l'applicazione dopo l'aggiornamento. In Docker mantenere il catalogo nel volume persistente, senza includere dump o database nell'immagine.

Il backup prioritario è il database personale `fridgebrain.db`; `foods.db` è rigenerabile. La directory `data/` resta esclusa da Git. Il catalogo contiene dati di Open Food Facts e ne conserva l'attribuzione: [Open Food Facts](https://world.openfoodfacts.org/). L'etichetta originale del prodotto resta il riferimento per allergeni e dichiarazioni del produttore.
