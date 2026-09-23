# FridgeBrain — Specifica di progetto

> **Aggiornamento definitivo — 22 settembre 2026.** FridgeBrain è una PWA interamente client-side pubblicata su GitHub Pages (`https://martaroech.github.io/FridgeBrain/`) con Next.js `output: "export"`. Tutti i dati personali, compresi inventario, personalizzati, cache OFF, posizioni, spesa, preferenze, ricette e storico, risiedono esclusivamente in IndexedDB nel browser. I barcode vengono cercati prima localmente, poi direttamente nelle API HTTPS pubbliche Open Food Facts. Non esistono backend, route API applicative, proxy, SQLite, cataloghi da dump, Docker, VPS, autenticazione server o servizi cloud aggiuntivi. Il generatore AI resta disabilitato; motore nutrizionale, regole e astrazione provider sono preservati. Offline sono utilizzabili i dati locali; nuovi barcode richiedono Internet. Dispositivi differenti non sono sincronizzati: backup e trasferimento avvengono con JSON versionato dalle Impostazioni, con validazione, riepilogo e conferma. Cancellare i dati del sito/browser può cancellare l'inventario. Questa nota prevale su ogni requisito architetturale incompatibile nelle sezioni storiche sottostanti. Restano valide lingua italiana, UI/UX, design system, scanner, accessibilità e logica deterministica. Istruzioni operative nel [README](README.md).

## 1. Obiettivo del progetto

FridgeBrain è una web application PWA, mobile-first e offline-first, pensata per gestire gli alimenti presenti in casa e aiutare l'utente a decidere cosa mangiare sulla base di ciò che possiede realmente.

L'applicazione deve permettere di:

- identificare un prodotto alimentare tramite codice a barre;
- cercarlo in un database locale derivato da Open Food Facts;
- aggiungerlo a frigorifero, freezer o dispensa;
- registrarne quantità e data di scadenza;
- monitorare prodotti in esaurimento o prossimi alla scadenza;
- mantenere una lista della spesa;
- generare ricette utilizzando gli alimenti realmente disponibili;
- applicare preferenze alimentari, allergeni e vincoli nutrizionali;
- calcolare in modo deterministico i valori nutrizionali delle ricette;
- funzionare normalmente anche in completa assenza di connessione Internet.

FridgeBrain deve essere progettato come un'applicazione realmente utilizzabile, non come demo, prototipo grafico o semplice proof of concept.

---

# 2. Regola fondamentale sulla lingua

Tutto ciò che appartiene direttamente al progetto FridgeBrain deve essere scritto in italiano.

Questo comprende:

- interfaccia grafica;
- testi mostrati all'utente;
- messaggi di errore;
- variabili;
- funzioni;
- classi;
- tipi e interfacce TypeScript;
- componenti applicativi, quando il nome non è imposto dal framework;
- commenti;
- test;
- descrizioni dei test;
- tabelle create specificamente da FridgeBrain;
- colonne create specificamente da FridgeBrain;
- log applicativi;
- documentazione;
- README;
- script sviluppati per il progetto.

Esempi corretti:

```ts
const dataScadenza = prodotto.dataScadenza;

function aggiungiProdotto() {}

interface ProdottoInventario {
    quantita: number;
    dataScadenza: Date;
}
```

Esempi da evitare:

```ts
const expirationDate = product.expirationDate;

function addProduct() {}

interface InventoryProduct {}
```

## Eccezioni

Non devono essere tradotti elementi il cui nome è imposto da:

- linguaggi di programmazione;
- framework;
- librerie;
- protocolli;
- formati;
- sistemi operativi;
- tool esterni;
- convenzioni tecniche obbligatorie.

Per esempio:

```text
package.json
Dockerfile
page.tsx
layout.tsx
route.ts
node_modules
useState
```

sono nomi tecnici e devono rimanere invariati.

---

# 3. Eccezione specifica: Open Food Facts

I dati provenienti da Open Food Facts NON devono essere tradotti.

I nomi originali dei campi possono e devono rimanere in inglese.

Per esempio:

```text
product_name
brands
nutriments
ingredients_text
allergens_tags
categories_tags
countries_tags
```

Questa deve essere sostanzialmente l'unica parte del dominio applicativo nella quale è accettata nomenclatura inglese.

Non è necessario trasformare:

```text
product_name
```

in:

```text
nome_prodotto
```

durante l'importazione.

Se per ragioni tecniche è necessario appiattire, indicizzare o normalizzare parti del dataset Open Food Facts, mantenere comunque per quanto possibile la nomenclatura originale della fonte.

Il codice specifico FridgeBrain che interagisce con questi dati deve invece utilizzare nomi italiani, salvo i riferimenti diretti ai campi Open Food Facts.

Esempio:

```ts
const prodottoOpenFoodFacts = risultato.product_name;

function cercaProdottoPerCodiceBarre(codiceBarre: string) {}
```

---

# 4. Funzionamento completamente locale

Durante il normale utilizzo FridgeBrain non deve dipendere da Internet.

Non devono essere effettuate chiamate runtime verso:

- API Open Food Facts;
- OpenAI;
- Anthropic;
- Google;
- servizi OCR cloud;
- database nutrizionali remoti;
- API di ricette;
- servizi SaaS esterni.

Il sistema deve continuare a funzionare anche se la macchina che lo ospita non dispone di una connessione Internet.

