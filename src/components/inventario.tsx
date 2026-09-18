"use client";

import { useRef, useState } from "react";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import type { StatoApplicazione, VoceInventario } from "@/lib/tipi";
import { CampiInventario, leggiInventario } from "./aggiunta";
import {
  chiamaApi,
  chiaveOperazione,
  Dialogo,
  Errore,
  giorniAllaScadenza,
  InformazioniProdotto,
  quantitaVoce,
  Scadenza,
  Vuoto,
} from "./comuni";
import { RigaAlimento } from "./applicazione";
import { scortaInEsaurimento } from "@/lib/motore";

export function Inventario({
  stato,
  filtroIniziale,
  dettaglio,
  aggiungi,
}: {
  stato: StatoApplicazione;
  filtroIniziale: string;
  dettaglio: (voce: VoceInventario) => void;
  aggiungi: () => void;
}) {
  const [ricerca, impostaRicerca] = useState("");
  const [posizione, impostaPosizione] = useState(
    stato.posizioni.includes(filtroIniziale) ? filtroIniziale : "tutte",
  );
  const [scadenza, impostaScadenza] = useState(
    stato.posizioni.includes(filtroIniziale) ? "tutti" : filtroIniziale,
  );
  const [ordine, impostaOrdine] = useState("scadenza");
  const prodotti = stato.inventario
    .filter((voce) => {
      const giorni = giorniAllaScadenza(voce.scadenza);
      return (
        (posizione === "tutte" || voce.posizione === posizione) &&
        `${voce.prodotto.product_name} ${voce.prodotto.brands || ""}`
          .toLocaleLowerCase("it")
          .includes(ricerca.toLocaleLowerCase("it")) &&
        (scadenza === "tutti" ||
          (scadenza === "scorte" && scortaInEsaurimento(voce)) ||
          (scadenza === "scaduti" && giorni !== null && giorni < 0) ||
          (scadenza === "oggi" && giorni === 0) ||
          (scadenza === "tre" &&
            giorni !== null &&
            giorni >= 0 &&
            giorni <= 3) ||
          (scadenza === "settimana" &&
            giorni !== null &&
            giorni >= 0 &&
            giorni <= 7) ||
          (scadenza === "senza" && giorni === null))
      );
    })
    .sort((prima, seconda) =>
      ordine === "nome"
        ? prima.prodotto.product_name.localeCompare(
            seconda.prodotto.product_name,
            "it",
          )
        : ordine === "inserimento"
          ? seconda.inserito_il.localeCompare(prima.inserito_il)
          : (prima.scadenza || "9999").localeCompare(
              seconda.scadenza || "9999",
            ),
    );
  return (
    <section className="pagina">
      <div className="testata-pagina testata-azioni">
        <div>
          <p className="soprattitolo">Sai sempre cosa c’è</p>
          <h1>La tua cucina</h1>
          <p>
            {stato.inventario.length === 1
              ? "Un prodotto, al proprio posto."
              : `${stato.inventario.length} prodotti, ognuno al proprio posto.`}
          </p>
        </div>
        <button className="pulsante primario" onClick={aggiungi}>
          <Plus size={20} />
          Aggiungi prodotto
        </button>
      </div>
      <div className="strumenti-inventario">
        <label className="ricerca">
          <span className="solo-lettori">Cerca per nome o marca</span>
          <Search size={20} />
          <input
            value={ricerca}
            onChange={(evento) => impostaRicerca(evento.target.value)}
            placeholder="Cerca per nome o marca"
          />
        </label>
        <div className="filtri-posizione" aria-label="Filtra per posizione">
          {["tutte", ...stato.posizioni].map((valore) => (
            <button
              key={valore}
              className={`filtro ${posizione === valore ? "selezionato" : ""}`}
              aria-pressed={posizione === valore}
              onClick={() => impostaPosizione(valore)}
            >
              {valore === "tutte" ? "Tutti" : valore}
            </button>
          ))}
        </div>
        <div className="filtri-secondari">
          <label>
            Da controllare
            <select
              value={scadenza}
              onChange={(evento) => impostaScadenza(evento.target.value)}
            >
              <option value="tutti">Tutte le scadenze</option>
              <option value="oggi">Scadono oggi</option>
              <option value="tre">Entro 3 giorni</option>
              <option value="settimana">Entro 7 giorni</option>
              <option value="scaduti">Scaduti</option>
              <option value="senza">Data non indicata</option>
              <option value="scorte">In esaurimento</option>
            </select>
          </label>
          <label>
            Ordina per
            <select
              value={ordine}
              onChange={(evento) => impostaOrdine(evento.target.value)}
            >
              <option value="scadenza">Scadenza</option>
              <option value="inserimento">Più recenti</option>
              <option value="nome">Nome</option>
            </select>
          </label>
        </div>
      </div>
      <div className="testa-elenco">
        <p>
          {prodotti.length} {prodotti.length === 1 ? "prodotto" : "prodotti"}
        </p>
        <span>Tocca un prodotto per gestirlo</span>
      </div>
      {prodotti.length ? (
        <div className="lista-alimenti inventario-elenco">
          {prodotti.map((voce) => (
            <RigaAlimento
              key={voce.id}
              voce={voce}
              clic={() => dettaglio(voce)}
            />
          ))}
        </div>
      ) : (
        <Vuoto
          icona="scatola"
          titolo={
            stato.inventario.length
              ? "Nessun prodotto corrisponde"
              : "Il frigorifero è ancora vuoto."
          }
          testo={
            stato.inventario.length
              ? "Prova un’altra ricerca o modifica i filtri."
              : "Inizia da quello che hai già in casa. Scansiona una confezione per aggiungerla."
          }
          azione={
            stato.inventario.length
              ? "Azzera i filtri"
              : "Scansiona il primo prodotto"
          }
          onAzione={
            stato.inventario.length
              ? () => {
                  impostaRicerca("");
                  impostaPosizione("tutte");
                  impostaScadenza("tutti");
                }
              : aggiungi
          }
        />
      )}
    </section>
  );
}

