import type {
  EventoStorico,
  Preferenze,
  Prodotto,
  RichiestaRicetta,
  Ricetta,
  StatoApplicazione,
  Unita,
  VoceInventario,
  VoceSpesa,
} from "./tipi";
import { DatabaseFridgeBrain, type ConfigurazioneArchivio } from "./database";
import {
  generaRicettaVerificata,
  preferenzeIniziali,
  validaRicetta,
} from "./motore";

import { recuperaDaOff, ErroreOpenFoodFacts } from "./open-food-facts";

type Oggetto = Record<string, unknown>;
const nutrienti = [
  "calorie",
  "carboidrati",
  "zuccheri",
  "proteine",
  "grassi",
  "fibre",
  "sale",
];

export class ErroreApplicazione extends Error {
  constructor(
    messaggio: string,
    readonly stato = 400,
  ) {
    super(messaggio);
  }
}

export function oggetto(valore: unknown): Oggetto {
  if (!valore || typeof valore !== "object" || Array.isArray(valore))
    throw new ErroreApplicazione("I dati inviati non sono validi.");
  return valore as Oggetto;
}

export function testo(
  valore: unknown,
  nome: string,
  massimo = 200,
  vuoto = false,
): string {
  if (
    typeof valore !== "string" ||
    valore.length > massimo ||
    (!vuoto && !valore.trim())
  )
    throw new ErroreApplicazione(
      `${nome}: inserisci un testo valido, fino a ${massimo} caratteri.`,
    );
  return valore.trim();
}

export function numero(
  valore: unknown,
  nome: string,
  minimo = 0,
  massimo = 1_000_000,
  intero = false,
): number {
  if (
    typeof valore !== "number" ||
    !Number.isFinite(valore) ||
    valore < minimo ||
    valore > massimo ||
    (intero && !Number.isInteger(valore))
  )
    throw new ErroreApplicazione(
      `${nome}: inserisci ${intero ? "un numero intero" : "un numero"} tra ${minimo} e ${massimo}.`,
    );
  return valore;
}

function booleano(valore: unknown, nome: string): boolean {
  if (typeof valore !== "boolean")
    throw new ErroreApplicazione(`${nome}: valore non valido.`);
  return valore;
}

function elenco(valore: unknown, nome: string): string[] {
  if (!Array.isArray(valore) || valore.length > 100)
    throw new ErroreApplicazione(`${nome}: elenco non valido.`);
  return [
    ...new Set(valore.map((voce) => testo(voce, nome, 100).toLowerCase())),
  ];
}

export function validaCodice(valore: unknown): string {
  const codice = testo(valore, "Codice a barre", 32);
  if (!/^\d{4,32}$/.test(codice))
    throw new ErroreApplicazione(
      "Il codice a barre deve contenere da 4 a 32 cifre.",
    );
  return codice;
}

function codiciGtinEquivalenti(codice: string): string[] {
  if (![8, 12, 13, 14].includes(codice.length)) return [];
  const somma = [...codice.slice(0, -1)]
    .reverse()
    .reduce(
      (totale, cifra, indice) =>
        totale + Number(cifra) * (indice % 2 === 0 ? 3 : 1),
      0,
    );
  if ((10 - (somma % 10)) % 10 !== Number(codice.at(-1))) return [];
  // UPC-A ed EAN possono rappresentare lo stesso GTIN con soli zeri di riempimento.
  // Gli indicatori di imballaggio non zero e i codici interni non si modificano.
  const completo = codice.padStart(14, "0");
  return [13, 12, 14, 8]
    .filter((lunghezza) => /^0*$/.test(completo.slice(0, 14 - lunghezza)))
    .map((lunghezza) => completo.slice(-lunghezza))
    .filter((equivalente) => equivalente !== codice);
}

export function validaScadenza(valore: unknown): string | null {
  if (valore === null || valore === "") return null;
  if (typeof valore !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valore))
    throw new ErroreApplicazione(
      "La scadenza deve essere una data nel formato anno-mese-giorno.",
    );
  const istante = new Date(`${valore}T12:00:00Z`);
  if (
    !Number.isFinite(istante.getTime()) ||
    istante.toISOString().slice(0, 10) !== valore ||
    valore < "1900-01-01" ||
    valore > "2200-12-31"
  )
    throw new ErroreApplicazione(
      "La data di scadenza non esiste o non è valida.",
    );
  return valore;
}