La rete locale può essere utilizzata per accedere alla webapp da smartphone, tablet o altri dispositivi della casa.

---

# 5. Dataset già disponibile

Nella directory:

```text
data/raw/
```

sono già presenti due file Open Food Facts compressi in formato:

```text
.jsonl.gz
```

Uno è il dump completo.

Uno è un dataset ridotto utilizzato per sviluppo e test.

Non assumere necessariamente nomi precisi dei file.

Identificare automaticamente quale sia il sample e quale il dump completo tramite:

- dimensione;
- contenuto;
- struttura.

## Regola importante

NON decomprimere permanentemente i file `.jsonl.gz`.

Gli script devono essere in grado di leggere direttamente i file compressi oppure di utilizzare una strategia di elaborazione streaming.

Il dump completo può essere molto grande e non deve essere caricato interamente in memoria.

---

# Direzione UI/UX

FridgeBrain non deve utilizzare l'estetica generica tipica delle applicazioni generate automaticamente o delle interfacce AI.

Evitare esplicitamente:

- dashboard amministrative generiche;
- sidebar desktop sproporzionate;
- estetica chatbot;
- grandi box di input "Chiedi all'AI";
- gradienti viola/blu tipici dei prodotti AI;
- glassmorphism eccessivo;
- estetica cyberpunk;
- uso eccessivo di card tutte identiche;
- interfacce troppo dense;
- layout che sembrano template SaaS generici.

L'intelligenza artificiale deve essere percepita come una funzione interna di FridgeBrain e non come il centro visivo dell'applicazione.

## Identità visiva

La direzione stilistica deve fondere:

- tecnologia;
- alimentazione;
- benessere;
- semplicità;
- precisione dei dati.

L'interfaccia deve risultare contemporanea e curata, ma non clinica.

FridgeBrain deve comunicare:

- freschezza;
- ordine;
- affidabilità;
- semplicità;
- tecnologia discreta.

La sensazione generale desiderata è quella di un prodotto tra:

- applicazione consumer premium;
- health application moderna;
- strumento tecnologico ben progettato.

Non deve sembrare un software medico né un gestionale aziendale.

## Palette

Preferire una palette chiara.

Indicativamente:

- sfondo principale bianco caldo o avorio molto leggero;
- superfici bianche;
- verde naturale o verde salvia come colore principale;
- verde più profondo per testi o elementi importanti;
- eventuale accento azzurro/ciano utilizzato con grande moderazione per comunicare la componente tecnologica;
- ambra per avvisi;
- rosso tenue per scadenze critiche ed errori;
- testo grafite invece di nero assoluto.

È consentito definire autonomamente i valori cromatici precisi, purché venga mantenuta questa direzione.

Evitare palette dominate da:

- viola;
- blu elettrico;
- neon;
- gradienti vistosi.

## Tipografia

Utilizzare una tipografia moderna, molto leggibile e pulita.

Preferire:

- gerarchia tipografica evidente;
- titoli relativamente compatti;
- numeri nutrizionali molto leggibili;
- peso tipografico utilizzato con moderazione;
- testi non eccessivamente piccoli.

L'interfaccia deve risultare leggibile rapidamente anche mentre l'utente è in cucina o sta facendo la spesa.

## Spaziatura

Utilizzare molto spazio negativo.

Non comprimere eccessivamente informazioni e controlli.

La UI deve dare una sensazione di calma e ordine.

Preferire pochi elementi importanti per schermata rispetto a molti pannelli contemporaneamente.

## Forme

Usare bordi arrotondati moderni ma moderati.

Evitare che ogni elemento sembri una grande pillola o una card estremamente arrotondata.

Le card devono essere utilizzate solamente quando aiutano realmente a raggruppare le informazioni.

Non racchiudere ogni singolo testo o valore in un riquadro.

## Iconografia

Utilizzare un set di icone coerente, minimale e moderno.

Preferire icone outline semplici.

Evitare emoji come elemento principale dell'interfaccia definitiva.

Le emoji possono essere utilizzate esclusivamente in dati demo o dove abbiano una funzione comunicativa reale.

## Home

La Home non deve essere costruita come chatbot.

Non mostrare un grande campo:

"Chiedi a FridgeBrain"

come elemento principale.

La Home deve rispondere immediatamente alle domande:

- cosa ho in casa?
- cosa sta scadendo?
- cosa dovrei consumare prima?
- cosa posso cucinare?
- cosa devo comprare?

La generazione delle ricette deve essere accessibile tramite una call-to-action chiara come:

"Trova una ricetta"

oppure:

"Cosa posso cucinare?"

senza trasformare tutta l'applicazione in un'interfaccia conversazionale.

## Dashboard

La dashboard deve privilegiare informazioni operative.

Possibile gerarchia:

1. prodotti che richiedono attenzione;
2. suggerimento ricetta;
3. riepilogo inventario;
4. lista della spesa;
5. informazioni secondarie.

La dashboard non deve mostrare grafici se non aggiungono reale valore.

Non aggiungere grafici puramente decorativi.

## Inventario

L'inventario deve risultare molto visivo e facile da scorrere.

Ogni alimento deve essere riconoscibile rapidamente tramite:

- nome;
- marca quando utile;
- quantità;
- posizione;
- scadenza.

La scadenza deve essere visivamente evidente.

Utilizzare indicatori discreti ma comprensibili per:

