import test from "node:test";
import assert from "node:assert/strict";
import { eseguiOperazione } from "../src/lib/api";
import { preferenzeIniziali } from "../src/lib/motore";
import { preparaArchivio, prodottoProva, prodottiSample, } from "./supporto-archivio";
import { ErroreApplicazione, type ArchivioFridgeBrain } from "../src/lib/servizi";
async function chiama(archivio: ArchivioFridgeBrain, percorso: string, metodo = "GET", dati?: unknown, intestazioni?: Record<string, string>) {
    try {
        const risultato = await eseguiOperazione(`/api/${percorso}`, metodo, dati, intestazioni?.["idempotency-key"], archivio);
        return Response.json(risultato, { status: metodo === "POST" && !/\/(consuma|prepara)$/.test(percorso) ? 201 : 200 });
    }
    catch (errore) {
        if (errore instanceof ErroreApplicazione)
            return Response.json({ errore: errore.message }, { status: errore.stato });
        throw errore;
    }
}
test("Il client locale e lo stato funzionano con cache vuota e non espongono cache condivise", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    const stato = await (await chiama(archivio, "stato")).json();
    assert.deepEqual(stato.inventario, []);
    assert.deepEqual(stato.posizioni, ["Frigorifero", "Freezer", "Dispensa"]);
    assert.equal((await chiama(archivio, "prodotti?codice=99999999")).status, 404);
});
test("client locale aggiunge un barcode nuovo tramite OFF e ripete la ricevuta anche senza cache o rete", async (contesto) => {
    let richieste = 0;
    const { archivio } = (await preparaArchivio(contesto, false, {
        richiediOff: async () => {
            richieste++;
            assert.equal(richieste, 1, "La ripetizione non deve contattare OFF");
            return Response.json({ status: 1, product: prodottiSample[0] });
        },
    }));
    const dati = { codice: prodottiSample[0].code, quantita: 300 };
    const intestazioni = { "idempotency-key": "acquisto-remoto" };
    const prima = await chiama(archivio, "inventario", "POST", dati, intestazioni);
    assert.equal(prima.status, 201);
    const salvata = await prima.json();
    assert.equal(salvata.prodotto.product_name, prodottiSample[0].product_name);
    await archivio.database.cache_prodotti_off.clear();
    const ripetuta = await chiama(archivio, "inventario", "POST", dati, intestazioni);
    assert.equal(ripetuta.status, 201);
    assert.deepEqual(await ripetuta.json(), salvata);
    assert.equal((await archivio.inventario()).length, 1);
    assert.equal(richieste, 1);
});
test("client locale lookup conserva zeri iniziali e distingue prodotto assente e codice invalido", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto));
    const atteso = prodottiSample[0];
    const risposta = await chiama(archivio, `prodotti?codice=${atteso.code}`);
    assert.equal(risposta.status, 200);
    const prodotto = await risposta.json();
    assert.equal(prodotto.code, atteso.code);
    assert.equal(prodotto.product_name, atteso.product_name);
    assert.deepEqual(prodotto.nutriments, atteso.nutriments);
    assert.equal((await chiama(archivio, "prodotti?codice=99999999")).status, 404);
    const errore = await chiama(archivio, "prodotti?codice=abc");
    assert.equal(errore.status, 400);
    assert.match((await errore.json()).errore, /codice a barre/);
});
test("client locale completa creazione personalizzato, nuova scansione, inventario e storico", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    assert.equal((await chiama(archivio, "prodotti", "POST", prodottoProva)).status, 201);
    const trovato = await (await chiama(archivio, `prodotti?codice=${prodottoProva.code}`)).json();
    assert.equal(trovato.product_name, prodottoProva.product_name);
    assert.equal(trovato.personalizzato, true);
    const aggiunta = await chiama(archivio, "inventario", "POST", {
        codice: trovato.code,
        confezioni: 2,
        quantita: 500,
        unita: "g",
        posizione: "Frigorifero",
        scadenza: "2030-06-01",
    });
    assert.equal(aggiunta.status, 201);
    const voce = await aggiunta.json();
    const modifica = await chiama(archivio, `inventario/${voce.id}`, "PATCH", {
        quantita: 450,
        posizione: "Dispensa",
    });
    assert.equal(modifica.status, 200);
    assert.equal((await modifica.json()).posizione, "Dispensa");
    assert.equal((await chiama(archivio, `inventario/${voce.id}/consuma`, "POST", { quantita: 50 }, { "idempotency-key": "api-consumo" })).status, 200);
    assert.equal((await chiama(archivio, `inventario/${voce.id}/consuma`, "POST", { quantita: 50 }, { "idempotency-key": "api-consumo" })).status, 200);
    const aggiornata = await (await chiama(archivio, `inventario/${voce.id}`)).json();
    assert.equal(aggiornata.quantita, 400);
    assert.equal((await chiama(archivio, `inventario/${voce.id}`, "DELETE")).status, 200);
    const storico = await (await chiama(archivio, "storico")).json();
    assert.deepEqual(storico.map((evento: {
        azione: string;
    }) => evento.azione), ["eliminazione", "consumo"]);
});
test("client locale spesa e preferenze gestiscono modifiche e validazione", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    const voce = await (await chiama(archivio, "spesa", "POST", {
        nome: "Pere",
        quantita: "4 pezzi",
    })).json();
    const modificata = await chiama(archivio, `spesa/${voce.id}`, "PATCH", {
        completato: true,
    });
    assert.equal((await modificata.json()).completato, true);
    assert.equal((await chiama(archivio, "spesa", "POST", { nome: "" })).status, 400);
    assert.equal((await chiama(archivio, `spesa/${voce.id}`, "PATCH", {
        completato: "true",
    })).status, 400);
    assert.equal((await chiama(archivio, "preferenze", "PUT", {
        ...preferenzeIniziali,
        allergeni: ["glutine"],
        limiti: [{ nutriente: "zuccheri", massimo: 10 }],
    })).status, 200);
    assert.deepEqual((await (await chiama(archivio, "preferenze")).json()).allergeni, ["glutine"]);
    assert.equal((await chiama(archivio, "preferenze", "PUT", {
        ...preferenzeIniziali,
        limiti: [{ nutriente: "diabete", massimo: 10 }],
    })).status, 400);
    assert.equal((await chiama(archivio, `spesa/${voce.id}`, "DELETE")).status, 200);
});
test("client locale ripete aggiunte di prodotto, inventario e spesa senza duplicarle dopo una risposta persa", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    const casi = [
        { percorso: "prodotti", dati: prodottoProva, chiave: "nuovo-prodotto" },
        {
            percorso: "inventario",
            dati: { codice: prodottoProva.code, quantita: 400, unita: "g" },
            chiave: "nuovo-inventario",
        },
        {
            percorso: "spesa",
            dati: { nome: "Pomodori", quantita: "500 g" },
            chiave: "nuova-spesa",
        },
    ];
    for (const caso of casi) {
        const prima = await chiama(archivio, caso.percorso, "POST", caso.dati, {
            "idempotency-key": caso.chiave,
        });
        const ripetuta = await chiama(archivio, caso.percorso, "POST", caso.dati, {
            "idempotency-key": caso.chiave,
        });
        assert.equal(prima.status, 201);
        assert.equal(ripetuta.status, 201);
        assert.deepEqual(await prima.json(), await ripetuta.json());
    }
    assert.equal((await archivio.inventario()).length, 1);
    assert.equal((await archivio.spesa()).length, 1);
    assert.equal((await chiama(archivio, "spesa", "POST", { nome: "Pere" }, { "idempotency-key": "nuova-spesa" })).status, 409);
    assert.equal((await chiama(archivio, "spesa", "POST", { nome: "Pomodori", quantita: "500 g" }, { "idempotency-key": "nuovo-inventario" })).status, 409);
    assert.equal((await chiama(archivio, "spesa", "POST", { nome: "Pomodori" }, { "idempotency-key": "x".repeat(101) })).status, 400);
    assert.equal((await archivio.spesa()).length, 1);
});
test("client locale valida identificatori e risponde con errori comprensibili per risorse inesistenti", async (contesto) => {
    const { archivio } = (await preparaArchivio(contesto, false));
    assert.equal((await chiama(archivio, "inventario/abc", "DELETE")).status, 400);
    assert.equal((await chiama(archivio, "inventario/9007199254740994", "DELETE")).status, 400);
    assert.equal((await chiama(archivio, "inventario/777", "DELETE")).status, 404);
    assert.equal((await chiama(archivio, "sconosciuto")).status, 404);
    assert.equal((await chiama(archivio, "inventario", "PUT", {})).status, 405);
});
test("client locale ricette segnala provider disabilitato senza compromettere inventario e spesa", async (contesto) => {
    const precedente = process.env.FRIDGEBRAIN_GENERATORE;
    process.env.FRIDGEBRAIN_GENERATORE = "disabilitato";
    contesto.after(() => {
        if (precedente === undefined)
            delete process.env.FRIDGEBRAIN_GENERATORE;
        else
            process.env.FRIDGEBRAIN_GENERATORE = precedente;
    });
    const { archivio } = (await preparaArchivio(contesto, false));
    const ricetta = await chiama(archivio, "ricette", "POST", {
        ...preferenzeIniziali,
        persone: 2,
        tempo_massimo: 30,
    });
    assert.equal(ricetta.status, 503);
    assert.match((await ricetta.json()).errore, /disabilitato/);
    assert.equal((await chiama(archivio, "spesa", "POST", { nome: "Pasta" })).status, 201);
    assert.equal((await chiama(archivio, "inventario")).status, 200);
});
test("client locale genera ricetta con nutrienti deterministici e conferma consumo una volta sola", async (contesto) => {
    const precedente = process.env.FRIDGEBRAIN_GENERATORE;
    process.env.FRIDGEBRAIN_GENERATORE = "simulato";
    contesto.after(() => {
        if (precedente === undefined)
            delete process.env.FRIDGEBRAIN_GENERATORE;
        else
            process.env.FRIDGEBRAIN_GENERATORE = precedente;
    });
    const { archivio } = (await preparaArchivio(contesto, false));
    await chiama(archivio, "prodotti", "POST", prodottoProva);
    const voce = await (await chiama(archivio, "inventario", "POST", {
        codice: prodottoProva.code,
        quantita: 300,
        unita: "g",
        scadenza: "2100-01-01",
    })).json();
    const risposta = await chiama(archivio, "ricette", "POST", {
        ...preferenzeIniziali,
        persone: 1,
        tempo_massimo: 30,
        limiti: [{ nutriente: "proteine", minimo: 5 }],
    });
    assert.equal(risposta.status, 201);
    const ricetta = await risposta.json();
    assert.equal(ricetta.nutrizione.per_porzione.calorie, 120);
    assert.equal(ricetta.nutrizione.per_porzione.proteine, 7);
    assert.equal(ricetta.provider, "simulato");
    assert.equal((await chiama(archivio, `ricette/${ricetta.id}/prepara`, "POST")).status, 200);
    assert.equal((await chiama(archivio, `ricette/${ricetta.id}/prepara`, "POST")).status, 200);
    assert.equal((await archivio.voce(voce.id)).quantita, 200);
    const impossibile = await chiama(archivio, "ricette", "POST", {
        ...preferenzeIniziali,
        persone: 1,
        tempo_massimo: 30,
        limiti: [{ nutriente: "proteine", minimo: 900 }],
    });
    assert.equal(impossibile.status, 422);
});
