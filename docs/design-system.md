# Design system FridgeBrain

La cucina è il contesto d'uso: pochi gesti, informazioni leggibili e una gerarchia calma. La Home presenta prima scadenze e disponibilità; il generatore rimane una funzione discreta.

## Fondamenti

- Fondo avorio `#f7f8f2`, superficie bianca `#ffffff`, testo grafite `#27372e`.
- Verde profondo `#204d37` per azioni primarie, verde naturale `#477856`, salvia `#e6eddf` per superfici secondarie.
- Testo secondario `#647065`, bordi `#dce3d8`, ambra `#8a5809` su `#fff2d8`, rosso `#a53d36` su `#fcebe7`.
- Caratteri di sistema locali: Segoe UI, Arial, sans-serif; nessun font remoto. Titoli compatti, pesi 500–700; corpo 16 px; metadati almeno 13 px. Numeri tabulari per quantità e nutrienti.
- Spaziatura su base 4 px: 4, 8, 12, 16, 24, 32, 48 e 64. Contenuto desktop massimo 1160 px, margine mobile 20 px.
- Raggi: 8 px input, 10 px pulsanti, 16 px pannelli; pillole riservate a filtri e badge. Ombra soltanto per dialoghi e navigazione mobile.

## Componenti e stati

Pulsanti con icona outline e testo, altezza minima 44 px. Azione primaria verde, secondaria trasparente con bordo. Campi sempre etichettati; descrizioni e errori adiacenti. Focus visibile a doppio contrasto e navigazione completa da tastiera. I modali nativi gestiscono focus e Escape, restituiscono il focus al controllo originale e usano larghezza contenuta su desktop.

Le liste alimentari sono righe con separatori, identificatore grafico locale, nome, marca, quantità, posizione e scadenza testuale. Le card si usano soltanto per gruppi funzionali distinti. Le scadenze riportano «Scaduto», «Scade oggi», «Scade domani», «Tra N giorni» e «Scadenza non indicata» oltre al colore. I prodotti scaduti sono sempre separabili mediante filtro.

Toast `role=status` per le conferme; errori `role=alert` persistenti fino a correzione. Durante il caricamento, testo esplicito e indicatore essenziale; pulsanti disabilitati durante le mutazioni. Stati vuoti con icona, breve spiegazione e azione pertinente. Movimento di 150 ms, disabilitato con `prefers-reduced-motion`.

## Navigazione e adattamento

Su smartphone una barra inferiore persistente offre Home, Inventario, Aggiungi, Ricette, Spesa. Aggiungi è evidenziato; Impostazioni è nell'intestazione. Sul desktop la stessa navigazione passa nell'intestazione orizzontale. Home a due colonne e ricetta a ingredienti/procedimento affiancati; tablet usa due colonne dove lo spazio lo consente. Ogni schermata resta leggibile a 360 px senza scorrimento orizzontale.

Lo scanner presenta un'area fotocamera dominante, cornice e istruzione breve. Inserimento manuale sempre visibile; errori di permesso e indisponibilità hanno testo chiaro e possibilità di riprovare. Dopo un codice letto, la fotocamera si interrompe per evitare duplicazioni.

I nutrienti assenti vengono mostrati come «Dato sconosciuto» e mai zero. Gli allergeni distinguono dichiarazione, tracce, assenza di dichiarazione e informazione sconosciuta; l'etichetta fisica resta il riferimento. Nessun indicatore promette sicurezza medica.

## Verifica della leggibilità

I metadati e le etichette operative mantengono almeno 13 px anche su telefono; la sola dicitura incorporata nel marchio conserva la dimensione del logotipo. Su smartphone i nutrienti usano due colonne e valori da 22 px. Le spunte della spesa e le etichette delle caselle di selezione offrono almeno 44 px di altezza interattiva. Il messaggio introduttivo della Home si compatta su mobile per mostrare riepilogo e priorità nel primo schermo. Il collegamento per saltare al contenuto rimane visivamente nascosto fino al focus da tastiera.