- normale;
- in scadenza;
- scade oggi;
- scaduto.

Non affidarsi esclusivamente al colore.

## Valori nutrizionali

I valori nutrizionali devono essere mostrati con forte attenzione alla leggibilità.

Non replicare necessariamente la classica tabella nutrizionale presente sulle confezioni.

Creare invece una rappresentazione moderna adatta all'app.

Per esempio:

Calorie
Proteine
Carboidrati
Grassi

possono avere maggiore rilevanza rispetto ai nutrienti secondari.

I dettagli completi possono essere mostrati in una sezione espandibile.

## Ricette

La pagina di una ricetta deve privilegiare:

- titolo;
- tempo;
- porzioni;
- ingredienti realmente disponibili;
- ingredienti mancanti, se consentiti;
- passaggi;
- nutrienti per porzione.

Deve risultare comoda da consultare mentre si cucina.

Prevedere testi e controlli sufficientemente grandi per l'uso in cucina.

## Scanner

Lo scanner barcode deve essere estremamente diretto.

Quando viene aperto:

- la fotocamera deve occupare la maggior parte dello schermo;
- deve essere evidente l'area di scansione;
- devono esserci pochissimi controlli;
- deve essere sempre disponibile l'inserimento manuale del barcode.

Dopo una scansione riuscita, il passaggio al prodotto trovato deve essere rapido e visivamente chiaro.

## Navigazione mobile

Su smartphone preferire una navigazione inferiore persistente.

Indicativamente:

Home
Inventario
Aggiungi
Ricette
Spesa

"Aggiungi" può avere maggiore evidenza visiva rispetto alle altre voci.

Evitare menu hamburger come navigazione principale quando non necessari.

## Desktop

Su desktop è consentito utilizzare una navigazione laterale o un layout più ampio.

La versione desktop deve derivare dallo stesso design system della versione mobile.

Non deve sembrare un'applicazione diversa.

## Microinterazioni

Utilizzare animazioni leggere e funzionali.

Esempi:

- conferma aggiunta prodotto;
- cambiamento quantità;
- prodotto spostato;
- elemento completato nella lista della spesa;
- caricamento generazione ricetta.

Evitare animazioni puramente decorative o lente.

## Empty state

Le schermate vuote devono essere curate.

Esempio:

"Il frigorifero è ancora vuoto."

con una call-to-action:

"Scansiona il primo prodotto"

È preferibile un'illustrazione semplice o un elemento grafico coerente al posto di grandi blocchi di testo.

## Personalità del prodotto

FridgeBrain può utilizzare un tono leggermente amichevole ma non infantile.

Preferire:

"Questa mozzarella scade domani."

a:

"🚨 OMG! Mangiala subito!"

Preferire testi brevi, chiari e naturali.

## Design system

Definire un piccolo design system interno prima di realizzare tutte le schermate.

Deve comprendere almeno:

- palette;
- tipografia;
- spacing;
- raggi;
- ombre;
- bottoni;
- input;
- card;
- badge;
- stati;
- navigazione;
- modali;
- toast;
- indicatori di scadenza.

Riutilizzare questi componenti in tutta l'applicazione.

Evitare styling ad-hoc differente per ogni pagina.

## Obiettivo finale

L'utente deve percepire FridgeBrain come un'applicazione consumer progettata intenzionalmente da un designer, non come un'interfaccia generata automaticamente da un modello AI.

In caso di dubbio, privilegiare:

semplicità > decorazione

chiarezza > quantità di informazioni

funzione > effetto visivo

consumer app > admin dashboard

healthy-tech > AI aesthetic

---

# 6. Strategia di sviluppo del database alimentare

Lo sviluppo iniziale deve essere effettuato esclusivamente utilizzando il dataset sample.

Flusso iniziale:

```text
Open Food Facts sample
        ↓
analisi struttura
        ↓
importazione
        ↓
database locale
        ↓
test
        ↓
verifica
```

Solo dopo aver verificato completamente l'importer con il sample deve essere utilizzato il dump completo.

NON iniziare lo sviluppo elaborando direttamente il dump completo.

---

# 7. Database separati

FridgeBrain deve utilizzare almeno due database fisicamente separati.

## Database alimentare

Nome consigliato:

```text
foods.db
```

Contiene i dati provenienti da Open Food Facts.

Deve essere considerato sostanzialmente read-only durante il normale utilizzo dell'applicazione.

Deve poter essere:

- cancellato;
- ricreato;
- sostituito;
- aggiornato;

senza alcuna perdita dei dati personali dell'utente.

---

## Database applicativo

Nome consigliato:

```text
fridgebrain.db
```

Contiene esclusivamente i dati appartenenti all'utente e all'applicazione.

Per esempio:

- inventario;
- quantità;
- scadenze;
- posizione degli alimenti;
- lista della spesa;
- preferenze;
- configurazione nutrizionale;
- storico dei consumi;
- storico ricette;
- prodotti personalizzati;
- impostazioni.

La rigenerazione di `foods.db` non deve modificare in alcun modo `fridgebrain.db`.

---

# 8. Tecnologia database

Per la prima versione preferire SQLite.

Motivazioni:

- esecuzione locale;
- deployment semplice;
- nessun server database necessario;
- backup semplice;
- lookup tramite barcode estremamente veloce;
- possibilità di distribuire il catalogo come singolo file.

Valutare liberamente l'utilizzo di DuckDB per l'elaborazione del dump Open Food Facts.

