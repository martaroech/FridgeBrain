# Verifica FridgeBrain V1

Controllo della specifica originale `SPEC.md`, riletta integralmente durante la ripresa e alla chiusura. Le prove usano archivi separati dai dati personali. Il dettaglio delle importazioni è in [catalogo](catalogo.md); quello dei contenitori in [verifica Docker](verifica-docker.md).

## Riscontro requisito per requisito

| Sezione SPEC | Implementazione e verifica |
| --- | --- |
| 1. Obiettivo | Barcode, inventario, quantità, scorte minime esplicite, scadenze, spesa e ricette con validazione; flussi browser A–E. |
| 2. Lingua | UI, dominio, funzioni, script, test, errori e documentazione in italiano. Nomi tecnici del framework conservati. |
| 3. Campi OFF | Nomenclatura originale conservata; fixture confrontate con campi originali, non con valori inventati. |
| 4. Locale | Nessuna API esterna; prove con richieste Internet bloccate e contenitore senza rete. |
| 5. Dataset | Sample e dump individuati per dimensione; originali immutati, lettura gzip in streaming. |
| UI/UX | Design system definito, palette avorio/salvia/verde, liste operative, navigazione mobile inferiore, nessun chatbot o grafico decorativo. |
| 6. Sample prima del completo | Pipeline stabilizzata e testata sul sample prima di avviare il dump completo nella fase finale. |
| 7. Separazione database | Due file SQLite distinti; snapshot personali, catalogo in sola lettura. Prove con catalogo assente, corrotto e sostituito. |
| 8. Database | SQLite integrato in Node; importer Python standard, blocchi di 1.000 record e cache limitata. |
| 9. Tecnologie | Next.js, React, TypeScript, Python, SQLite, Docker Compose. |
| 10. Importer | Statistiche, record scartati, indici, controllo integrità e sostituzione atomica. Test gzip corrotto e righe malformate. |
| 11. Barcode | Stringa indicizzata con zeri iniziali; alias GTIN validati per letture UPC/EAN equivalenti. |
| 12. Dati utili | Identità, marca, ingredienti, allergeni, etichette, nutrienti e metadati nutrizionali OFF conservati. |
| 13. Immagini | Nessun download OFF; icone e illustrazione locali. |
| 14. Fixture | 20 prodotti con GTIN valido dal sample; confronto esatto di codice, nome, nutrienti, ingredienti e allergeni. |
| 15. Posizioni | Frigorifero, Freezer, Dispensa; tabella e API estensibili per posizioni aggiuntive. |
| 16. Aggiunta barcode | Scanner e codice manuale, dettagli fonte, confezioni, quantità, posizione e data; scenario A. |
| 17. Scadenza manuale | Campo data, validazione di date reali; nessun OCR. |
| 18. Personalizzati | Creazione nel database personale e nuova scansione dello stesso prodotto; scenario B. |
| 19. OCR | Esplicitamente escluso dalla V1; nessuna dipendenza OCR. |
| 20. Inventario | Ricerca nome/marca, filtri, ordinamento, modifica, consumo e rimozione verificati. |
| 21. Quantità | Confezioni e residuo opzionale in g/ml/pezzi; niente conversioni arbitrarie. Consumi parziali e totali atomici. |
| 22. Scadenze | Scaduti, oggi, tre e sette giorni; testo oltre al colore. Calcolo per giorni civili. |
| 23. Home | Riepilogo, priorità, scorte in esaurimento, posizioni, invito ricette e spesa; scenario C. |
| 24. Spesa | Aggiunta, modifica, spunta, rimozione; acquistati in fondo. Nessuna previsione sofisticata. |
| 25. Ricette | Persone, tempo, preferenze, esclusioni, allergeni, limiti numerici e priorità scadenze. |
| 26. Separazione AI | Provider propone; motore indipendente verifica inventario, quantità, regole e matematica. |
| 27. Nutrienti | Sette nutrienti, singolo ingrediente, totale e porzione; dati mancanti conservati come sconosciuti. |
| 28. Limiti | Minimo/massimo generici per nutriente e porzione; uguaglianza numerica e dati ignoti testati. |
| 29. Regimi | Vegetariano/vegano basati su dichiarazioni e ingredienti; filtro prima del provider. |
| 30. Allergeni | Presenza, tracce, assenza dichiarata, non segnalato e dato sconosciuto distinti. Politica conservativa. |
| 31. Celiachia | Nessuna certificazione automatica; etichetta originale indicata come riferimento. |
| 32. Provider | Interfaccia comune, provider Ollama locale e simulato esplicito; contratto HTTP locale testato. |
| 33. Senza LLM | Modalità predefinita disabilitata con messaggio chiaro; tutte le altre funzioni operative. |
| 34. Priorità | Ordinamento scadenza e esclusione deterministica dei prodotti scaduti. |
| 35. Validazione | Ingredienti, quantità, unità, limiti, tempo e porzioni verificati; massimo tre proposte, timeout e redirect controllati. |
| 36. Consumo ricetta | Anteprima quantità e conferma; transazione e protezione dal doppio consumo; scenario E. |
| 37. Storico | Consumi, eliminazioni e ricette preparate; ultimi 200 eventi consultabili. |
| 38. PWA | Manifest, icone, installazione e cache locale di consultazione dal primo accesso; blocco modifiche senza server. |
| 39. Scanner | ZXing locale realmente eseguito su video EAN; permesso negato, camera assente, inserimento manuale e doppie letture verificati. |
| 40. Desktop | Navigazione orizzontale, griglie per Home e ricette; screenshot a 1440 px. |
| 41. Navigazione | Home, Inventario, Aggiungi, Ricette, Spesa e Impostazioni; scanner a un tocco. |
| 42. Design | Componenti condivisi, stati vuoti e di errore, testi reali; nessun dato demo nell’archivio d’uso. |
| 43. Accessibilità | Controlli etichettati, focus visibile, link salta-contenuto e dialoghi nativi; axe WCAG A/AA sui tre formati. |
| 44. Errori | Messaggi italiani per API, catalogo, quantità, camera, provider e pagina assente. Retry provati con risposta persa e aggiornamento fallito. |
| 45. Log | Log applicativi italiani; dettagli interni non esposti nelle risposte API. |
| 46. Prestazioni | Lookup parametrizzati e indicizzati, FTS5, nessun caricamento integrale del catalogo; misure in catalogo.md. |
| 47. Aggiornamenti | Import separato e promozione atomica; inventario indipendente dalla versione del catalogo. |
| 48. Backup | Script SQLite backup con WAL attivo, integrità, rifiuto sovrascrittura e istruzioni di ripristino. |
| 49. Sicurezza locale | Docker su loopback per impostazione iniziale, processo non privilegiato, protezione origine; HTTPS domestico facoltativo. |
| 50. Test | Suite Python, TypeScript e Playwright; nessun servizio cloud richiesto dai test applicativi. |
| 51. Scenari A–E | Eseguiti in Chromium su smartphone, tablet e desktop. |
| 52. Demo | Script separato e idempotente, quattro prodotti e due voci spesa; test di isolamento. |
| 53. Struttura | Codice applicativo, libreria di dominio, script, test, documentazione e risorse separati; sorgenti formattati. |
| 54. Git | Repository e .gitignore originali conservati; data/, database, build e report esclusi. |
| 55. README | Installazione, sviluppo, catalogo sample/completo, Docker, test, backup, Ollama e problemi comuni. |
| 56. Autonomia | Implementazione eseguita e verificata; nessuno scaffold incompleto o TODO funzionale. |
| 57. Incrementi | Pipeline, backend, UI, browser, Docker e catalogo verificati progressivamente. |
| 58. Vincolo sample → dump | Soddisfatto prima dell’elaborazione completa. |
| 59. Verifica | Errori emersi nei test corretti e prove rieseguite; risultati effettivi riportati nel README. |
| 60. Controllo visuale | Home, inventario, aggiunta, scanner, dettaglio, spesa, ricetta, impostazioni, vuoti ed errori; immagini in data/verifica-visuale. |
| 61. Completamento | Avvio, flussi principali, PWA, test, Docker e assenza di dipendenze Internet verificati. |
| 62. Esclusioni | OCR, cloud, app native, accesso pubblico, aggiornamenti automatici e previsioni avanzate lasciati alle versioni future. |
| 63. Principio | Dati reali + regole deterministiche + modello locale per la sola parte creativa. |
| 64. Esperienza | Dal barcode all’inventario; dalla disponibilità alla proposta verificata e al consumo confermato. |

## Limiti espliciti delle prove

Il decoder della fotocamera è stato verificato con un vero codice EAN disegnato in un flusso video del browser; non è stata usata una fotocamera fisica di un telefono. La compatibilità hardware e i permessi restano dipendenti dal dispositivo e da HTTPS affidabile.

Nessun modello Ollama è stato installato su questa macchina. L’integrazione locale è verificata tramite un server HTTP locale di prova; le ricette end-to-end usano il provider simulato dichiarato. Per generare ricette culinarie occorre configurare il modello come descritto nel README.

L’app funziona senza Internet con il server domestico raggiungibile. Quando manca anche la rete locale, la PWA offre una copia in consultazione, con data visibile e modifiche bloccate. Non implementa sincronizzazione multi-dispositivo senza server.

Le verifiche axe aiutano a trovare problemi di accessibilità e contrasto; non costituiscono una certificazione completa con tutte le tecnologie assistive.
