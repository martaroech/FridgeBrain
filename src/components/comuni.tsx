"use client";

import { useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  Check,
  Clock3,
  Leaf,
  LoaderCircle,
  X,
  Package,
  Snowflake,
  Carrot,
} from "lucide-react";
import { valoriPerCento, unitaNutrizionale } from "@/lib/motore";
import type {
  Nutriente,
  Prodotto,
  ValoriNutrizionali,
  VoceInventario,
} from "@/lib/tipi";

let copiaOffline = false;

export function chiaveOperazione(
  chiavi: Map<string, string>,
  percorso: string,
  corpo: unknown,
): string {
  const firma = JSON.stringify([percorso, corpo]);
  let chiave = chiavi.get(firma);
  if (!chiave) {
    chiave = Array.from(crypto.getRandomValues(new Uint8Array(16)), (valore) =>
      valore.toString(16).padStart(2, "0"),
    ).join("");
    chiavi.set(firma, chiave);
  }
  return chiave;
}

export async function chiamaApi<T>(
  percorso: string,
  metodo = "GET",
  corpo?: unknown,
  chiave?: string,
): Promise<T> {
  if (metodo !== "GET" && copiaOffline)
    throw new Error(
      "Stai consultando una copia offline. Ricollega il server di casa e aggiorna prima di modificare i dati.",
    );
  let risposta: Response;
  try {
    risposta = await fetch(percorso, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(chiave ? { "Idempotency-Key": chiave } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Il server di casa non è raggiungibile. Controlla la rete locale e riprova.",
    );
  }
  const dati = await risposta.json().catch(() => ({}));
  if (!risposta.ok)
    throw new Error(dati.errore || "L’operazione non è riuscita. Riprova.");
  if (percorso === "/api/stato") copiaOffline = dati.copia_offline === true;
  return dati as T;
}

export function oggi() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
export function giorniAllaScadenza(scadenza: string | null) {
  return scadenza
    ? Math.round(
        (Date.parse(scadenza + "T12:00:00Z") -
          Date.parse(oggi() + "T12:00:00Z")) /
          86400000,
      )
    : null;
}
export function dataBreve(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
  }).format(new Date(data + "T12:00:00"));
}
export function numero(valore: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(
    valore,
  );
}
export function quantitaVoce(voce: VoceInventario) {
  return voce.quantita !== null
    ? `${numero(voce.quantita)} ${voce.unita}`
    : `${voce.confezioni} ${voce.confezioni === 1 ? "confezione" : "confezioni"}`;
}
export const nutrienti: {
  chiave: Nutriente;
  nome: string;
  unita: string;
  campo: string;
}[] = [
  {
    chiave: "calorie",
    nome: "Calorie",
    unita: "kcal",
    campo: "energy-kcal_100g",
  },
  { chiave: "proteine", nome: "Proteine", unita: "g", campo: "proteins_100g" },
  {
    chiave: "carboidrati",
    nome: "Carboidrati",
    unita: "g",
    campo: "carbohydrates_100g",
  },
  { chiave: "grassi", nome: "Grassi", unita: "g", campo: "fat_100g" },
  { chiave: "zuccheri", nome: "Zuccheri", unita: "g", campo: "sugars_100g" },
  { chiave: "fibre", nome: "Fibre", unita: "g", campo: "fiber_100g" },
  { chiave: "sale", nome: "Sale", unita: "g", campo: "salt_100g" },
];
export const allergeni = [
  ["en:gluten", "Glutine"],
  ["en:milk", "Latte"],
  ["en:eggs", "Uova"],
  ["en:soybeans", "Soia"],
  ["en:nuts", "Frutta a guscio"],
  ["en:peanuts", "Arachidi"],
  ["en:fish", "Pesce"],
  ["en:crustaceans", "Crostacei"],
  ["en:molluscs", "Molluschi"],
  ["en:celery", "Sedano"],
  ["en:mustard", "Senape"],
  ["en:sesame-seeds", "Sesamo"],
  ["en:sulphur-dioxide-and-sulphites", "Solfiti"],
  ["en:lupin", "Lupini"],
];
export function nomeAllergene(valore: string) {
  return (
    allergeni.find(([chiave]) => chiave === valore)?.[1] ||
    valore.replace(/^\w{2}:/, "").replaceAll("-", " ")
  );
}