Una possibile pipeline è:

```text
openfoodfacts.jsonl.gz
        ↓
DuckDB / Python / streaming
        ↓
filtraggio e indicizzazione
        ↓
foods.db SQLite
```

Non è obbligatorio usare DuckDB se viene individuata una soluzione locale migliore e adeguatamente motivata.

---

# 9. Tecnologie applicative preferite

Preferire:

### Frontend

- Next.js;
- React;
- TypeScript;
- interfaccia responsive;
- mobile-first;
- PWA.

### Backend

Preferibilmente TypeScript all'interno del progetto Next.js, purché l'architettura rimanga pulita.

### Elaborazione dataset

È consentito utilizzare Python quando è più appropriato per processare il dump Open Food Facts.

### Deployment

Il progetto deve poter essere avviato facilmente tramite Docker.

Obiettivo ideale:

```bash
docker compose up -d
```

e FridgeBrain deve diventare utilizzabile.

---

# 10. Importazione Open Food Facts

Creare un importer dedicato.

Percorso consigliato:

```text
scripts/
```

Il nome dello script deve essere in italiano, per esempio:

```text
costruisci_database_alimenti.py
```

Lo script deve:

1. individuare il file Open Food Facts da elaborare;
2. leggere il `.jsonl.gz` senza richiedere decompressione manuale;
3. elaborare i prodotti uno alla volta o a blocchi;
4. ignorare record inutilizzabili;
5. gestire campi mancanti senza fallire;
6. creare il database SQLite;
7. creare gli indici necessari;
8. produrre statistiche finali;
9. segnalare record malformati senza interrompere necessariamente l'intero import.

Alla fine mostrare almeno:

```text
Prodotti analizzati
Prodotti importati
Prodotti ignorati
Prodotti senza barcode
Prodotti senza nome
Prodotti con dati nutrizionali
Prodotti con ingredienti
Prodotti con allergeni
Durata importazione
Dimensione database generato
```

---

# 11. Identificatore principale dei prodotti

Il codice a barre deve essere il principale identificatore per la ricerca.

La ricerca:

```text
codice a barre → prodotto
```

deve essere estremamente veloce.

Creare quindi un indice appropriato sul barcode.

Quando necessario, trattare il barcode come stringa e non come numero, per evitare problemi con:

- zeri iniziali;
- GTIN di diversa lunghezza;
- conversioni numeriche indesiderate.

---

# 12. Dati Open Food Facts utili

Conservare almeno le informazioni necessarie per FridgeBrain.

Tra quelle disponibili, considerare:

```text
code
product_name
generic_name
brands
quantity
serving_size
categories
categories_tags
countries
countries_tags
ingredients_text
ingredients
allergens
allergens_tags
traces
traces_tags
labels
labels_tags
nutriments
nutriscore_grade
nova_group
last_modified_t
```

Non è obbligatorio conservare ogni singolo campo del dataset.

Valutare quali dati siano realmente utili alla webapp.

Evitare di gonfiare inutilmente `foods.db`.

---

# 13. Immagini Open Food Facts

Per la V1 non scaricare in massa le immagini dei prodotti Open Food Facts.

FridgeBrain deve poter funzionare perfettamente senza immagini.

La UI deve essere progettata in modo elegante anche quando un prodotto non possiede una fotografia.

---

# 14. Test automatici del database alimentare

Al momento non sono disponibili barcode raccolti manualmente dall'utente.

Creare quindi automaticamente un insieme di test utilizzando il dataset sample.

Individuare almeno 20 prodotti che abbiano:

- barcode valido;
- nome;
- possibilmente marca;
- dati nutrizionali;
- possibilmente ingredienti;
- possibilmente allergeni.

Usarli come fixture automatiche.

Verificare almeno:

```text
barcode
    ↓
lookup
    ↓
prodotto corretto
```

I test devono garantire che:

- il prodotto venga trovato;
- il barcode corrisponda;
- il nome sia coerente;
- i nutrienti non vengano corrotti dall'importazione.

---

# 15. Posizioni alimentari

Ogni elemento dell'inventario deve appartenere a una posizione.

Posizioni iniziali:

```text
Frigorifero
Freezer
Dispensa
```

L'architettura deve permettere in futuro di aggiungere altre posizioni personalizzate.

---

# 16. Flusso di aggiunta tramite barcode

Il flusso principale deve essere progettato soprattutto per smartphone.

L'utente preme:

```text
+
```

oppure:

```text
Aggiungi prodotto
```

Si apre lo scanner barcode.

Flusso:

```text
Fotocamera
    ↓
barcode rilevato
    ↓
ricerca locale in foods.db
```

## Prodotto trovato

Mostrare:

- nome;
- marca;
- quantità dichiarata;
- ingredienti;
- allergeni;
- valori nutrizionali principali;
- Nutri-Score se presente.

Chiedere all'utente:

- numero di confezioni;
- quantità effettiva, quando utile;
- posizione;
- data di scadenza.

Quindi:

```text
Aggiungi
```

---

# 17. Inserimento della scadenza

Nella V1 la data di scadenza deve essere inserita manualmente.

La UI deve rendere l'operazione estremamente veloce.

NON implementare OCR della scadenza nella V1.

Preparare però l'architettura in modo che una futura funzione OCR possa essere aggiunta senza riprogettare l'intero flusso.

---

# 18. Prodotto non trovato