function unita(valore: unknown): Unita {
  if (valore !== "g" && valore !== "ml" && valore !== "pz")
    throw new ErroreApplicazione("L'unità deve essere g, ml oppure pz.");
  return valore;
}

export function validaPreferenze(valore: unknown): Preferenze {
  const dati = oggetto(valore);
  if (
    typeof dati.regime !== "string" ||
    !["onnivoro", "vegetariano", "vegano"].includes(dati.regime)
  )
    throw new ErroreApplicazione("Il regime alimentare non è valido.");
  if (!Array.isArray(dati.limiti) || dati.limiti.length > 14)
    throw new ErroreApplicazione("I limiti nutrizionali non sono validi.");
  const limiti = dati.limiti.map((valoreLimite) => {
    const limite = oggetto(valoreLimite);
    if (
      typeof limite.nutriente !== "string" ||
      !nutrienti.includes(limite.nutriente)
    )
      throw new ErroreApplicazione("Il nutriente selezionato non è valido.");
    if (limite.minimo === undefined && limite.massimo === undefined)
      throw new ErroreApplicazione(
        "Ogni limite richiede un minimo o un massimo.",
      );
    const minimo =
      limite.minimo === undefined
        ? undefined
        : numero(limite.minimo, "Limite minimo");
    const massimo =
      limite.massimo === undefined
        ? undefined
        : numero(limite.massimo, "Limite massimo");
    if (minimo !== undefined && massimo !== undefined && minimo > massimo)
      throw new ErroreApplicazione("Il minimo non può superare il massimo.");
    return {
      nutriente: limite.nutriente as Preferenze["limiti"][number]["nutriente"],
      ...(minimo !== undefined ? { minimo } : {}),
      ...(massimo !== undefined ? { massimo } : {}),
    };
  });
  return {
    regime: dati.regime as Preferenze["regime"],
    allergeni: elenco(dati.allergeni, "Allergeni"),
    esclusioni: elenco(dati.esclusioni, "Esclusioni"),
    limiti,
    priorita_scadenza: booleano(dati.priorita_scadenza, "Priorità scadenza"),
  };
}

export function validaRichiesta(valore: unknown): RichiestaRicetta {
  const dati = oggetto(valore);
  return {
    ...validaPreferenze(dati),
    persone: numero(dati.persone, "Persone", 1, 20, true),
    tempo_massimo: numero(dati.tempo_massimo, "Tempo massimo", 5, 480, true),
  };
}

function applicaPreferenzeSalvate(
  richiesta: RichiestaRicetta,
  preferenze: Preferenze,
): RichiestaRicetta {
  const regimi: Preferenze["regime"][] = ["onnivoro", "vegetariano", "vegano"];
  const limiti = new Map<string, Preferenze["limiti"][number]>();
  for (const limite of [...richiesta.limiti, ...preferenze.limiti]) {
    const precedente = limiti.get(limite.nutriente);
    const minimi = [limite.minimo, precedente?.minimo].filter(
      (valore): valore is number => valore !== undefined,
    );
    const massimi = [limite.massimo, precedente?.massimo].filter(
      (valore): valore is number => valore !== undefined,
    );
    limiti.set(limite.nutriente, {
      nutriente: limite.nutriente,
      ...(minimi.length ? { minimo: Math.max(...minimi) } : {}),
      ...(massimi.length ? { massimo: Math.min(...massimi) } : {}),
    });
  }
  const unite = validaPreferenze({
    ...richiesta,
    regime:
      regimi[
        Math.max(
          regimi.indexOf(richiesta.regime),
          regimi.indexOf(preferenze.regime),
        )
      ],
    allergeni: [...new Set([...richiesta.allergeni, ...preferenze.allergeni])],
    esclusioni: [
      ...new Set([...richiesta.esclusioni, ...preferenze.esclusioni]),
    ],
    limiti: [...limiti.values()],
  });
  return { ...richiesta, ...unite };
}