export function Errore({ testo }: { testo?: string | null }) {
  return testo ? (
    <div className="avviso errore" role="alert" aria-label="Errore">
      <AlertCircle size={20} />
      <span>{testo}</span>
    </div>
  ) : null;
}
export function Caricamento({
  testo = "Caricamento in corso…",
}: {
  testo?: string;
}) {
  return (
    <div className="caricamento" role="status">
      <LoaderCircle size={22} className="rotazione" />
      {testo}
    </div>
  );
}
export function Vuoto({
  titolo,
  testo,
  azione,
  onAzione,
  icona = "foglia",
}: {
  titolo: string;
  testo: string;
  azione?: string;
  onAzione?: () => void;
  icona?: string;
}) {
  return (
    <div className="vuoto">
      <span className="vuoto-icona">
        {icona === "scatola" ? <Package size={34} /> : <Leaf size={34} />}
      </span>
      <h3>{titolo}</h3>
      <p>{testo}</p>
      {azione && (
        <button className="pulsante primario" onClick={onAzione}>
          {azione}
        </button>
      )}
    </div>
  );
}
export function IconaAlimento({ posizione }: { posizione?: string }) {
  return (
    <span
      className={`icona-alimento ${posizione === "Freezer" ? "freddo" : ""}`}
    >
      {posizione === "Freezer" ? (
        <Snowflake size={23} />
      ) : posizione === "Dispensa" ? (
        <Package size={23} />
      ) : (
        <Carrot size={23} />
      )}
    </span>
  );
}
export function Scadenza({ data }: { data: string | null }) {
  const giorni = giorniAllaScadenza(data);
  const testo =
    giorni === null
      ? "Scadenza non indicata"
      : giorni < 0
        ? `Scaduto ${Math.abs(giorni) === 1 ? "ieri" : `da ${Math.abs(giorni)} giorni`}`
        : giorni === 0
          ? "Scade oggi"
          : giorni === 1
            ? "Scade domani"
            : giorni <= 7
              ? `Tra ${giorni} giorni`
              : `Scade il ${dataBreve(data!)}`;
  return (
    <span
      className={`scadenza ${giorni !== null && giorni < 0 ? "critica" : giorni !== null && giorni <= 3 ? "vicina" : ""}`}
    >
      <Clock3 size={13} />
      {testo}
    </span>
  );
}
export function Dialogo({
  titolo,
  children,
  chiudi,
}: {
  titolo: string;
  children: React.ReactNode;
  chiudi: () => void;
}) {
  const riferimento = useRef<HTMLDialogElement>(null);
  const identificatore = useId();
  useEffect(() => {
    const elemento = riferimento.current;
    elemento?.showModal();
    return () => elemento?.close();
  }, []);
  return (
    <dialog
      ref={riferimento}
      className="dialogo"
      aria-labelledby={identificatore}
      onCancel={chiudi}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) {
          const rettangolo = evento.currentTarget.getBoundingClientRect();
          if (
            evento.clientX < rettangolo.left ||
            evento.clientX > rettangolo.right ||
            evento.clientY < rettangolo.top ||
            evento.clientY > rettangolo.bottom
          )
            chiudi();
        }
      }}
    >
      <div className="testa-dialogo">
        <h2 id={identificatore}>{titolo}</h2>
        <button
          className="pulsante-icona"
          aria-label="Chiudi finestra"
          onClick={chiudi}
        >
          <X size={23} />
        </button>
      </div>
      <div className="corpo-dialogo">{children}</div>
    </dialog>
  );
}
export function Nutrizione({
  valori,
  compatta = false,
}: {
  valori: ValoriNutrizionali;
  compatta?: boolean;
}) {
  return (
    <dl className={`nutrizione ${compatta ? "compatta" : ""}`}>
      {nutrienti.map(({ chiave, nome, unita }) => (
        <div key={chiave}>
          <dt>{nome}</dt>
          <dd>
            {valori[chiave] === null || valori[chiave] === undefined ? (
              <span className="sconosciuto">Dato sconosciuto</span>
            ) : (
              <>
                {numero(valori[chiave])}
                <small> {unita}</small>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function InformazioniProdotto({ prodotto }: { prodotto: Prodotto }) {
  const valori = valoriPerCento(prodotto);
  return (
    <div className="informazioni-prodotto">
      <div className="prodotto-intestazione">
        <IconaAlimento />
        <div>
          <p className="soprattitolo">
            {prodotto.personalizzato
              ? "Il tuo prodotto"
              : "Open Food Facts · catalogo locale"}
          </p>
          <h3>{prodotto.product_name}</h3>
          <p className="secondario">
            {[prodotto.brands, prodotto.quantity].filter(Boolean).join(" · ") ||
              "Marca e confezione non indicate"}
          </p>
        </div>
        {prodotto.nutriscore_grade &&
          /^[a-e]$/i.test(prodotto.nutriscore_grade) && (
            <span
              className="nutriscore"
              aria-label={`Nutri-Score ${prodotto.nutriscore_grade.toUpperCase()}`}
            >
              Nutri-Score
              <strong>{prodotto.nutriscore_grade.toUpperCase()}</strong>
            </span>
          )}
      </div>
      <details className="dettagli">
        <summary>Ingredienti, allergeni e nutrienti</summary>
        <div className="contenuto-dettagli">
          <h4>Ingredienti</h4>
          <p>
            {prodotto.ingredients_text ||
              "Ingredienti non disponibili nella fonte."}
          </p>
          <h4>Allergeni dichiarati</h4>
          <p>
            {prodotto.allergens_tags === undefined
              ? "Dato sconosciuto: informazione non disponibile."
              : prodotto.allergens_tags.length
                ? prodotto.allergens_tags.map(nomeAllergene).join(", ")
                : "Nessun allergene dichiarato nella fonte. Non equivale ad assenza certificata."}
          </p>
          {!!prodotto.traces_tags?.length && (
            <p>
              Possibili tracce:{" "}
              {prodotto.traces_tags.map(nomeAllergene).join(", ")}.
            </p>
          )}
          <p className="nota">
            Controlla sempre l’etichetta originale per allergeni e dichiarazioni
            del produttore.
          </p>
          <h4>Valori per 100 {unitaNutrizionale(prodotto)}</h4>
          <Nutrizione valori={valori} compatta />
          <p className="nota">Un dato sconosciuto non equivale a zero.</p>
          <p className="nota codice">Codice: {prodotto.code}</p>
        </div>
      </details>
    </div>
  );
}
export function Notifica({ testo }: { testo: string }) {
  return (
    <div className="notifica" role="status">
      <Check size={19} />
      {testo}
    </div>
  );
}