Se il barcode non esiste in `foods.db`, mostrare chiaramente:

```text
Prodotto non trovato
```

e permettere:

```text
Inserisci manualmente
```

Creare quindi un prodotto personalizzato.

Informazioni minime:

- barcode;
- nome;
- marca opzionale;
- quantità;
- valori nutrizionali opzionali;
- ingredienti opzionali;
- allergeni opzionali.

I prodotti personalizzati devono essere salvati in `fridgebrain.db`, non in `foods.db`.

Una scansione successiva dello stesso barcode deve trovare anche il prodotto personalizzato.

---

# 19. OCR

NON implementare nella V1:

- OCR degli ingredienti;
- OCR della tabella nutrizionale;
- OCR della scadenza.

Queste funzionalità appartengono a una fase successiva.

Non introdurre dipendenze cloud per prepararle.

---

# 20. Inventario

Creare una schermata Inventario.

Permettere di:

- vedere tutti i prodotti;
- filtrare per frigorifero;
- filtrare per freezer;
- filtrare per dispensa;
- cercare per nome;
- cercare per marca;
- ordinare per scadenza;
- ordinare per data di inserimento;
- modificare quantità;
- modificare scadenza;
- modificare posizione;
- eliminare prodotto;
- segnare prodotto come consumato.

---

# 21. Gestione quantità

L'app deve supportare almeno:

- numero di confezioni;
- quantità residua opzionale.

Il modello dati deve permettere in futuro di rappresentare:

```text
2 confezioni
500 g
350 ml
6 pezzi
```

senza richiedere la completa implementazione di ogni caso complesso nella V1.

---

# 22. Scadenze

La dashboard deve evidenziare automaticamente prodotti:

```text
Scaduti
Scadono oggi
Scadono entro 3 giorni
Scadono entro 7 giorni
```

Le soglie devono poter diventare configurabili in futuro.

Usare segnali grafici chiari senza affidarsi esclusivamente al colore.

---

# 23. Dashboard

La home deve essere utile immediatamente.

Mostrare almeno:

- numero prodotti presenti;
- prodotti in scadenza;
- prodotti scaduti;
- lista della spesa;
- suggerimenti di ricette;
- prodotti da consumare prioritariamente.

Esempio concettuale:

```text
FRIDGEBRAIN

42 prodotti in casa

3 scadono presto
1 prodotto scaduto
5 prodotti nella lista della spesa

DA CONSUMARE PRIMA

Mozzarella       oggi
Prosciutto       domani
Yogurt           tra 2 giorni

COSA POSSO CUCINARE?

[ Genera ricetta ]
```

---

# 24. Lista della spesa

Creare una lista della spesa.

Permettere:

- aggiunta manuale;
- rimozione;
- spunta;
- riordinamento sensato;
- eventuale collegamento futuro con scorte minime.

Per la V1 non è obbligatorio implementare una sofisticata previsione automatica dei consumi.

---

# 25. Ricette

FridgeBrain deve poter creare ricette utilizzando i prodotti realmente presenti nell'inventario.

L'utente deve poter impostare almeno:

- numero di persone;
- tempo massimo;
- preferenze alimentari;
- ingredienti da escludere;
- limiti nutrizionali;
- priorità ai prodotti in scadenza.

Esempio:

```text
Persone: 2

Tempo massimo:
20 minuti

Vincoli:
Senza glutine

Carboidrati massimi:
40 g per porzione

Proteine minime:
25 g per porzione

Calorie massime:
600 kcal per porzione

Priorità:
Usa prima i prodotti in scadenza
```

---

# 26. Separazione tra AI e logica deterministica

L'intelligenza artificiale NON deve essere responsabile dei calcoli nutrizionali.

Separare chiaramente:

```text
LLM
↓
proposta della ricetta

motore nutrizionale
↓
calcoli matematici reali

motore di validazione
↓
ricetta accettata o rifiutata
```

L'LLM può decidere:

- combinazioni;
- procedimento;
- quantità proposte;
- stile della ricetta.

Non deve inventare:

- kcal;
- carboidrati;
- zuccheri;
- proteine;
- grassi;
- fibre;
- sale.

---

# 27. Calcolo nutrizionale

I valori devono essere calcolati utilizzando i nutrienti presenti nel database.

Esempio:

```text
Mozzarella

250 kcal / 100 g
```

Ricetta:

```text
80 g mozzarella
```

Calcolo:

```text
250 × 80 / 100 = 200 kcal
```

Ripetere la stessa logica per ogni nutriente.

Calcolare:

1. valori per ingrediente;
2. totale ricetta;
3. totale per porzione.

Gestire chiaramente nutrienti mancanti.

Non sostituire automaticamente un dato mancante con `0`, perché:

```text
dato sconosciuto
```

non significa:

```text
zero
```

---

# 28. Vincoli nutrizionali

Supportare un modello generico.

Esempi:

```text
carboidrati_massimi_per_porzione
zuccheri_massimi_per_porzione
proteine_minime_per_porzione
calorie_massime_per_porzione
sale_massimo_per_porzione
fibre_minime_per_porzione
```

Non codificare direttamente concetti medici complessi come semplice booleano.

Evitare, per esempio:

```text
diabetico = true
```

come unica logica.

Preferire parametri nutrizionali espliciti.

L'interfaccia potrà in futuro offrire preset, ma il motore sottostante deve essere basato su regole verificabili.