export function validaProdotto(valore: unknown): Prodotto {
  const dati = oggetto(valore);
  const prodotto: Prodotto = {
    code: validaCodice(dati.code),
    product_name: testo(dati.product_name, "Nome prodotto"),
    personalizzato: true,
  };
  for (const campo of ["brands", "quantity", "ingredients_text"] as const)
    if (dati[campo] !== undefined)
      prodotto[campo] = testo(
        dati[campo],
        campo === "ingredients_text"
          ? "Ingredienti"
          : campo === "brands"
            ? "Marca"
            : "Quantità dichiarata",
        campo === "ingredients_text" ? 10000 : 300,
        true,
      );
  for (const campo of [
    "allergens_tags",
    "traces_tags",
    "labels_tags",
    "ingredients_analysis_tags",
    "categories_tags",
  ] as const)
    if (dati[campo] !== undefined)
      prodotto[campo] = elenco(dati[campo], "Informazioni prodotto");
  if (dati.nutriments !== undefined) {
    const valori = oggetto(dati.nutriments);
    if (Object.keys(valori).length > 100)
      throw new ErroreApplicazione("Sono presenti troppi nutrienti.");
    prodotto.nutriments = {};
    for (const [nome, valoreNutriente] of Object.entries(valori)) {
      if (!/^[a-z0-9_-]{1,80}$/.test(nome))
        throw new ErroreApplicazione("Nome del nutriente non valido.");
      if (valoreNutriente === null) prodotto.nutriments[nome] = null;
      else if (nome.endsWith("_unit"))
        prodotto.nutriments[nome] = testo(
          valoreNutriente,
          "Unità nutrizionale",
          20,
        );
      else
        prodotto.nutriments[nome] = numero(
          valoreNutriente,
          "Valore nutrizionale",
          0,
          1_000_000,
        );
    }
  }
  if (dati.unita_nutrizionale !== undefined) {
    if (dati.unita_nutrizionale !== "g" && dati.unita_nutrizionale !== "ml")
      throw new ErroreApplicazione(
        "I nutrienti devono essere riferiti a 100 g oppure 100 ml.",
      );
    prodotto.unita_nutrizionale = dati.unita_nutrizionale;
  }
  if (dati.nutrition_data_per !== undefined)
    prodotto.nutrition_data_per = testo(
      dati.nutrition_data_per,
      "Base nutrizionale",
      30,
    );
  return prodotto;
}

export function generatoreConfigurato(): StatoApplicazione["generatore"] { return "disabilitato"; }

export class ArchivioFridgeBrain {
  readonly database: DatabaseFridgeBrain;
  private richiesteOff = new Map<string, Promise<Prodotto>>();
  private riprendiOffDal = 0;
  constructor(private readonly configurazione: ConfigurazioneArchivio = {}) { this.database = new DatabaseFridgeBrain(configurazione); }

