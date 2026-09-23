import test from "node:test";
import assert from "node:assert/strict";
import { preferenzeIniziali, scortaInEsaurimento } from "../src/lib/motore";
import { ArchivioFridgeBrain, ErroreApplicazione, validaScadenza, } from "../src/lib/servizi";
import { preparaArchivio, prodottoProva, prodottiSample, } from "./supporto-archivio";
test("venti barcode del sample restituiscono il prodotto esatto e tutti i nutrienti originali", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    assert.ok(prodottiSample.length >= 20);
    for (const atteso of prodottiSample) {
        const trovato = (await archivio.prodotto(atteso.code));
        assert.equal(trovato.code, atteso.code);
        assert.equal(trovato.product_name, atteso.product_name);
        assert.deepEqual(trovato.nutriments, atteso.nutriments);
        assert.equal(trovato.ingredients_text, atteso.ingredients_text);
        assert.deepEqual(trovato.allergens_tags, atteso.allergens_tags);
    }
});
test("ricerca testuale in cache gestisce prefissi, marca e punteggiatura senza errori SQL", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const atteso = prodottiSample[0];
    const parola = atteso.product_name.match(/[\p{L}\p{N}]{3,}/u)![0];
    assert.ok((await archivio
        .cercaProdotti(parola))
        .some((prodotto) => prodotto.code === atteso.code));
    assert.ok((await archivio
        .cercaProdotti(atteso.code))
        .some((prodotto) => prodotto.code === atteso.code));
    assert.deepEqual((await archivio.cercaProdotti('"* ()')), []);
});
test("aggiunta, modifica posizione, data e quantità conservano lo snapshot indipendente dalla cache", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const prodotto = prodottiSample[0];
    const voce = (await archivio.aggiungiInventario({
        codice: prodotto.code,
        confezioni: 2,
        quantita: 500,
        unita: "g",
        posizione: "Frigorifero",
        scadenza: "2030-02-28",
    }));
    assert.equal(voce.prodotto.code, prodotto.code);
    const modificata = (await archivio.modificaInventario(voce.id, {
        quantita: 300,
        posizione: "Freezer",
        scadenza: null,
    }));
    assert.equal(modificata.quantita, 300);
    assert.equal(modificata.posizione, "Freezer");
    assert.equal(modificata.scadenza, null);
    await archivio.database.cache_prodotti_off.clear();
    assert.equal((await archivio.stato()).catalogo_disponibile, true);
    assert.equal((await archivio.voce(voce.id)).prodotto.product_name, prodotto.product_name);
    assert.deepEqual((await archivio.voce(voce.id)).prodotto.nutriments, prodotto.nutriments);
});
test("prodotti personalizzati funzionano senza cache OFF e distinguono nutrienti mancanti da zero", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    const prodotto = (await archivio.salvaProdotto({
        code: "00001234",
        product_name: "Prodotto di casa",
        nutriments: { sugars_100g: 0, proteins_100g: null },
    }));
    assert.equal((await archivio.prodotto("00001234")).code, "00001234");
    assert.equal(prodotto.nutriments?.sugars_100g, 0);
    assert.equal(prodotto.nutriments?.proteins_100g, null);
    assert.equal(prodotto.nutriments?.fat_100g, undefined);
    const voce = (await archivio.aggiungiInventario({ codice: prodotto.code }));
    assert.equal(voce.quantita, null);
    assert.equal((await archivio.stato()).catalogo_disponibile, true);
    await assert.rejects(async () => (await archivio.prodotto("99999999")), (errore) => errore instanceof ErroreApplicazione && errore.stato === 404);
});
test("date impossibili, quantità negative, infinite e unità sconosciute vengono rifiutate", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const codice = prodottiSample[0].code;
    for (const quantita of [-1, 0, NaN, Infinity, "100"])
        await assert.rejects(async () => (await archivio.aggiungiInventario({ codice, quantita })), /Quantità/);
    for (const confezioni of [-1, 0, 1.5, NaN])
        await assert.rejects(async () => (await archivio.aggiungiInventario({ codice, confezioni })), /Confezioni/);
    for (const scadenza of ["2027-02-29", "2026-13-01", "2026-04-31", "oggi", 17])
        assert.throws(() => validaScadenza(scadenza), /scadenza/);
    assert.equal(validaScadenza("2028-02-29"), "2028-02-29");
    await assert.rejects(async () => (await archivio.aggiungiInventario({ codice, posizione: "Sconosciuta" })), /posizione/);
    await assert.rejects(async () => (await archivio.aggiungiInventario({ codice, unita: "kg" })), /unità/);
    await assert.rejects(async () => (await archivio.aggiungiInventario({ codice, unita: "pz", quantita: 1.5 })), /Quantità/);
    assert.equal((await archivio.inventario()).length, 0);
});
test("consumo parziale è atomico, idempotente con chiave e non consente quantità eccessive", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const voce = (await archivio.aggiungiInventario({
        codice: prodottiSample[0].code,
        quantita: 300,
        unita: "g",
    }));
    (await archivio.consumaInventario(voce.id, { quantita: 80 }, "operazione-uno"));
    (await archivio.consumaInventario(voce.id, { quantita: 80 }, "operazione-uno"));
    assert.equal((await archivio.voce(voce.id)).quantita, 220);
    assert.equal((await archivio.storico()).length, 1);
    await assert.rejects(async () => (await archivio.consumaInventario(voce.id, { quantita: 90 }, "operazione-uno")), /dati diversi/);
    await assert.rejects(async () => (await archivio.consumaInventario(voce.id, { quantita: 221 })), /supera/);
    assert.equal((await archivio.voce(voce.id)).quantita, 220);
    (await archivio.consumaInventario(voce.id, {}));
    assert.equal((await archivio.inventario()).length, 0);
    assert.equal((await archivio.storico()).length, 2);
});
test("quantità non misurata permette consumo totale ma impedisce quello parziale", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const voce = (await archivio.aggiungiInventario({
        codice: prodottiSample[0].code,
        confezioni: 3,
    }));
    await assert.rejects(async () => (await archivio.consumaInventario(voce.id, { quantita: 1 })), /quantità residua/);
    (await archivio.consumaInventario(voce.id, {}));
    assert.equal((await archivio.inventario()).length, 0);
});
test("ricevuta aggiunta resta valida senza cache e una chiave nuova consente un acquisto uguale", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const dati = {
        codice: prodottiSample[0].code,
        confezioni: 2,
        quantita: 500,
        unita: "g",
    };
    const prima = (await archivio.aggiungiInventario(dati, "acquisto-uno"));
    await archivio.database.cache_prodotti_off.clear();
    assert.deepEqual((await archivio.aggiungiInventario({
        unita: "g",
        quantita: 500,
        confezioni: 2,
        codice: prodottiSample[0].code,
    }, "acquisto-uno")), prima);
    assert.equal((await archivio.inventario()).length, 1);
    await assert.rejects(async () => (await archivio.aggiungiInventario({ ...dati, quantita: 600 }, "acquisto-uno")), /dati diversi/);
    for (const prodotto of prodottiSample)
        (await archivio.salvaCacheOff(prodotto));
    const seconda = (await archivio.aggiungiInventario(dati, "acquisto-due"));
    assert.notEqual(seconda.id, prima.id);
    assert.equal((await archivio.inventario()).length, 2);
});
test("una creazione fallita non prenota la chiave e non ostacola il tentativo corretto", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    const dati = { codice: prodottoProva.code, quantita: 400, unita: "g" };
    await assert.rejects(async () => (await archivio.aggiungiInventario(dati, "creazione-da-riprovare")), /non trovato/);
    (await archivio.salvaProdotto(prodottoProva));
    const voce = (await archivio.aggiungiInventario(dati, "creazione-da-riprovare"));
    assert.equal((await archivio.aggiungiInventario(dati, "creazione-da-riprovare")).id, voce.id);
    assert.equal((await archivio.inventario()).length, 1);
});
test("eliminazione registra storico e posizioni personalizzate proteggono i prodotti presenti", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    (await archivio.aggiungiPosizione({ nome: "Cantina" }));
    const voce = (await archivio.aggiungiInventario({
        codice: prodottiSample[0].code,
        posizione: "Cantina",
    }));
    await assert.rejects(async () => (await archivio.eliminaPosizione("Cantina")), /Sposta/);
    (await archivio.eliminaInventario(voce.id));
    (await archivio.eliminaPosizione("Cantina"));
    assert.equal((await archivio.posizioni()).includes("Cantina"), false);
    assert.equal((await archivio.storico())[0].azione, "eliminazione");
    await assert.rejects(async () => (await archivio.eliminaPosizione("Frigorifero")), /iniziali/);
});
test("modifica o eliminazione del personalizzato non altera i prodotti già posseduti", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    (await archivio.salvaProdotto(prodottoProva));
    const voce = (await archivio.aggiungiInventario({ codice: prodottoProva.code }));
    (await archivio.salvaProdotto({ ...prodottoProva, product_name: "Nuova etichetta" }, prodottoProva.code));
    assert.equal((await archivio.prodotto(prodottoProva.code)).product_name, "Nuova etichetta");
    assert.equal((await archivio.voce(voce.id)).prodotto.product_name, prodottoProva.product_name);
    (await archivio.eliminaProdotto(prodottoProva.code));
    assert.equal((await archivio.voce(voce.id)).prodotto.product_name, prodottoProva.product_name);
});
test("lista della spesa riordina la spunta e salva preferenze con limiti verificabili", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const prima = (await archivio.aggiungiSpesa({ nome: "Pomodori", quantita: "500 g" }));
    const seconda = (await archivio.aggiungiSpesa({
        nome: "Pane",
        quantita: "1 confezione",
    }));
    (await archivio.modificaSpesa(seconda.id, { completato: true }));
    assert.equal((await archivio.spesa())[0].id, prima.id);
    (await archivio.eliminaSpesa(prima.id));
    assert.equal((await archivio.spesa()).length, 1);
    const preferenze = {
        ...preferenzeIniziali,
        regime: "vegano",
        allergeni: ["glutine"],
        limiti: [{ nutriente: "sale", massimo: 1.2 }],
    };
    assert.deepEqual((await archivio.salvaPreferenze(preferenze)), preferenze);
    assert.deepEqual((await archivio.preferenze()), preferenze);
    await assert.rejects(async () => (await archivio.salvaPreferenze({
        ...preferenze,
        limiti: [{ nutriente: "proteine", minimo: 20, massimo: 10 }],
    })), /minimo/);
    await assert.rejects(async () => (await archivio.salvaPreferenze({ ...preferenze, priorita_scadenza: "sì" })), /valore non valido/);
});
test("cache vuota lascia disponibili i dati personali", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    (await archivio.salvaProdotto(prodottoProva));
    const voce = (await archivio.aggiungiInventario({ codice: prodottoProva.code }));
    await archivio.database.cache_prodotti_off.clear();
    assert.equal((await archivio.stato()).catalogo_disponibile, true);
    assert.equal((await archivio.voce(voce.id)).prodotto.code, prodottoProva.code);
});
test("ricetta preparata consuma esattamente gli ingredienti e una conferma ripetuta è innocua", async (contesto) => {
    const precedente = process.env.FRIDGEBRAIN_GENERATORE;
    process.env.FRIDGEBRAIN_GENERATORE = "simulato";
    contesto.after(() => {
        if (precedente === undefined)
            delete process.env.FRIDGEBRAIN_GENERATORE;
        else
            process.env.FRIDGEBRAIN_GENERATORE = precedente;
    });
    const { archivio } = (await preparaArchivio(contesto, false));
    (await archivio.salvaProdotto(prodottoProva));
    const voce = (await archivio.aggiungiInventario({
        codice: prodottoProva.code,
        quantita: 400,
        scadenza: "2100-01-01",
    }));
    const ricetta = await archivio.generaRicetta({
        ...preferenzeIniziali,
        persone: 2,
        tempo_massimo: 30,
    });
    assert.equal(ricetta.nutrizione.totale.calorie, 240);
    assert.equal(ricetta.nutrizione.per_porzione.calorie, 120);
    (await archivio.preparaRicetta(ricetta.id));
    (await archivio.preparaRicetta(ricetta.id));
    assert.equal((await archivio.voce(voce.id)).quantita, 200);
    assert.ok((await archivio.ricetta(ricetta.id)).preparata_il);
    assert.equal((await archivio.storico()).filter((evento) => evento.azione === "ricetta_preparata")
        .length, 1);
});
test("consumo ricetta rivalida quantità, scadenza e preferenze aggiornate prima di ogni modifica", async (contesto) => {
    const precedente = process.env.FRIDGEBRAIN_GENERATORE;
    process.env.FRIDGEBRAIN_GENERATORE = "simulato";
    contesto.after(() => {
        if (precedente === undefined)
            delete process.env.FRIDGEBRAIN_GENERATORE;
        else
            process.env.FRIDGEBRAIN_GENERATORE = precedente;
    });
    const { archivio } = (await preparaArchivio(contesto, false));
    (await archivio.salvaProdotto(prodottoProva));
    const voce = (await archivio.aggiungiInventario({
        codice: prodottoProva.code,
        quantita: 400,
        scadenza: "2100-01-01",
    }));
    const ricetta = await archivio.generaRicetta({
        ...preferenzeIniziali,
        persone: 2,
        tempo_massimo: 30,
    });
    (await archivio.modificaInventario(voce.id, { quantita: 100 }));
    await assert.rejects(async () => (await archivio.preparaRicetta(ricetta.id)), /Quantità/);
    assert.equal((await archivio.voce(voce.id)).quantita, 100);
    (await archivio.modificaInventario(voce.id, {
        quantita: 400,
        scadenza: "2000-01-01",
    }));
    await assert.rejects(async () => (await archivio.preparaRicetta(ricetta.id)), /scaduto/);
    (await archivio.modificaInventario(voce.id, { scadenza: "2100-01-01" }));
    (await archivio.salvaPreferenze({ ...preferenzeIniziali, esclusioni: ["ceci"] }));
    await assert.rejects(async () => (await archivio.preparaRicetta(ricetta.id)), /incompatibile/);
    assert.equal((await archivio.voce(voce.id)).quantita, 400);
    assert.equal((await archivio.ricetta(ricetta.id)).preparata_il, null);
    assert.equal((await archivio.storico()).length, 0);
});
test("preferenze salvate filtrano gli ingredienti prima della generazione anche se omesse nella richiesta", async (contesto) => {
    const precedente = process.env.FRIDGEBRAIN_GENERATORE;
    process.env.FRIDGEBRAIN_GENERATORE = "simulato";
    contesto.after(() => {
        if (precedente === undefined)
            delete process.env.FRIDGEBRAIN_GENERATORE;
        else
            process.env.FRIDGEBRAIN_GENERATORE = precedente;
    });
    const { archivio } = (await preparaArchivio(contesto, false));
    (await archivio.salvaProdotto(prodottoProva));
    (await archivio.salvaProdotto({
        ...prodottoProva,
        code: "8000000000022",
        product_name: "Lenticchie lessate di prova",
        ingredients_text: "Lenticchie, acqua",
    }));
    (await archivio.aggiungiInventario({
        codice: prodottoProva.code,
        quantita: 400,
        scadenza: "2100-01-01",
    }));
    const compatibile = (await archivio.aggiungiInventario({
        codice: "8000000000022",
        quantita: 400,
        scadenza: "2100-01-02",
    }));
    (await archivio.salvaPreferenze({
        ...preferenzeIniziali,
        esclusioni: ["ceci"],
        regime: "vegano",
        allergeni: ["glutine"],
    }));
    const ricetta = await archivio.generaRicetta({
        ...preferenzeIniziali,
        persone: 1,
        tempo_massimo: 30,
    });
    assert.deepEqual(ricetta.ingredienti.map((ingrediente) => ingrediente.inventario_id), [compatibile.id]);
});
test("limiti incompatibili tra richiesta e preferenze sono rifiutati senza salvare ricette", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    (await archivio.salvaPreferenze({
        ...preferenzeIniziali,
        limiti: [{ nutriente: "proteine", minimo: 20 }],
    }));
    await assert.rejects(archivio.generaRicetta({
        ...preferenzeIniziali,
        persone: 1,
        tempo_massimo: 30,
        limiti: [{ nutriente: "proteine", massimo: 10 }],
    }), /minimo/);
    assert.equal((await archivio.ricette()).length, 0);
});
test("le scorte minime sono esplicite, seguono il consumo e si possono disattivare", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    (await archivio.salvaProdotto(prodottoProva));
    const voce = (await archivio.aggiungiInventario({
        codice: prodottoProva.code,
        quantita: 500,
        unita: "g",
        scorta_minima: 100,
    }));
    assert.equal(scortaInEsaurimento(voce), false);
    (await archivio.consumaInventario(voce.id, { quantita: 400 }));
    assert.equal(scortaInEsaurimento((await archivio.voce(voce.id))), true);
    assert.equal((await archivio.modificaInventario(voce.id, { posizione: "Freezer" })).scorta_minima, 100);
    await assert.rejects(async () => (await archivio.modificaInventario(voce.id, { scorta_minima: -1 })), /Scorta minima/);
    await assert.rejects(async () => (await archivio.modificaInventario(voce.id, { quantita: null })), /quantità residua/);
    assert.equal(scortaInEsaurimento((await archivio.modificaInventario(voce.id, { scorta_minima: null }))), false);
    assert.equal(scortaInEsaurimento({ ...voce, quantita: null }), false);
});
test("IndexedDB conserva inventario e scorte dopo chiusura e riapertura", async (contesto) => {
    const { archivio } = await preparaArchivio(contesto, false);
    await archivio.salvaProdotto(prodottoProva);
    const voce = await archivio.aggiungiInventario({ codice: prodottoProva.code, quantita: 500, scorta_minima: 100 });
    const nomeDatabase = archivio.database.name;
    archivio.chiudi();
    const riaperto = new ArchivioFridgeBrain({ nomeDatabase });
    try {
        assert.deepEqual(await riaperto.voce(voce.id), voce);
    }
    finally {
        riaperto.chiudi();
    }
});