---

# 29. Preferenze alimentari

Supportare almeno:

```text
Vegetariano
Vegano
```

Progettare l'architettura per aggiungerne altre.

Prima di generare una ricetta applicare sempre le regole deterministiche.

L'LLM deve ricevere soltanto ingredienti compatibili con i vincoli applicabili quando ciò è determinabile in modo affidabile.

---

# 30. Allergeni e restrizioni

Gestire gli allergeni provenienti da Open Food Facts.

L'utente deve poter configurare sostanze da evitare.

Esempio:

```text
glutine
latte
uova
soia
frutta a guscio
```

Un prodotto incompatibile deve essere escluso prima della generazione della ricetta quando i dati disponibili consentono una decisione affidabile.

Se i dati sono incompleti o ambigui, mostrare chiaramente che l'informazione non è certa.

Non presentare mai i dati Open Food Facts come certificazione medica.

---

# 31. Celiachia e sicurezza alimentare

Non dichiarare automaticamente un prodotto "sicuro per celiaci" semplicemente perché non compare un allergene.

Distinguere:

```text
informazione esplicitamente presente
```

da:

```text
informazione assente
```

Per restrizioni importanti mostrare avvisi appropriati quando i dati della fonte sono incompleti.

L'etichetta originale del prodotto deve essere considerata il riferimento finale per allergeni e dichiarazioni del produttore.

---

# 32. Generatore di ricette locale

L'architettura deve prevedere un provider astratto.

Esempio concettuale:

```ts
interface GeneratoreRicette {
    generaRicetta(...): Promise<RicettaGenerata>;
}
```

Prevedere almeno:

```text
GeneratoreRicetteLocale
GeneratoreRicetteSimulato
```

Il provider locale deve poter essere collegato a un runtime come Ollama o equivalente.

Non introdurre dipendenze da servizi AI cloud.

---

# 33. Funzionamento senza LLM

L'applicazione principale deve essere utilizzabile anche se nessun modello locale è installato.

In tal caso:

- inventario deve funzionare;
- barcode deve funzionare;
- scadenze devono funzionare;
- lista della spesa deve funzionare;
- valori nutrizionali devono funzionare.

La sezione ricette deve mostrare chiaramente l'eventuale indisponibilità del generatore AI oppure utilizzare un provider simulato nei test.

---

# 34. Priorità agli alimenti in scadenza

Il generatore di ricette deve poter ricevere una priorità come:

```text
CONSUMA_PRIMA_QUELLI_IN_SCADENZA
```

Il sistema deve assegnare maggiore priorità agli alimenti con scadenza più vicina.

Non utilizzare automaticamente prodotti già scaduti.

---

# 35. Validazione della ricetta

Dopo che il generatore propone una ricetta:

1. verificare che gli ingredienti siano realmente disponibili;
2. verificare che le quantità siano plausibili;
3. calcolare i valori nutrizionali;
4. verificare i vincoli richiesti;
5. verificare allergeni/restrizioni;
6. accettare oppure rifiutare la ricetta.

Se la ricetta non rispetta i limiti, tentare una nuova generazione fino a una soglia ragionevole.

Evitare loop infiniti.

---

# 36. Consumo degli ingredienti

Da una ricetta deve essere possibile indicare:

```text
Ho cucinato questa ricetta
```

FridgeBrain deve quindi poter diminuire le quantità dell'inventario.

Prima della modifica mostrare chiaramente cosa verrà consumato.

---

# 37. Storico

Prevedere uno storico almeno per:

- prodotti consumati;
- prodotti eliminati;
- ricette preparate.

Non è necessario costruire analytics complessi nella prima versione, ma il modello dati deve permetterlo in futuro.

---

# 38. PWA e utilizzo da smartphone

La UI deve essere progettata innanzitutto per telefono.

Requisiti:

- pulsanti facilmente toccabili;
- scanner raggiungibile rapidamente;
- navigazione semplice;
- nessuna dipendenza dall'hover;
- layout responsive;
- supporto PWA;
- manifest;
- icone;
- installabilità;
- esperienza appropriata in modalità standalone.

---

# 39. Scanner barcode

Utilizzare la fotocamera del dispositivo tramite tecnologie web compatibili.

Preferire una libreria locale/open-source affidabile.

Non utilizzare un servizio remoto.

Gestire:

- permesso fotocamera negato;
- fotocamera non disponibile;
- barcode non riconosciuto;
- scansioni multiple;
- inserimento manuale del codice.

---

# 40. Desktop

Pur essendo mobile-first, l'interfaccia deve funzionare correttamente anche su desktop.

Non limitarsi a ingrandire il layout mobile.

Sfruttare lo spazio aggiuntivo in modo sensato.

---

# 41. Navigazione iniziale

Una possibile struttura:

```text
Home
Inventario
Aggiungi
Ricette
Spesa
Impostazioni
```

È consentito modificare questa organizzazione se viene individuata una UX migliore.

Non modificare però le funzionalità fondamentali.

---

# 42. Design

Creare un'interfaccia:

- moderna;
- pulita;
- semplice;
- leggibile;
- gradevole;
- non eccessivamente "da gestionale";
- utilizzabile quotidianamente.

Non creare un'interfaccia dimostrativa piena di placeholder.

Non utilizzare testi Lorem Ipsum.

Utilizzare dati demo realistici soltanto dove necessario.