  private async eseguiRipetibile<T>(chiave: string | undefined, firma: string, operazione: () => Promise<T>): Promise<T> {
    if (chiave !== undefined) testo(chiave, "Chiave dell'operazione", 100);
    return this.database.transazione(async () => {
      const precedente = chiave ? await this.database.operazioni.get(chiave) : undefined;
      if (precedente) {
        if (precedente.firma !== firma) throw new ErroreApplicazione("Questa operazione è già stata usata con dati diversi.", 409);
        return precedente.risultato as T;
      }
      const risultato = await operazione();
      if (chiave) await this.database.operazioni.add({chiave, firma, risultato, creato_il: new Date().toISOString()});
      return risultato;
    });
  }
  async stato(): Promise<StatoApplicazione> {
    return this.database.transaction("r", this.database.tables, async () => ({
      inventario: await this.inventario(), spesa: await this.spesa(), ricette: await this.ricette(),
      preferenze: await this.preferenze(), posizioni: await this.posizioni(), catalogo_disponibile: true,
      generatore: this.configurazione.generatore ? "simulato" : "disabilitato",
    }));
  }
  async posizioni(): Promise<string[]> {
    return (await this.database.posizioni.toArray()).map((riga) => riga.nome).sort((a,b) => {
      const ordine = (nome: string) => ["Frigorifero", "Freezer", "Dispensa"].indexOf(nome);
      return (ordine(a) < 0 ? 3 : ordine(a)) - (ordine(b) < 0 ? 3 : ordine(b)) || a.localeCompare(b);
    });
  }
  async aggiungiPosizione(valore: unknown): Promise<string[]> {
    const nome = testo(oggetto(valore).nome, "Nome della posizione", 60);
    return this.database.transazione(async () => {
      if ((await this.posizioni()).some((posizione) => posizione.toLowerCase() === nome.toLowerCase())) throw new ErroreApplicazione("Esiste già una posizione con questo nome.",409);
      await this.database.posizioni.add({nome}); return this.posizioni();
    });
  }
  async eliminaPosizione(nome: string): Promise<void> {
    if (["Frigorifero", "Freezer", "Dispensa"].includes(nome)) throw new ErroreApplicazione("Le posizioni iniziali non possono essere eliminate.");
    await this.database.transazione(async () => {
      if (await this.database.inventario.where("posizione").equals(nome).count()) throw new ErroreApplicazione("Sposta prima i prodotti presenti in questa posizione.",409);
      if (!(await this.database.posizioni.get(nome))) throw new ErroreApplicazione("Posizione non trovata.",404);
      await this.database.posizioni.delete(nome);
    });
  }
  async salvaCacheOff(prodotto: Prodotto): Promise<void> {
    await this.database.transazione(async () => {
      const adesso = new Date().toISOString(); const precedente = await this.database.cache_prodotti_off.get(prodotto.code);
      await this.database.cache_prodotti_off.put({barcode: prodotto.code, dati: prodotto, recuperato_il: precedente?.recuperato_il ?? adesso, aggiornato_il: adesso});
    });
  }
  async prodotto(codiceRichiesto: unknown): Promise<Prodotto> {
    const codice = validaCodice(codiceRichiesto);
    for (const candidato of [codice, ...codiciGtinEquivalenti(codice)]) {
      const riga = await this.database.prodotti_personalizzati.get(candidato) ?? await this.database.cache_prodotti_off.get(candidato);
      if (riga) return riga.dati;
    }
    throw new ErroreApplicazione("Prodotto non trovato. Puoi inserirlo manualmente.",404);
  }
  async recuperaProdotto(codiceRichiesto: unknown): Promise<Prodotto> {
    const codice = validaCodice(codiceRichiesto);
    try { return await this.prodotto(codice); } catch (errore) { if (!(errore instanceof ErroreApplicazione) || errore.stato !== 404) throw errore; }
    const equivalenti = codiciGtinEquivalenti(codice); const chiave = [codice, ...equivalenti].sort()[0];
    const pendente = this.richiesteOff.get(chiave); if (pendente) return pendente;
    if (Date.now() < this.riprendiOffDal) throw new ErroreApplicazione("Open Food Facts ha raggiunto il limite di richieste. Attendi qualche minuto e riprova.",429);
    const richiesta = recuperaDaOff(codice, equivalenti, this.configurazione).then(async (prodotto) => { await this.salvaCacheOff(prodotto); return prodotto; }).catch((errore: unknown) => {
      if (errore instanceof ErroreOpenFoodFacts) { if (errore.stato === 429) this.riprendiOffDal = Date.now()+60_000; throw new ErroreApplicazione(errore.message, errore.stato); } throw errore;
    }).finally(() => this.richiesteOff.delete(chiave));
    this.richiesteOff.set(chiave, richiesta); return richiesta;
  }
  async cercaProdotti(valore: unknown): Promise<Prodotto[]> {
    const ricerca = testo(valore,"Ricerca",100,true).toLocaleLowerCase("it"); if (ricerca.length < 2) return [];
    const risultati = new Map<string,Prodotto>();
    for (const tabella of [this.database.prodotti_personalizzati, this.database.cache_prodotti_off]) {
      for (const riga of await tabella.filter((riga) => [riga.dati.product_name, riga.dati.brands ?? "", riga.dati.code].some((campo) => campo.toLocaleLowerCase("it").includes(ricerca))).limit(30).toArray())
        if (!risultati.has(riga.dati.code)) risultati.set(riga.dati.code, riga.dati);
    }
    return [...risultati.values()].slice(0,30);
  }
  async salvaProdotto(valore: unknown, codiceEsistente?: string, chiave?: string): Promise<Prodotto> {
    const prodotto = validaProdotto(valore);
    if (codiceEsistente && prodotto.code !== codiceEsistente) throw new ErroreApplicazione("Il codice a barre non può essere modificato.");
    const salva = async () => {
      const esiste = await this.database.prodotti_personalizzati.get(prodotto.code);
      if (codiceEsistente && !esiste) throw new ErroreApplicazione("Prodotto personalizzato non trovato.",404);
      if (!codiceEsistente && esiste) throw new ErroreApplicazione("Esiste già un prodotto personalizzato con questo codice a barre.",409);
      await this.database.prodotti_personalizzati.put({codice:prodotto.code,dati:prodotto,creato_il:esiste?.creato_il ?? new Date().toISOString()}); return prodotto;
    };
    return codiceEsistente ? this.database.transazione(salva) : this.eseguiRipetibile(chiave,JSON.stringify({azione:"creazione_prodotto",prodotto}),salva);
  }
  async eliminaProdotto(codice: string): Promise<void> {
    await this.database.transazione(async () => {
      if (!(await this.database.prodotti_personalizzati.get(validaCodice(codice)))) throw new ErroreApplicazione("Prodotto personalizzato non trovato.",404);
      await this.database.prodotti_personalizzati.delete(codice);
    });
  }
  async inventario(): Promise<VoceInventario[]> {
    return (await this.database.inventario.toArray()).sort((a,b) => (a.scadenza ?? "9999").localeCompare(b.scadenza ?? "9999") || b.inserito_il.localeCompare(a.inserito_il) || b.id-a.id);
  }
  async voce(id: number): Promise<VoceInventario> {
    const riga = await this.database.inventario.get(id); if (!riga) throw new ErroreApplicazione("Prodotto dell'inventario non trovato.",404); return riga;
  }
  private async datiInventario(
    valore: unknown,
    attuale?: VoceInventario,
  ): Promise<Pick<
    VoceInventario,
    | "confezioni"
    | "quantita"
    | "unita"
    | "posizione"
    | "scadenza"
    | "scorta_minima"
  >> {
    const dati = oggetto(valore);
    const confezioni = numero(
      dati.confezioni === undefined
        ? (attuale?.confezioni ?? 1)
        : dati.confezioni,
      "Confezioni",
      1,
      100000,
      true,
    );
    const misura = unita(
      dati.unita === undefined ? (attuale?.unita ?? "g") : dati.unita,
    );
    const valoreQuantita =
      dati.quantita === undefined ? (attuale?.quantita ?? null) : dati.quantita;
    const quantita =
      valoreQuantita === null
        ? null
        : numero(
            valoreQuantita,
            "Quantità residua",
            0.001,
            1_000_000,
            misura === "pz",
          );
    const posizione = testo(
      dati.posizione === undefined
        ? (attuale?.posizione ?? "Frigorifero")
        : dati.posizione,
      "Posizione",
      60,
    );
    if (!(await this.posizioni()).includes(posizione))
      throw new ErroreApplicazione("La posizione selezionata non esiste.");
    const scadenza = validaScadenza(
      dati.scadenza === undefined ? (attuale?.scadenza ?? null) : dati.scadenza,
    );
    const valoreScorta =
      dati.scorta_minima === undefined
        ? (attuale?.scorta_minima ?? null)
        : dati.scorta_minima;
    const scorta_minima =
      valoreScorta === null
        ? null
        : numero(
            valoreScorta,
            "Scorta minima",
            0.001,
            1_000_000,
            misura === "pz",
          );
    if (scorta_minima !== null && quantita === null)
      throw new ErroreApplicazione(
        "Indica una quantità residua per attivare l'avviso scorta minima.",
      );
    return {
      confezioni,
      quantita,
      unita: misura,
      posizione,
      scadenza,
      scorta_minima,
    };
  }


