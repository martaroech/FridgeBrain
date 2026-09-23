import type { ConfigurazioneArchivio } from "./database";
import type { Prodotto } from "./tipi";

export class ErroreOpenFoodFacts extends Error {
  constructor(
    messaggio: string,
    readonly stato: number,
  ) {
    super(messaggio);
  }
}

const campiTestuali = [
  "brands",
  "quantity",
  "ingredients_text",
  "nutriscore_grade",
  "nutrition_data_per",
  "product_quantity_unit",
] as const;
const campiListe = [
  "allergens_tags",
  "traces_tags",
  "labels_tags",
  "ingredients_analysis_tags",
  "categories_tags",
] as const;
const campi = [
  "code",
  "product_name",
  "product_name_it",
  "ingredients",
  "nutriments",
  ...campiTestuali,
  ...campiListe,
].join(",");
const nonValida = () =>
  new ErroreOpenFoodFacts(
    "Open Food Facts ha restituito dati non validi. Riprova oppure inserisci il prodotto manualmente.",
    502,
  );

export function normalizzaProdottoOff(
  valore: unknown,
  codiciAmmessi: string[],
): Prodotto {
  if (!valore || typeof valore !== "object" || Array.isArray(valore))
    throw nonValida();
  const dati = valore as Record<string, unknown>;
  if (typeof dati.code !== "string" || !codiciAmmessi.includes(dati.code))
    throw nonValida();
  const nome = dati.product_name_it || dati.product_name;
  if (typeof nome !== "string" || !nome.trim() || nome.length > 1000)
    throw nonValida();
  const prodotto: Prodotto = { code: dati.code, product_name: nome.trim() };
  for (const campo of campiTestuali) {
    if (dati[campo] == null) continue;
    if (typeof dati[campo] !== "string") throw nonValida();
    prodotto[campo] = dati[campo];
  }
  for (const campo of campiListe) {
    if (dati[campo] == null) continue;
    if (
      !Array.isArray(dati[campo]) ||
      !dati[campo].every((voce) => typeof voce === "string")
    )
      throw nonValida();
    prodotto[campo] = dati[campo] as string[];
  }
  if (dati.ingredients != null) {
    if (!Array.isArray(dati.ingredients)) throw nonValida();
    prodotto.ingredients = dati.ingredients;
  }
  if (dati.nutriments != null) {
    if (typeof dati.nutriments !== "object" || Array.isArray(dati.nutriments))
      throw nonValida();
    // Non inventare valori: null e nutrienti assenti restano sconosciuti.
    prodotto.nutriments = dati.nutriments as Record<string, unknown>;
  }
  return prodotto;
}

/** Un solo tentativo limitato nel tempo; il chiamante riusa la cache IndexedDB. */
export async function recuperaDaOff(
  codice: string,
  equivalenti: string[],
  configurazione: ConfigurazioneArchivio,
): Promise<Prodotto> {
  const controllo = new AbortController();
  const scadenza = setTimeout(
    () => controllo.abort(),
    configurazione.attesaOffMs ?? 8000,
  );
  try {
    const base = configurazione.indirizzoOff ?? "https://world.openfoodfacts.org";
    const indirizzo = new URL(`/api/v2/product/${codice}.json`, base);
    indirizzo.searchParams.set("fields", campi);
    // Il browser controlla User-Agent: identifichiamo l'app tramite il parametro OFF.
    indirizzo.searchParams.set("user_agent", "FridgeBrain/1.0 (https://martaroech.github.io/FridgeBrain/)");
    const risposta = await (configurazione.richiediOff ?? fetch)(indirizzo, {
      signal: controllo.signal,
      redirect: "error",
      headers: {
        Accept: "application/json",

      },
      cache: "no-store",
      credentials: "omit",
    });
    if (risposta.status === 429)
      throw new ErroreOpenFoodFacts(
        "Open Food Facts ha raggiunto il limite di richieste. Attendi qualche minuto e riprova.",
        429,
      );
    if (risposta.status === 404)
      throw new ErroreOpenFoodFacts(
        "Prodotto non trovato. Puoi inserirlo manualmente.",
        404,
      );
    if (!risposta.ok)
      throw new ErroreOpenFoodFacts(
        "Open Food Facts non è al momento disponibile. Riprova più tardi.",
        503,
      );
    if (
      !risposta.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json")
    )
      throw nonValida();
    const lettore = risposta.body?.getReader();
    if (!lettore) throw nonValida();
    const decodificatore = new TextDecoder();
    let contenuto = "";
    let dimensione = 0;
    try {
      while (true) {
        const parte = await lettore.read();
        if (parte.done) break;
        dimensione += parte.value.byteLength;
        if (dimensione > 2 * 1024 * 1024) {
          controllo.abort();
          throw nonValida();
        }
        contenuto += decodificatore.decode(parte.value, { stream: true });
      }
      contenuto += decodificatore.decode();
    } finally {
      lettore.releaseLock();
    }
    let dati;
    try {
      dati = JSON.parse(contenuto);
    } catch {
      throw nonValida();
    }
    if (!dati || typeof dati !== "object") throw nonValida();
    if (dati.status === 0)
      throw new ErroreOpenFoodFacts(
        "Prodotto non trovato. Puoi inserirlo manualmente.",
        404,
      );
    if (dati.status !== 1) throw nonValida();
    return normalizzaProdottoOff(dati.product, [codice, ...equivalenti]);
  } catch (errore) {
    if (errore instanceof ErroreOpenFoodFacts) throw errore;
    if (controllo.signal.aborted)
      throw new ErroreOpenFoodFacts(
        "Open Food Facts non ha risposto in tempo. Riprova.",
        504,
      );
    throw new ErroreOpenFoodFacts(
      "Impossibile raggiungere Open Food Facts. I prodotti già salvati restano disponibili.",
      503,
    );
  } finally {
    clearTimeout(scadenza);
  }
}