---

# 43. Accessibilità

Rispettare buone pratiche di accessibilità.

In particolare:

- contrasto adeguato;
- label associate ai campi;
- navigazione da tastiera;
- focus visibile;
- attributi ARIA dove necessari;
- informazioni importanti non comunicate esclusivamente tramite colore.

---

# 44. Error handling

Ogni operazione importante deve gestire gli errori.

Esempi:

- database non disponibile;
- database alimentare non ancora generato;
- barcode assente;
- prodotto sconosciuto;
- fotocamera negata;
- nutrienti mancanti;
- modello AI locale offline;
- import fallito;
- file Open Food Facts corrotto.

Gli errori mostrati all'utente devono essere in italiano e comprensibili.

---

# 45. Logging

Implementare log utili per sviluppo e diagnostica.

Non salvare informazioni sensibili inutilmente.

I log creati dal progetto devono utilizzare messaggi in italiano.

---

# 46. Performance

Obiettivi:

- apertura rapida dell'app;
- ricerca barcode quasi immediata;
- inventario fluido;
- nessun caricamento dell'intero catalogo alimentare in memoria;
- import del dump effettuato in streaming o per blocchi;
- indici database adeguati.

Testare lookup ripetuti per barcode.

---

# 47. Aggiornamento futuro del catalogo alimentare

L'architettura deve permettere in futuro:

```text
nuovo dump Open Food Facts
        ↓
rigenerazione foods.db
        ↓
sostituzione foods.db
```

senza alterare i dati personali.

Non è necessario implementare download automatici da Internet nella V1.

L'aggiornamento può avvenire manualmente fornendo un nuovo `.jsonl.gz`.

---

# 48. Backup

Poiché i dati utente sono locali, prevedere una strategia semplice per il backup di:

```text
fridgebrain.db
```

Per la V1 può essere sufficiente documentare chiaramente quali file salvare.

`foods.db` non è essenziale nel backup perché può essere rigenerato.

---

# 49. Sicurezza

Non esporre inutilmente l'applicazione all'esterno della rete locale.

Non assumere che FridgeBrain debba essere pubblicamente accessibile da Internet.

Se viene implementata autenticazione, mantenerla semplice e locale.

Non utilizzare servizi di autenticazione cloud.

---

# 50. Test

Creare test automatici significativi.

Almeno:

## Importer

- lettura `.jsonl.gz`;
- gestione record corrotti;
- gestione campi mancanti;
- creazione database;
- indicizzazione;
- lookup barcode.

## Motore nutrizionale

- kcal;
- carboidrati;
- proteine;
- grassi;
- zuccheri;
- fibre;
- sale;
- porzioni;
- dati mancanti.

## Inventario

- aggiunta;
- modifica;
- consumo;
- rimozione;
- posizione;
- scadenza.

## Restrizioni

- allergeni;
- vegetariano;
- vegano;
- limiti nutrizionali.

## API

Testare gli endpoint significativi.

## UI

Aggiungere test end-to-end per i flussi principali.

Preferire Playwright per i flussi browser.

---

# 51. Flussi end-to-end obbligatori

Prima di considerare il progetto completato devono funzionare almeno questi scenari.

## Scenario A

```text
Avvio applicazione
→ aggiungi prodotto
→ inserisci barcode
→ prodotto trovato
→ scegli Frigorifero
→ inserisci scadenza
→ conferma
→ prodotto visibile nell'inventario
```

## Scenario B

```text
barcode non presente
→ prodotto non trovato
→ creazione manuale
→ prodotto salvato
→ nuova ricerca dello stesso barcode
→ prodotto trovato
```

## Scenario C

```text
inventario
→ prodotto vicino alla scadenza
→ dashboard
→ prodotto segnalato correttamente
```

## Scenario D

```text
richiesta ricetta
→ selezione alimenti disponibili
→ generazione
→ calcolo nutrizionale deterministico
→ controllo vincoli
→ visualizzazione ricetta
```

## Scenario E

```text
ricetta preparata
→ conferma consumo
→ quantità inventario aggiornata
```

---

# 52. Dati demo

Preparare un piccolo dataset demo separato.

Non contaminare il database reale Open Food Facts con dati inventati.

I dati demo devono servire esclusivamente a sviluppo, test e anteprima.

---

# 53. Struttura repository

Organizzare il repository in modo professionale e comprensibile.

Una possibile struttura:

```text
FridgeBrain/
│
├── data/
│   ├── raw/
│   └── processed/
│
├── docs/
│   └── SPEC.md
│
├── scripts/
│
├── tests/
│
├── src/
│
├── docker-compose.yml
├── Dockerfile
├── README.md
└── ...
```

È consentito modificare questa struttura quando framework e tooling lo richiedono.

---

# 54. Git

Inizializzare correttamente il repository Git se non già presente.

Creare `.gitignore`.

NON inserire nel repository i giganteschi dump Open Food Facts.

Inserire in `.gitignore` almeno i dataset e gli artefatti generati molto grandi quando appropriato.

Documentare dove l'utente deve collocarli.

---

# 55. README

Creare un README completo in italiano.

Deve spiegare almeno:

- cos'è FridgeBrain;
- requisiti;
- struttura;
- come preparare il database alimentare;
- come utilizzare sample e dump completo;
- come avviare il progetto;
- come avviarlo con Docker;
- come effettuare i test;
- come effettuare backup;
- come configurare un eventuale LLM locale;
- troubleshooting di base.