export function DettaglioInventario({
  voce,
  posizioni,
  chiudi,
  aggiorna,
  notifica,
}: {
  voce: VoceInventario;
  posizioni: string[];
  chiudi: () => void;
  aggiorna: () => Promise<void>;
  notifica: (testo: string) => void;
}) {
  const operazioni = useRef(new Map<string, string>());
  const [azione, impostaAzione] = useState<"dettaglio" | "consuma" | "elimina">(
    "dettaglio",
  );
  const [errore, impostaErrore] = useState("");
  const [impegnato, impostaImpegnato] = useState(false);
  async function esegui(
    percorso: string,
    metodo: string,
    corpo: unknown,
    testo: string,
  ) {
    impostaErrore("");
    impostaImpegnato(true);
    try {
      await chiamaApi(
        percorso,
        metodo,
        corpo,
        metodo === "POST"
          ? chiaveOperazione(operazioni.current, percorso, corpo)
          : undefined,
      );
      await aggiorna();
      chiudi();
      notifica(testo);
    } catch (problema) {
      impostaErrore(
        problema instanceof Error
          ? problema.message
          : "Operazione non riuscita.",
      );
    } finally {
      impostaImpegnato(false);
    }
  }
  return (
    <Dialogo
      titolo={
        azione === "consuma"
          ? "Quanto hai consumato?"
          : azione === "elimina"
            ? "Rimuovi dall’inventario"
            : "Il tuo prodotto"
      }
      chiudi={() => {
        if (!impegnato) chiudi();
      }}
    >
      {azione === "dettaglio" ? (
        <>
          <InformazioniProdotto prodotto={voce.prodotto} />
          <div className="scadenza-dettaglio">
            <Scadenza data={voce.scadenza} />
          </div>
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              void esegui(
                `/api/inventario/${voce.id}`,
                "PATCH",
                leggiInventario(new FormData(evento.currentTarget)),
                "Prodotto aggiornato.",
              );
            }}
          >
            <CampiInventario voce={voce} posizioni={posizioni} />
            <Errore testo={errore} />
            <button className="pulsante primario largo" disabled={impegnato}>
              {impegnato ? "Salvataggio…" : "Salva modifiche"}
            </button>
          </form>
          <div className="azioni-prodotto">
            <button
              className="pulsante secondario"
              disabled={impegnato}
              onClick={() => impostaAzione("consuma")}
            >
              <Check size={18} />
              Segna come consumato
            </button>
            <button
              className="pulsante pericolo"
              disabled={impegnato}
              onClick={() => impostaAzione("elimina")}
            >
              <Trash2 size={17} />
              Elimina
            </button>
          </div>
        </>
      ) : azione === "consuma" ? (
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            const dati = new FormData(evento.currentTarget);
            void esegui(
              `/api/inventario/${voce.id}/consuma`,
              "POST",
              dati.get("consumo")
                ? { quantita: Number(dati.get("consumo")) }
                : {},
              "Consumo registrato. Inventario aggiornato.",
            );
          }}
        >
          <h3>{voce.prodotto.product_name}</h3>
          <p>Disponibile: {quantitaVoce(voce)}</p>
          {voce.quantita !== null ? (
            <>
              <label>
                Quantità consumata ({voce.unita})
                <input
                  name="consumo"
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  max={voce.quantita}
                  defaultValue={voce.quantita}
                />
              </label>
              <p className="nota">
                Puoi indicare una quantità parziale. Consumando tutto, il
                prodotto uscirà dall’inventario.
              </p>
            </>
          ) : (
            <p>
              Verranno consumate tutte le {voce.confezioni} confezioni. Per un
              consumo parziale, indica prima una quantità residua.
            </p>
          )}
          <Errore testo={errore} />
          <div className="azioni-dialogo">
            <button
              type="button"
              className="pulsante secondario"
              disabled={impegnato}
              onClick={() => impostaAzione("dettaglio")}
            >
              Indietro
            </button>
            <button className="pulsante primario" disabled={impegnato}>
              {impegnato ? "Registrazione…" : "Conferma consumo"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3>{voce.prodotto.product_name}</h3>
          <p>
            Rimuoverai {quantitaVoce(voce)} dal tuo inventario. L’eliminazione
            resterà nello storico, distinta dai prodotti consumati.
          </p>
          <Errore testo={errore} />
          <div className="azioni-dialogo">
            <button
              className="pulsante secondario"
              disabled={impegnato}
              onClick={() => impostaAzione("dettaglio")}
            >
              Annulla
            </button>
            <button
              className="pulsante pericolo"
              disabled={impegnato}
              onClick={() =>
                void esegui(
                  `/api/inventario/${voce.id}`,
                  "DELETE",
                  undefined,
                  "Prodotto rimosso dall’inventario.",
                )
              }
            >
              {impegnato ? "Rimozione…" : "Conferma eliminazione"}
            </button>
          </div>
        </>
      )}
    </Dialogo>
  );
}