  async aggiungiInventario(valore: unknown, chiave?: string): Promise<VoceInventario> {
    const dati = oggetto(valore); const codice = validaCodice(dati.codice);
    const voce = await this.datiInventario(dati);
    // La rete rimane sempre fuori dalle transazioni IndexedDB.
    if (!(chiave && await this.database.operazioni.get(chiave))) await this.recuperaProdotto(codice);
    return this.eseguiRipetibile(chiave, JSON.stringify({azione:"aggiunta_inventario",codice,...voce}), async () => {
      const valori = await this.datiInventario(dati);
      const prodotto = await this.prodotto(codice);
      const id = await this.database.inventario.add({ ...valori, prodotto, inserito_il:new Date().toISOString() } as VoceInventario);
      return this.voce(id);
    });
  }
  async modificaInventario(id: number, valore: unknown): Promise<VoceInventario> {
    return this.database.transazione(async () => { const attuale=await this.voce(id); const dati=await this.datiInventario(valore,attuale); await this.database.inventario.put({...attuale,...dati}); return this.voce(id); });
  }
  async eliminaInventario(id: number): Promise<void> {
    await this.database.transazione(async () => { const voce=await this.voce(id); await this.database.inventario.delete(id); await this.registra("eliminazione",`${voce.prodotto.product_name}: eliminato dall'inventario.`); });
  }
  async consumaInventario(id: number, valore: unknown, chiave?: string): Promise<void> {
    const dati=oggetto(valore); const quantita=dati.quantita===undefined?undefined:numero(dati.quantita,"Quantità da consumare",0.001);
    await this.eseguiRipetibile(chiave,JSON.stringify({azione:"consumo",id,quantita:quantita??null}),async () => {
      const voce=await this.voce(id);
      if (quantita!==undefined) {
        if (voce.quantita===null) throw new ErroreApplicazione("Registra prima la quantità residua per effettuare un consumo parziale.");
        if (voce.unita==="pz" && !Number.isInteger(quantita)) throw new ErroreApplicazione("Inserisci un numero intero di pezzi.");
        if (quantita>voce.quantita) throw new ErroreApplicazione("La quantità da consumare supera quella disponibile.",409);
      }
      const residua=quantita===undefined?0:Number((voce.quantita!-quantita).toFixed(6));
      if (residua<=0) await this.database.inventario.delete(id); else await this.database.inventario.update(id,{quantita:residua});
      await this.registra("consumo",`${voce.prodotto.product_name}: ${quantita===undefined?"consumato completamente":`consumati ${quantita} ${voce.unita}`}.`);
    });
  }
  async spesa(): Promise<VoceSpesa[]> { return (await this.database.spesa.toArray()).sort((a,b)=> Number(a.completato)-Number(b.completato) || b.inserito_il.localeCompare(a.inserito_il) || b.id-a.id); }
  private async elementoSpesa(id: number): Promise<VoceSpesa> { const riga=await this.database.spesa.get(id); if (!riga) throw new ErroreApplicazione("Elemento della spesa non trovato.",404); return riga; }
  async aggiungiSpesa(valore: unknown, chiave?: string): Promise<VoceSpesa> {
    const dati=oggetto(valore); const nome=testo(dati.nome,"Nome"); const quantita=testo(dati.quantita??"","Quantità",100,true);
    return this.eseguiRipetibile(chiave,JSON.stringify({azione:"aggiunta_spesa",nome,quantita}),async()=> {
      const id=await this.database.spesa.add({nome,quantita,completato:false,inserito_il:new Date().toISOString()} as VoceSpesa); return this.elementoSpesa(id);
    });
  }
  async modificaSpesa(id:number,valore:unknown):Promise<VoceSpesa> {
    const dati=oggetto(valore);
    return this.database.transazione(async()=> {
      const attuale=await this.elementoSpesa(id);
      await this.database.spesa.put({...attuale,nome:dati.nome===undefined?attuale.nome:testo(dati.nome,"Nome"),quantita:dati.quantita===undefined?attuale.quantita:testo(dati.quantita,"Quantità",100,true),completato:dati.completato===undefined?attuale.completato:booleano(dati.completato,"Spunta")}); return this.elementoSpesa(id);
    });
  }
  async eliminaSpesa(id:number):Promise<void> { await this.database.transazione(async()=>{await this.elementoSpesa(id);await this.database.spesa.delete(id);}); }
  async preferenze():Promise<Preferenze> { return (await this.database.impostazioni.get("preferenze"))?.valore ?? structuredClone(preferenzeIniziali); }
  async salvaPreferenze(valore:unknown):Promise<Preferenze> { const preferenze=validaPreferenze(valore);await this.database.impostazioni.put({chiave:"preferenze",valore:preferenze});return preferenze; }
  async ricette():Promise<Ricetta[]> { return (await this.database.ricette.orderBy("id").reverse().limit(100).toArray()).map((riga)=>({...riga.dati,id:riga.id!})); }
  async ricetta(id:number):Promise<Ricetta> { const riga=await this.database.ricette.get(id);if (!riga) throw new ErroreApplicazione("Ricetta non trovata.",404);return {...riga.dati,id}; }
  async generaRicetta(valore:unknown):Promise<Ricetta> {
    const richiesta=applicaPreferenzeSalvate(validaRichiesta(valore),await this.preferenze());
    if (!this.configurazione.generatore) throw new ErroreApplicazione("Il generatore di ricette è disabilitato nella versione GitHub Pages. Le ricette salvate e i calcoli nutrizionali restano disponibili.",503);
    try {
      const proposta=await generaRicettaVerificata(await this.inventario(),richiesta,{generatore:this.configurazione.generatore});
      return this.database.transazione(async()=> {
        const inventario=await this.inventario(); const verificata=validaRicetta(proposta,inventario,richiesta);
        validaRicetta(proposta,inventario,{...await this.preferenze(),persone:richiesta.persone,tempo_massimo:richiesta.tempo_massimo});
        const dati={...proposta,...verificata,creata_il:new Date().toISOString(),preparata_il:null} as Ricetta;
        const id=await this.database.ricette.add({dati,richiesta}); return this.ricetta(id);
      });
    } catch (errore) { if (errore instanceof ErroreApplicazione) throw errore;throw new ErroreApplicazione(errore instanceof Error?errore.message:"Non è stato possibile generare una ricetta valida.",422); }
  }
  async preparaRicetta(id:number):Promise<void> {
    await this.database.transazione(async()=> {
      const riga=await this.database.ricette.get(id);if (!riga) throw new ErroreApplicazione("Ricetta non trovata.",404);
      if (riga.dati.preparata_il) return;
      const ricetta=riga.dati;const richiesta=riga.richiesta;const inventario=await this.inventario();
      try {validaRicetta(ricetta,inventario,richiesta);validaRicetta(ricetta,inventario,{...await this.preferenze(),persone:richiesta.persone,tempo_massimo:richiesta.tempo_massimo});}
      catch(errore){throw new ErroreApplicazione(errore instanceof Error?errore.message:"Gli ingredienti non sono più disponibili o compatibili.",409);}
      const consumi=new Map<number,number>();for(const ingrediente of ricetta.ingredienti) consumi.set(ingrediente.inventario_id,(consumi.get(ingrediente.inventario_id)??0)+ingrediente.quantita);
      for(const [identificatore,quantita] of consumi){
        const voce=inventario.find((elemento)=>elemento.id===identificatore);
        if(!voce||voce.quantita===null||quantita>voce.quantita) throw new ErroreApplicazione("La quantità disponibile è cambiata. Genera una nuova ricetta.",409);
        const residua=Number((voce.quantita-quantita).toFixed(6));
        if(residua<=0) await this.database.inventario.delete(identificatore);else await this.database.inventario.update(identificatore,{quantita:residua});
        await this.registra("consumo",`${voce.prodotto.product_name}: consumati ${quantita} ${voce.unita} per «${ricetta.titolo}».`);
      }
      await this.database.ricette.put({...riga,dati:{...ricetta,preparata_il:new Date().toISOString()}});
      await this.registra("ricetta_preparata",`Preparata «${ricetta.titolo}» per ${ricetta.porzioni} persone.`);
    });
  }
  async eliminaRicetta(id:number):Promise<void>{await this.database.transazione(async()=>{await this.ricetta(id);await this.database.ricette.delete(id);});}
  async storico():Promise<EventoStorico[]>{return this.database.storico.orderBy("id").reverse().limit(200).toArray();}
  private async registra(azione:string,descrizione:string):Promise<void>{await this.database.storico.add({azione,descrizione,creato_il:new Date().toISOString()} as EventoStorico);}
  chiudi():void {this.database.chiudi();}
}
let archivio: ArchivioFridgeBrain | undefined;
export function archivioApplicazione():ArchivioFridgeBrain {return archivio ??= new ArchivioFridgeBrain();}
