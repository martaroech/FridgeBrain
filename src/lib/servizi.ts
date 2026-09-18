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

type Oggetto = Record<string, unknown>;
type Riga = Record<string, unknown>;
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

function oggetto(valore: unknown): Oggetto {
  if (!valore || typeof valore !== "object" || Array.isArray(valore))
    throw new ErroreApplicazione("I dati inviati non sono validi.");
  return valore as Oggetto;
}

function testo(
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

function numero(
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

function validaRichiesta(valore: unknown): RichiestaRicetta {
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

function validaProdotto(valore: unknown): Prodotto {
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

function voceInventario(riga: Riga): VoceInventario {
  return {
    id: Number(riga.id),
    prodotto: JSON.parse(String(riga.prodotto)),
    confezioni: Number(riga.confezioni),
    quantita: riga.quantita === null ? null : Number(riga.quantita),
    scorta_minima:
      riga.scorta_minima == null ? null : Number(riga.scorta_minima),
    unita: riga.unita as Unita,
    posizione: String(riga.posizione),
    scadenza: riga.scadenza === null ? null : String(riga.scadenza),
    inserito_il: String(riga.inserito_il),
  };
}

function voceSpesa(riga: Riga): VoceSpesa {
  return {
    id: Number(riga.id),
    nome: String(riga.nome),
    quantita: String(riga.quantita),
    completato: Boolean(riga.completato),
    inserito_il: String(riga.inserito_il),
  };
}

function voceRicetta(riga: Riga): Ricetta {
  return {
    ...JSON.parse(String(riga.dati)),
    id: Number(riga.id),
    creata_il: String(riga.creata_il),
    preparata_il: riga.preparata_il === null ? null : String(riga.preparata_il),
  };
}

export function generatoreConfigurato(): StatoApplicazione["generatore"] {
  const valore = process.env.FRIDGEBRAIN_GENERATORE;
  return valore === "locale" || valore === "simulato" ? valore : "disabilitato";
}

export class ArchivioFridgeBrain {
  readonly database: DatabaseFridgeBrain;
  constructor(configurazione: ConfigurazioneArchivio = {}) {
    this.database = new DatabaseFridgeBrain(configurazione);
  }

  private eseguiRipetibile<T>(
    chiave: string | undefined,
    firma: string,
    operazione: () => T,
  ): T {
    if (chiave !== undefined) testo(chiave, "Chiave dell'operazione", 100);
    return this.database.transazione(() => {
      if (chiave) {
        const precedente = this.database.personale
          .prepare("SELECT firma FROM operazioni WHERE chiave=?")
          .get(chiave);
        if (precedente) {
          const salvata = JSON.parse(String(precedente.firma)) as {
            firma?: string;
            risultato?: T;
          };
          if (salvata.firma !== firma)
            throw new ErroreApplicazione(
              "Questa operazione è già stata usata con dati diversi.",
              409,
            );
          return salvata.risultato as T;
        }
      }
      const risultato = operazione();
      if (chiave)
        this.database.personale
          .prepare(
            "INSERT INTO operazioni(chiave,firma,creato_il) VALUES (?,?,?)",
          )
          .run(
            chiave,
            JSON.stringify({ firma, risultato }),
            new Date().toISOString(),
          );
      return risultato;
    });
  }

  stato(): StatoApplicazione {
    return {
      inventario: this.inventario(),
      spesa: this.spesa(),
      ricette: this.ricette(),
      preferenze: this.preferenze(),
      posizioni: this.posizioni(),
      catalogo_disponibile: Boolean(this.database.catalogo()),
      generatore: generatoreConfigurato(),
    };
  }

  posizioni(): string[] {
    return this.database.personale
      .prepare(
        "SELECT nome FROM posizioni ORDER BY CASE nome WHEN 'Frigorifero' THEN 1 WHEN 'Freezer' THEN 2 WHEN 'Dispensa' THEN 3 ELSE 4 END, nome",
      )
      .all()
      .map((riga) => String(riga.nome));
  }

  aggiungiPosizione(valore: unknown): string[] {
    const nome = testo(oggetto(valore).nome, "Nome della posizione", 60);
    if (
      this.posizioni().some(
        (posizione) => posizione.toLowerCase() === nome.toLowerCase(),
      )
    )
      throw new ErroreApplicazione(
        "Esiste già una posizione con questo nome.",
        409,
      );
    this.database.personale
      .prepare("INSERT INTO posizioni(nome) VALUES (?)")
      .run(nome);
    return this.posizioni();
  }

  eliminaPosizione(nome: string): void {
    if (["Frigorifero", "Freezer", "Dispensa"].includes(nome))
      throw new ErroreApplicazione(
        "Le posizioni iniziali non possono essere eliminate.",
      );
    this.database.transazione(() => {
      if (
        this.database.personale
          .prepare("SELECT id FROM inventario WHERE posizione=? LIMIT 1")
          .get(nome)
      )
        throw new ErroreApplicazione(
          "Sposta prima i prodotti presenti in questa posizione.",
          409,
        );
      if (
        !this.database.personale
          .prepare("DELETE FROM posizioni WHERE nome=?")
          .run(nome).changes
      )
        throw new ErroreApplicazione("Posizione non trovata.", 404);
    });
  }

  prodotto(codiceRichiesto: unknown): Prodotto {
    const codice = validaCodice(codiceRichiesto);
    const personale = this.database.personale
      .prepare("SELECT dati FROM prodotti_personalizzati WHERE codice=?")
      .get(codice);
    if (personale) return JSON.parse(String(personale.dati));
    const catalogo = this.database.catalogo();
    const riga = catalogo
      ?.prepare("SELECT dati FROM prodotti WHERE code=?")
      .get(codice);
    if (riga) return JSON.parse(String(riga.dati));
    // Prima le corrispondenze esatte in entrambi gli archivi, poi gli alias verificati.
    for (const equivalente of codiciGtinEquivalenti(codice)) {
      const trovato =
        this.database.personale
          .prepare("SELECT dati FROM prodotti_personalizzati WHERE codice=?")
          .get(equivalente) ??
        catalogo
          ?.prepare("SELECT dati FROM prodotti WHERE code=?")
          .get(equivalente);
      if (trovato) return JSON.parse(String(trovato.dati));
    }
    if (!catalogo)
      throw new ErroreApplicazione(
        "Il catalogo alimentare non è disponibile. Prepara foods.db oppure inserisci un prodotto manualmente.",
        503,
      );
    throw new ErroreApplicazione(
      "Prodotto non trovato. Puoi inserirlo manualmente.",
      404,
    );
  }

  cercaProdotti(valore: unknown): Prodotto[] {
    const ricerca = testo(valore, "Ricerca", 100, true);
    if (ricerca.length < 2) return [];
    const risultati = new Map<string, Prodotto>();
    const modello = `%${ricerca.replace(/[\\%_]/g, "\\$&")}%`;
    const personali = this.database.personale
      .prepare(
        "SELECT dati FROM prodotti_personalizzati WHERE json_extract(dati,'$.product_name') LIKE ? ESCAPE '\\' OR json_extract(dati,'$.brands') LIKE ? ESCAPE '\\' OR codice=? LIMIT 30",
      )
      .all(modello, modello, ricerca);
    for (const riga of personali) {
      const prodotto = JSON.parse(String(riga.dati)) as Prodotto;
      risultati.set(prodotto.code, prodotto);
    }
    const catalogo = this.database.catalogo();
    if (!catalogo) return [...risultati.values()];
    if (/^\d{4,32}$/.test(ricerca)) {
      const trovato = catalogo
        .prepare("SELECT dati FROM prodotti WHERE code=?")
        .get(ricerca);
      if (trovato) {
        const prodotto = JSON.parse(String(trovato.dati)) as Prodotto;
        if (!risultati.has(prodotto.code))
          risultati.set(prodotto.code, prodotto);
      }
    }
    const parole = ricerca.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (parole.length) {
      const espressione = parole
        .slice(0, 12)
        .map((parola) => `"${parola}"*`)
        .join(" AND ");
      const righe = catalogo
        .prepare(
          "SELECT p.dati FROM ricerca_prodotti r JOIN prodotti p ON p.rowid=r.rowid WHERE ricerca_prodotti MATCH ? ORDER BY rank LIMIT 30",
        )
        .all(espressione);
      for (const riga of righe) {
        const prodotto = JSON.parse(String(riga.dati)) as Prodotto;
        if (!risultati.has(prodotto.code))
          risultati.set(prodotto.code, prodotto);
      }
    }
    return [...risultati.values()].slice(0, 30);
  }

  salvaProdotto(
    valore: unknown,
    codiceEsistente?: string,
    chiave?: string,
  ): Prodotto {
    const prodotto = validaProdotto(valore);
    if (codiceEsistente && prodotto.code !== codiceEsistente)
      throw new ErroreApplicazione(
        "Il codice a barre non può essere modificato.",
      );
    const salva = () => {
      const esiste = this.database.personale
        .prepare("SELECT codice FROM prodotti_personalizzati WHERE codice=?")
        .get(prodotto.code);
      if (codiceEsistente && !esiste)
        throw new ErroreApplicazione(
          "Prodotto personalizzato non trovato.",
          404,
        );
      if (!codiceEsistente && esiste)
        throw new ErroreApplicazione(
          "Esiste già un prodotto personalizzato con questo codice a barre.",
          409,
        );
      if (codiceEsistente)
        this.database.personale
          .prepare("UPDATE prodotti_personalizzati SET dati=? WHERE codice=?")
          .run(JSON.stringify(prodotto), prodotto.code);
      else
        this.database.personale
          .prepare(
            "INSERT INTO prodotti_personalizzati(codice,dati,creato_il) VALUES (?,?,?)",
          )
          .run(
            prodotto.code,
            JSON.stringify(prodotto),
            new Date().toISOString(),
          );
      return prodotto;
    };
    return codiceEsistente
      ? salva()
      : this.eseguiRipetibile(
          chiave,
          JSON.stringify({ azione: "creazione_prodotto", prodotto }),
          salva,
        );
  }

  eliminaProdotto(codice: string): void {
    if (
      !this.database.personale
        .prepare("DELETE FROM prodotti_personalizzati WHERE codice=?")
        .run(validaCodice(codice)).changes
    )
      throw new ErroreApplicazione("Prodotto personalizzato non trovato.", 404);
  }

  inventario(): VoceInventario[] {
    return this.database.personale
      .prepare(
        "SELECT * FROM inventario ORDER BY scadenza IS NULL,scadenza,inserito_il DESC,id DESC",
      )
      .all()
      .map(voceInventario);
  }

  voce(id: number): VoceInventario {
    const riga = this.database.personale
      .prepare("SELECT * FROM inventario WHERE id=?")
      .get(id);
    if (!riga)
      throw new ErroreApplicazione(
        "Prodotto dell'inventario non trovato.",
        404,
      );
    return voceInventario(riga);
  }

  private datiInventario(
    valore: unknown,
    attuale?: VoceInventario,
  ): Pick<
    VoceInventario,
    | "confezioni"
    | "quantita"
    | "unita"
    | "posizione"
    | "scadenza"
    | "scorta_minima"
  > {
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
    if (!this.posizioni().includes(posizione))
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

  aggiungiInventario(valore: unknown, chiave?: string): VoceInventario {
    const dati = oggetto(valore);
    const codice = validaCodice(dati.codice);
    const voce = this.datiInventario(dati);
    return this.eseguiRipetibile(
      chiave,
      JSON.stringify({ azione: "aggiunta_inventario", codice, ...voce }),
      () => {
        const prodotto = this.prodotto(codice);
        const risultato = this.database.personale
          .prepare(
            "INSERT INTO inventario(prodotto,confezioni,quantita,unita,posizione,scadenza,inserito_il,scorta_minima) VALUES (?,?,?,?,?,?,?,?)",
          )
          .run(
            JSON.stringify(prodotto),
            voce.confezioni,
            voce.quantita,
            voce.unita,
            voce.posizione,
            voce.scadenza,
            new Date().toISOString(),
            voce.scorta_minima ?? null,
          );
        return this.voce(Number(risultato.lastInsertRowid));
      },
    );
  }

  modificaInventario(id: number, valore: unknown): VoceInventario {
    return this.database.transazione(() => {
      const dati = this.datiInventario(valore, this.voce(id));
      this.database.personale
        .prepare(
          "UPDATE inventario SET confezioni=?,quantita=?,unita=?,posizione=?,scadenza=?,scorta_minima=? WHERE id=?",
        )
        .run(
          dati.confezioni,
          dati.quantita,
          dati.unita,
          dati.posizione,
          dati.scadenza,
          dati.scorta_minima ?? null,
          id,
        );
      return this.voce(id);
    });
  }

  eliminaInventario(id: number): void {
    this.database.transazione(() => {
      const voce = this.voce(id);
      this.database.personale
        .prepare("DELETE FROM inventario WHERE id=?")
        .run(id);
      this.registra(
        "eliminazione",
        `${voce.prodotto.product_name}: eliminato dall'inventario.`,
      );
    });
  }

  consumaInventario(id: number, valore: unknown, chiave?: string): void {
    const dati = oggetto(valore);
    const quantita =
      dati.quantita === undefined
        ? undefined
        : numero(dati.quantita, "Quantità da consumare", 0.001);
    if (chiave) testo(chiave, "Chiave dell'operazione", 100);
    const firma = JSON.stringify({ id, quantita: quantita ?? null });
    this.database.transazione(() => {
      if (chiave) {
        const precedente = this.database.personale
          .prepare("SELECT firma FROM operazioni WHERE chiave=?")
          .get(chiave);
        if (precedente) {
          if (precedente.firma !== firma)
            throw new ErroreApplicazione(
              "Questa operazione è già stata usata con dati diversi.",
              409,
            );
          return;
        }
      }
      const voce = this.voce(id);
      if (quantita !== undefined) {
        if (voce.quantita === null)
          throw new ErroreApplicazione(
            "Registra prima la quantità residua per effettuare un consumo parziale.",
          );
        if (voce.unita === "pz" && !Number.isInteger(quantita))
          throw new ErroreApplicazione("Inserisci un numero intero di pezzi.");
        if (quantita > voce.quantita)
          throw new ErroreApplicazione(
            "La quantità da consumare supera quella disponibile.",
            409,
          );
      }
      const residua =
        quantita === undefined
          ? 0
          : Number((voce.quantita! - quantita).toFixed(6));
      if (residua <= 0)
        this.database.personale
          .prepare("DELETE FROM inventario WHERE id=?")
          .run(id);
      else
        this.database.personale
          .prepare("UPDATE inventario SET quantita=? WHERE id=?")
          .run(residua, id);
      this.registra(
        "consumo",
        `${voce.prodotto.product_name}: ${quantita === undefined ? "consumato completamente" : `consumati ${quantita} ${voce.unita}`}.`,
      );
      if (chiave)
        this.database.personale
          .prepare(
            "INSERT INTO operazioni(chiave,firma,creato_il) VALUES (?,?,?)",
          )
          .run(chiave, firma, new Date().toISOString());
    });
  }

  spesa(): VoceSpesa[] {
    return this.database.personale
      .prepare(
        "SELECT * FROM spesa ORDER BY completato, inserito_il DESC, id DESC",
      )
      .all()
      .map(voceSpesa);
  }

  private elementoSpesa(id: number): VoceSpesa {
    const riga = this.database.personale
      .prepare("SELECT * FROM spesa WHERE id=?")
      .get(id);
    if (!riga)
      throw new ErroreApplicazione("Elemento della spesa non trovato.", 404);
    return voceSpesa(riga);
  }

  aggiungiSpesa(valore: unknown, chiave?: string): VoceSpesa {
    const dati = oggetto(valore);
    const nome = testo(dati.nome, "Nome");
    const quantita = testo(dati.quantita ?? "", "Quantità", 100, true);
    return this.eseguiRipetibile(
      chiave,
      JSON.stringify({ azione: "aggiunta_spesa", nome, quantita }),
      () => {
        const risultato = this.database.personale
          .prepare(
            "INSERT INTO spesa(nome,quantita,inserito_il) VALUES (?,?,?)",
          )
          .run(nome, quantita, new Date().toISOString());
        return this.elementoSpesa(Number(risultato.lastInsertRowid));
      },
    );
  }

  modificaSpesa(id: number, valore: unknown): VoceSpesa {
    const dati = oggetto(valore);
    const attuale = this.elementoSpesa(id);
    const nome =
      dati.nome === undefined ? attuale.nome : testo(dati.nome, "Nome");
    const quantita =
      dati.quantita === undefined
        ? attuale.quantita
        : testo(dati.quantita, "Quantità", 100, true);
    const completato =
      dati.completato === undefined
        ? attuale.completato
        : booleano(dati.completato, "Spunta");
    this.database.personale
      .prepare("UPDATE spesa SET nome=?,quantita=?,completato=? WHERE id=?")
      .run(nome, quantita, Number(completato), id);
    return this.elementoSpesa(id);
  }

  eliminaSpesa(id: number): void {
    if (
      !this.database.personale.prepare("DELETE FROM spesa WHERE id=?").run(id)
        .changes
    )
      throw new ErroreApplicazione("Elemento della spesa non trovato.", 404);
  }

  preferenze(): Preferenze {
    const riga = this.database.personale
      .prepare("SELECT valore FROM impostazioni WHERE chiave='preferenze'")
      .get();
    return riga
      ? JSON.parse(String(riga.valore))
      : structuredClone(preferenzeIniziali);
  }

  salvaPreferenze(valore: unknown): Preferenze {
    const preferenze = validaPreferenze(valore);
    this.database.personale
      .prepare(
        "INSERT INTO impostazioni(chiave,valore) VALUES ('preferenze',?) ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore",
      )
      .run(JSON.stringify(preferenze));
    return preferenze;
  }

  ricette(): Ricetta[] {
    return this.database.personale
      .prepare("SELECT * FROM ricette ORDER BY id DESC LIMIT 100")
      .all()
      .map(voceRicetta);
  }

  ricetta(id: number): Ricetta {
    const riga = this.database.personale
      .prepare("SELECT * FROM ricette WHERE id=?")
      .get(id);
    if (!riga) throw new ErroreApplicazione("Ricetta non trovata.", 404);
    return voceRicetta(riga);
  }

  async generaRicetta(valore: unknown): Promise<Ricetta> {
    const richiesta = applicaPreferenzeSalvate(
      validaRichiesta(valore),
      this.preferenze(),
    );
    if (generatoreConfigurato() === "disabilitato")
      throw new ErroreApplicazione(
        "Il generatore di ricette non è configurato. Consulta le impostazioni per collegare il modello locale.",
        503,
      );
    try {
      const proposta = await generaRicettaVerificata(
        this.inventario(),
        richiesta,
      );
      return this.database.transazione(() => {
        const inventario = this.inventario();
        const verificata = validaRicetta(proposta, inventario, richiesta);
        validaRicetta(proposta, inventario, {
          ...this.preferenze(),
          persone: richiesta.persone,
          tempo_massimo: richiesta.tempo_massimo,
        });
        const risultato = this.database.personale
          .prepare(
            "INSERT INTO ricette(dati,richiesta,creata_il) VALUES (?,?,?)",
          )
          .run(
            JSON.stringify({ ...proposta, ...verificata }),
            JSON.stringify(richiesta),
            new Date().toISOString(),
          );
        return this.ricetta(Number(risultato.lastInsertRowid));
      });
    } catch (errore) {
      if (errore instanceof ErroreApplicazione) throw errore;
      throw new ErroreApplicazione(
        errore instanceof Error
          ? errore.message
          : "Non è stato possibile generare una ricetta valida.",
        422,
      );
    }
  }

  preparaRicetta(id: number): void {
    this.database.transazione(() => {
      const riga = this.database.personale
        .prepare("SELECT * FROM ricette WHERE id=?")
        .get(id);
      if (!riga) throw new ErroreApplicazione("Ricetta non trovata.", 404);
      // Una ripetizione della conferma non può consumare gli ingredienti una seconda volta.
      if (riga.preparata_il) return;
      const ricetta = voceRicetta(riga);
      const richiesta = JSON.parse(String(riga.richiesta)) as RichiestaRicetta;
      const inventario = this.inventario();
      try {
        validaRicetta(ricetta, inventario, richiesta);
        validaRicetta(ricetta, inventario, {
          ...this.preferenze(),
          persone: richiesta.persone,
          tempo_massimo: richiesta.tempo_massimo,
        });
      } catch (errore) {
        throw new ErroreApplicazione(
          errore instanceof Error
            ? errore.message
            : "Gli ingredienti non sono più disponibili o compatibili.",
          409,
        );
      }
      const consumi = new Map<number, number>();
      for (const ingrediente of ricetta.ingredienti)
        consumi.set(
          ingrediente.inventario_id,
          (consumi.get(ingrediente.inventario_id) ?? 0) + ingrediente.quantita,
        );
      for (const [identificatore, quantita] of consumi) {
        const voce = inventario.find(
          (elemento) => elemento.id === identificatore,
        );
        if (!voce || voce.quantita === null || quantita > voce.quantita)
          throw new ErroreApplicazione(
            "La quantità disponibile è cambiata. Genera una nuova ricetta.",
            409,
          );
        const residua = Number((voce.quantita - quantita).toFixed(6));
        if (residua <= 0)
          this.database.personale
            .prepare("DELETE FROM inventario WHERE id=?")
            .run(identificatore);
        else
          this.database.personale
            .prepare("UPDATE inventario SET quantita=? WHERE id=?")
            .run(residua, identificatore);
        this.registra(
          "consumo",
          `${voce.prodotto.product_name}: consumati ${quantita} ${voce.unita} per «${ricetta.titolo}».`,
        );
      }
      this.database.personale
        .prepare(
          "UPDATE ricette SET preparata_il=? WHERE id=? AND preparata_il IS NULL",
        )
        .run(new Date().toISOString(), id);
      this.registra(
        "ricetta_preparata",
        `Preparata «${ricetta.titolo}» per ${ricetta.porzioni} persone.`,
      );
    });
  }

  eliminaRicetta(id: number): void {
    if (
      !this.database.personale.prepare("DELETE FROM ricette WHERE id=?").run(id)
        .changes
    )
      throw new ErroreApplicazione("Ricetta non trovata.", 404);
  }

  storico(): EventoStorico[] {
    return this.database.personale
      .prepare("SELECT * FROM storico ORDER BY id DESC LIMIT 200")
      .all()
      .map((riga) => ({
        id: Number(riga.id),
        azione: String(riga.azione),
        descrizione: String(riga.descrizione),
        creato_il: String(riga.creato_il),
      }));
  }

  private registra(azione: string, descrizione: string): void {
    this.database.personale
      .prepare(
        "INSERT INTO storico(azione,descrizione,creato_il) VALUES (?,?,?)",
      )
      .run(azione, descrizione, new Date().toISOString());
  }

  chiudi(): void {
    this.database.chiudi();
  }
}

const contenitore = globalThis as typeof globalThis & {
  archivioFridgeBrain?: ArchivioFridgeBrain;
};
export function archivioApplicazione(): ArchivioFridgeBrain {
  return (contenitore.archivioFridgeBrain ??= new ArchivioFridgeBrain());
}
