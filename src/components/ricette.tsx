"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Check,
  Clock3,
  Users,
  Utensils,
} from "lucide-react";
import type { Ricetta, StatoApplicazione } from "@/lib/tipi";
import {
  Caricamento,
  chiamaApi,
  Dialogo,
  Errore,
  giorniAllaScadenza,
  Nutrizione,
  numero,
  quantitaVoce,
  Vuoto,
} from "./comuni";
import { CampiPreferenze, leggiPreferenze } from "./preferenze";

export function Ricette({
  stato,
  aggiorna,
  notifica,
}: {
  stato: StatoApplicazione;
  aggiorna: () => Promise<void>;
  notifica: (testo: string) => void;
}) {
  const [selezionata, impostaSelezionata] = useState<Ricetta | null>(null);
  const [errore, impostaErrore] = useState("");
  const [impegnato, impostaImpegnato] = useState(false);
  const [conferma, impostaConferma] = useState(false);
  const disponibili = stato.inventario.filter(
    (voce) =>
      (giorniAllaScadenza(voce.scadenza) ?? 1) >= 0 &&
      voce.quantita !== null &&
      voce.quantita > 0 &&
      voce.unita !== "pz",
  );
  async function genera(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    impostaErrore("");
    impostaImpegnato(true);
    const dati = new FormData(evento.currentTarget);
    try {
      const ricetta = await chiamaApi<Ricetta>("/api/ricette", "POST", {
        ...leggiPreferenze(dati),
        persone: Number(dati.get("persone")),
        tempo_massimo: Number(dati.get("tempo_massimo")),
      });
      impostaSelezionata(ricetta);
      await aggiorna();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (problema) {
      impostaErrore(
        problema instanceof Error
          ? problema.message
          : "Non è stato possibile trovare una ricetta.",
      );
    } finally {
      impostaImpegnato(false);
    }
  }
  async function prepara() {
    if (!selezionata) return;
    impostaErrore("");
    impostaImpegnato(true);
    try {
      await chiamaApi(`/api/ricette/${selezionata.id}/prepara`, "POST");
      impostaSelezionata({
        ...selezionata,
        preparata_il: new Date().toISOString(),
      });
      impostaConferma(false);
      await aggiorna();
      notifica("Ricetta preparata. Inventario aggiornato.");
    } catch (problema) {
      impostaErrore(
        problema instanceof Error ? problema.message : "Consumo non riuscito.",
      );
    } finally {
      impostaImpegnato(false);
    }
  }
  if (selezionata)
    return (
      <section className="pagina ricetta-dettaglio">
        <button
          className="pulsante testuale ritorno"
          onClick={() => {
            impostaSelezionata(null);
            impostaErrore("");
          }}
        >
          <ArrowLeft size={18} />
          Tutte le ricette
        </button>
        <div className="testata-pagina">
          <p className="soprattitolo">Dalla tua cucina</p>
          <h1>{selezionata.titolo}</h1>
          <div className="metadati-ricetta">
            <span>
              <Clock3 size={18} />
              {selezionata.minuti} minuti
            </span>
            <span>
              <Users size={18} />
              {selezionata.porzioni} porzioni
            </span>
            {selezionata.preparata_il && (
              <span className="badge">
                <Check size={16} />
                Preparata
              </span>
            )}
          </div>
        </div>
        {selezionata.provider === "simulato" && (
          <div className="avviso">
            Ricetta del generatore simulato, dedicato a sviluppo e test.
          </div>
        )}
        {selezionata.avvisi.map((avviso, indice) => (
          <div className="avviso" key={indice}>
            {avviso}
          </div>
        ))}
        <div className="ricetta-colonne">
          <section className="ingredienti-ricetta">
            <h2>Gli ingredienti</h2>
            <p className="secondario">
              Quantità totali per {selezionata.porzioni} porzioni
            </p>
            <ul className="elenco-ingredienti">
              {selezionata.ingredienti.map((ingrediente) => (
                <li key={ingrediente.inventario_id}>
                  <span>
                    {selezionata.nomi_ingredienti[ingrediente.inventario_id] ||
                      "Prodotto in inventario"}
                  </span>
                  <strong>
                    {numero(ingrediente.quantita)} {ingrediente.unita}
                  </strong>
                </li>
              ))}
            </ul>
            <div className="nota-ricetta">
              <SegnoConferma />
              <p>
                Le quantità saranno scalate dall’inventario solo dopo la tua
                conferma.
              </p>
            </div>
          </section>
          <section className="procedimento">
            <h2>Mettiamoci ai fornelli</h2>
            <ol>
              {selezionata.passaggi.map((passaggio, indice) => (
                <li key={indice}>
                  <span className="numero-passaggio">
                    {String(indice + 1).padStart(2, "0")}
                  </span>
                  <p>{passaggio}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <section className="pannello nutrizione-ricetta">
          <div className="testa-sezione">
            <div>
              <p className="soprattitolo">Dati del tuo inventario</p>
              <h2>Nutrienti per porzione</h2>
            </div>
            <span className="badge">Calcolo deterministico</span>
          </div>
          <Nutrizione valori={selezionata.nutrizione.per_porzione} />
          <details className="dettagli">
            <summary>Totale della ricetta e singoli ingredienti</summary>
            <div className="contenuto-dettagli">
              <h3>Totale ricetta</h3>
              <Nutrizione valori={selezionata.nutrizione.totale} compatta />
              {selezionata.nutrizione.ingredienti.map((ingrediente) => (
                <section key={ingrediente.inventario_id}>
                  <h4>{ingrediente.nome}</h4>
                  <Nutrizione valori={ingrediente.valori} compatta />
                </section>
              ))}
            </div>
          </details>
          <p className="nota">
            I valori mancanti rimangono sconosciuti. I dati della fonte non
            costituiscono una certificazione medica.
          </p>
        </section>
        <Errore testo={!conferma ? errore : ""} />
        <button
          className="pulsante primario pulsante-cucina"
          disabled={!!selezionata.preparata_il}
          onClick={() => impostaConferma(true)}
        >
          <Utensils size={20} />
          {selezionata.preparata_il
            ? "Hai già preparato questa ricetta"
            : "Ho cucinato questa ricetta"}
        </button>
        {conferma && (
          <Dialogo
            titolo="Conferma gli ingredienti utilizzati"
            chiudi={() => {
              if (!impegnato) impostaConferma(false);
            }}
          >
            <p>Queste quantità verranno sottratte dal tuo inventario:</p>
            <ul className="elenco-ingredienti">
              {selezionata.ingredienti.map((ingrediente) => (
                <li key={ingrediente.inventario_id}>
                  <span>
                    {selezionata.nomi_ingredienti[ingrediente.inventario_id]}
                  </span>
                  <strong>
                    {numero(ingrediente.quantita)} {ingrediente.unita}
                  </strong>
                </li>
              ))}
            </ul>
            <Errore testo={errore} />
            <div className="azioni-dialogo">
              <button
                className="pulsante secondario"
                disabled={impegnato}
                onClick={() => impostaConferma(false)}
              >
                Annulla
              </button>
              <button
                className="pulsante primario"
                disabled={impegnato}
                onClick={() => void prepara()}
              >
                {impegnato ? "Aggiornamento…" : "Conferma consumo"}
              </button>
            </div>
          </Dialogo>
        )}
      </section>
    );
  return (
    <section className="pagina">
      <div className="testata-pagina">
        <p className="soprattitolo">Meno sprechi, più idee</p>
        <h1>Cosa cuciniamo?</h1>
        <p>Una ricetta che parte da quello che hai già in casa.</p>
      </div>
      {stato.generatore === "disabilitato" && (
        <div className="avviso">
          <ChefHat size={22} />
          <div>
            <strong>La generazione di ricette è disabilitata.</strong>
            <p>
              In questa versione non vengono utilizzati servizi AI. Le ricette
              salvate restano consultabili, con i loro calcoli nutrizionali.
            </p>
          </div>
        </div>
      )}
      {stato.generatore === "simulato" && (
        <div className="avviso">
          <ChefHat size={22} />
          <span>
            Generatore simulato attivo: modalità di sviluppo e test, con dati
            nutrizionali reali.
          </span>
        </div>
      )}
      <div className="ricette-griglia">
        <form className="pannello modulo-ricetta" onSubmit={genera}>
          <h2>A misura della tua giornata</h2>
          <div className="griglia-campi">
            <label>
              Persone
              <input
                name="persone"
                type="number"
                min="1"
                max="12"
                defaultValue="2"
                required
              />
            </label>
            <label>
              Tempo massimo (minuti)
              <input
                name="tempo_massimo"
                type="number"
                min="5"
                max="240"
                defaultValue="30"
                required
              />
            </label>
          </div>
          <CampiPreferenze preferenze={stato.preferenze} />
          <Errore testo={errore} />
          {impegnato ? (
            <Caricamento testo="Cerchiamo un’idea e verifichiamo quantità e nutrienti…" />
          ) : (
            <button
              className="pulsante primario largo"
              disabled={
                stato.generatore === "disabilitato" || !disponibili.length
              }
            >
              <ChefHat size={19} />
              Trova una ricetta
            </button>
          )}
        </form>
        <div className="disponibili-ricetta">
          <p className="soprattitolo">La tua base di partenza</p>
          <h2>
            {disponibili.length}{" "}
            {disponibili.length === 1
              ? "prodotto disponibile"
              : "prodotti disponibili"}
          </h2>
          <p className="secondario">
            Con quantità misurata e non scaduti. Applichiamo le preferenze prima
            della generazione.
          </p>
          {disponibili.length ? (
            <ul className="elenco-ingredienti">
              {disponibili.slice(0, 8).map((voce) => (
                <li key={voce.id}>
                  <span>{voce.prodotto.product_name}</span>
                  <strong>{quantitaVoce(voce)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <Vuoto
              titolo="Prepariamo la tua cucina"
              testo="Aggiungi alimenti e indica la quantità totale in grammi o millilitri. I prodotti scaduti non saranno utilizzati."
            />
          )}
          {disponibili.length > 8 && (
            <p className="nota">
              E altri {disponibili.length - 8} prodotti nel tuo inventario.
            </p>
          )}
        </div>
      </div>
      <section className="ricette-salvate">
        <div className="testa-sezione">
          <h2>Il tuo ricettario</h2>
          <span className="secondario">{stato.ricette.length} ricette</span>
        </div>
        {!stato.ricette.length ? (
          <Vuoto
            titolo="Le buone idee restano qui"
            testo="Le ricette che generi saranno conservate nel tuo ricettario locale."
          />
        ) : (
          <div className="lista-ricette">
            {stato.ricette.map((ricetta) => (
              <button
                key={ricetta.id}
                className="riga-ricetta"
                onClick={() => impostaSelezionata(ricetta)}
              >
                <span className="icona-alimento">
                  <ChefHat size={25} />
                </span>
                <span>
                  <strong>{ricetta.titolo}</strong>
                  <small>
                    {ricetta.minuti} min · {ricetta.porzioni} porzioni
                    {ricetta.preparata_il ? " · Preparata" : ""}
                  </small>
                </span>
                <ArrowRight size={20} />
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
function SegnoConferma() {
  return <Check size={19} />;
}