---

# 56. Modalità di lavoro richiesta a Codex

Lavorare autonomamente.

Non limitarsi a creare:

- scaffold;
- struttura cartelle;
- TODO;
- pseudocodice;
- pagine vuote.

Implementare realmente il prodotto.

Prima di prendere una decisione tecnica, ispezionare il repository e i dati disponibili.

Quando la specifica lascia libertà implementativa, scegliere autonomamente una soluzione sensata.

Non chiedere conferma per decisioni tecniche ordinarie.

---

# 57. Strategia di esecuzione

Procedere in modo incrementale.

Ordine consigliato:

### Fase 1

Analisi repository e dataset.

### Fase 2

Importer Open Food Facts sul sample.

### Fase 3

Creazione e verifica `foods.db`.

### Fase 4

Backend e `fridgebrain.db`.

### Fase 5

Inventario.

### Fase 6

Scanner barcode.

### Fase 7

Dashboard e scadenze.

### Fase 8

Lista della spesa.

### Fase 9

Motore nutrizionale.

### Fase 10

Motore regole alimentari.

### Fase 11

Generazione ricette.

### Fase 12

PWA e rifinitura UI.

### Fase 13

Test end-to-end.

### Fase 14

Elaborazione del dump completo.

### Fase 15

Documentazione e verifica finale.

È possibile modificare l'ordine se emergono valide motivazioni tecniche.

---

# 58. Regola sample → full dump

Il dump completo NON deve essere elaborato fino a quando:

- importer non è stabile;
- test importer non passano;
- struttura `foods.db` non è definitiva;
- lookup barcode non è verificato;
- performance non sono ragionevoli.

Solo successivamente utilizzare il file completo.

---

# 59. Verifica autonoma

Prima di dichiarare completata una funzionalità:

1. eseguirla;
2. testarla;
3. controllare i log;
4. correggere gli errori;
5. ripetere i test.

Non considerare "implementato" codice non eseguito o non verificato.

---

# 60. Controllo visuale

Verificare realmente l'interfaccia.

Controllarla almeno in viewport assimilabili a:

- smartphone;
- tablet;
- desktop.

Correggere autonomamente:

- overflow;
- elementi tagliati;
- spaziature errate;
- testi troppo lunghi;
- bottoni difficili da utilizzare;
- layout poco leggibili.

---

# 61. Definition of Done

FridgeBrain V1 può essere considerato completato solamente quando:

- il progetto si avvia correttamente;
- il sample Open Food Facts viene importato correttamente;
- il dump completo può essere elaborato;
- il barcode lookup funziona;
- un prodotto può essere aggiunto all'inventario;
- è possibile gestire quantità, posizione e scadenza;
- prodotti in scadenza vengono evidenziati;
- la lista della spesa funziona;
- il motore nutrizionale funziona;
- le restrizioni alimentari funzionano;
- il sistema di ricette è integrato con provider locale o simulato;
- i valori nutrizionali delle ricette vengono calcolati dal software;
- la PWA funziona;
- l'app è utilizzabile da smartphone;
- i test automatici passano;
- i principali flussi end-to-end passano;
- Docker funziona;
- README è completo;
- non sono necessarie chiamate Internet durante l'uso normale.

---

# 62. Funzionalità esplicitamente escluse dalla V1

Non implementare adesso:

- OCR della data di scadenza;
- OCR delle tabelle nutrizionali;
- OCR degli ingredienti;
- riconoscimento visivo automatico degli alimenti;
- download automatico degli aggiornamenti Open Food Facts;
- account cloud;
- sincronizzazione cloud;
- API nutrizionali esterne;
- API di ricette esterne;
- accesso remoto pubblico;
- app native iOS/Android;
- statistiche avanzate sui consumi;
- previsione automatica sofisticata degli acquisti;
- riconoscimento automatico dello scontrino.

Preparare l'architettura in modo da non ostacolare future estensioni, ma non sacrificare la qualità della V1 per implementare anticipatamente queste funzioni.

---

# 63. Principio generale

FridgeBrain deve seguire questo principio:

```text
DATI REALI
    +
REGOLE DETERMINISTICHE
    +
AI LOCALE SOLO DOVE SERVE
```

L'AI deve aiutare con compiti creativi come la generazione della ricetta.

Non deve sostituire:

- database;
- matematica;
- controllo allergeni;
- verifica inventario;
- logica di business.

---

# 64. Risultato finale atteso

L'esperienza ideale deve essere:

```text
Faccio la spesa
      ↓
apro FridgeBrain
      ↓
scannerizzo il barcode
      ↓
prodotto riconosciuto localmente
      ↓
inserisco quantità e scadenza
      ↓
aggiungo al frigo
```

Successivamente:

```text
Sono sul divano
      ↓
apro FridgeBrain
      ↓
"Cosa posso mangiare?"
      ↓
imposto eventuali vincoli
      ↓
FridgeBrain conosce ciò che ho realmente in casa
      ↓
prioritizza ciò che sta scadendo
      ↓
genera una ricetta
      ↓
calcola realmente i nutrienti
      ↓
verifica i vincoli
      ↓
mostra la ricetta
```

L'obiettivo finale è che l'utente non debba aprire il frigorifero per ricordarsi cosa contiene e possa decidere cosa cucinare utilizzando dati reali del proprio inventario.
