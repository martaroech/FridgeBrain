"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  History,
  Leaf,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { EventoStorico, StatoApplicazione, VoceSpesa } from "@/lib/tipi";
import {
  Caricamento,
  chiamaApi,
  chiaveOperazione,
  Dialogo,
  Errore,
  Vuoto,
} from "./comuni";
import { CampiPreferenze, leggiPreferenze } from "./preferenze";

export function Spesa({
  stato,
  aggiorna,
  notifica,
}: {
  stato: StatoApplicazione;
  aggiorna: () => Promise<void>;
  notifica: (testo: string) => void;
}) {
  const operazioni = useRef(new Map<string, string>());
  const [errore, impostaErrore] = useState("");
  const [impegnato, impostaImpegnato] = useState(false);
  const [modifica, impostaModifica] = useState<VoceSpesa | null>(null);
  async function esegui(
    percorso: string,
    metodo: string,
    corpo?: unknown,
    messaggio?: string,
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
      operazioni.current.clear();
      if (messaggio) notifica(messaggio);
      return true;
    } catch (problema) {
      impostaErrore(
        problema instanceof Error
          ? problema.message
          : "La lista non è stata aggiornata.",
      );
      return false;
    } finally {
      impostaImpegnato(false);
    }
  }
  async function aggiungi(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const modulo = evento.currentTarget;
    const dati = new FormData(modulo);
    if (
      await esegui(
        "/api/spesa",
        "POST",
        { nome: dati.get("nome"), quantita: dati.get("quantita") },
        "Aggiunto alla lista della spesa.",
      )
    )
      modulo.reset();
  }
  const lista = [...stato.spesa].sort(
    (prima, seconda) =>
      Number(prima.completato) - Number(seconda.completato) ||
      prima.inserito_il.localeCompare(seconda.inserito_il),
  );
  const rimanenti = lista.filter((voce) => !voce.completato).length;
  return (
    <section className="pagina pagina-spesa">
      <div className="testata-pagina">
        <p className="soprattitolo">La prossima spesa, più semplice</p>
        <h1>Da portare a casa</h1>
        <p>
          {rimanenti
            ? `${rimanenti} cose da comprare. Una lista, meno dimenticanze.`
            : "Annota ciò che manca, quando ti viene in mente."}
        </p>
      </div>
      <form className="aggiungi-spesa" onSubmit={aggiungi}>
        <label>
          Cosa manca?
          <input name="nome" placeholder="Pomodori" maxLength={200} required />
        </label>
        <label>
          Quantità
          <input name="quantita" placeholder="500 g" maxLength={100} />
        </label>
        <button className="pulsante primario" disabled={impegnato}>
          <Plus size={20} />
          Aggiungi alla spesa
        </button>
      </form>
      {!modifica && <Errore testo={errore} />}
      {lista.length ? (
        <div className="lista-spesa">
          {lista.map((voce) => (
            <div
              className={`riga-spesa ${voce.completato ? "completata" : ""}`}
              key={voce.id}
            >
              <button
                className="spunta-spesa"
                role="checkbox"
                aria-checked={voce.completato}
                aria-label={`${voce.completato ? "Da comprare" : "Segna acquistato"}: ${voce.nome}`}
                disabled={impegnato}
                onClick={() =>
                  void esegui(`/api/spesa/${voce.id}`, "PATCH", {
                    completato: !voce.completato,
                  })
                }
              >
                {voce.completato && <Check size={17} />}
              </button>
              <div className="testo-spesa">
                <strong>{voce.nome}</strong>
                <span>{voce.quantita || "Quantità da scegliere"}</span>
              </div>
              <button
                className="pulsante-icona"
                disabled={impegnato}
                aria-label={`Modifica ${voce.nome}`}
                onClick={() => impostaModifica(voce)}
              >
                <Pencil size={17} />
              </button>
              <button
                className="pulsante-icona"
                disabled={impegnato}
                aria-label={`Rimuovi ${voce.nome}`}
                onClick={() =>
                  void esegui(
                    `/api/spesa/${voce.id}`,
                    "DELETE",
                    undefined,
                    "Elemento rimosso dalla lista.",
                  )
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Vuoto
          titolo="Una lista leggera, per ora."
          testo="Aggiungi gli ingredienti che mancano. Al supermercato, spunta ciò che hai trovato."
        />
      )}
      {lista.length > 0 && (
        <p className="nota nota-lista">
          Gli elementi acquistati restano in fondo alla lista. Aggiungili
          all’inventario quando rientri a casa.
        </p>
      )}
      {modifica && (
        <Dialogo
          titolo="Modifica elemento della spesa"
          chiudi={() => {
            if (!impegnato) impostaModifica(null);
          }}
        >
          <form
            onSubmit={async (evento) => {
              evento.preventDefault();
              const dati = new FormData(evento.currentTarget);
              if (
                await esegui(
                  `/api/spesa/${modifica.id}`,
                  "PATCH",
                  { nome: dati.get("nome"), quantita: dati.get("quantita") },
                  "Elemento aggiornato.",
                )
              )
                impostaModifica(null);
            }}
          >
            <label>
              Nome
              <input
                name="nome"
                defaultValue={modifica.nome}
                required
                maxLength={200}
              />
            </label>
            <label>
              Quantità
              <input
                name="quantita"
                defaultValue={modifica.quantita}
                maxLength={100}
              />
            </label>
            <Errore testo={errore} />
            <button className="pulsante primario largo" disabled={impegnato}>
              Salva elemento
            </button>
          </form>
        </Dialogo>
      )}
    </section>
  );
}

export function Impostazioni({
  stato,
  aggiorna,
  notifica,
}: {
  stato: StatoApplicazione;
  aggiorna: () => Promise<void>;
  notifica: (testo: string) => void;
}) {
  const [errore, impostaErrore] = useState("");
  const [impegnato, impostaImpegnato] = useState(false);
  const [storico, impostaStorico] = useState<EventoStorico[] | null>(null);
  const [erroreStorico, impostaErroreStorico] = useState("");
  useEffect(() => {
    void chiamaApi<EventoStorico[]>("/api/storico")
      .then(impostaStorico)
      .catch((problema) => impostaErroreStorico(problema.message));
  }, []);
  async function salva(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    impostaErrore("");
    impostaImpegnato(true);
    try {
      await chiamaApi(
        "/api/preferenze",
        "PUT",
        leggiPreferenze(new FormData(evento.currentTarget)),
      );
      await aggiorna();
      notifica("Preferenze salvate.");
    } catch (problema) {
      impostaErrore(
        problema instanceof Error
          ? problema.message
          : "Preferenze non salvate.",
      );
    } finally {
      impostaImpegnato(false);
    }
  }
  return (
    <section className="pagina">
      <div className="testata-pagina">
        <p className="soprattitolo">La cucina che ti somiglia</p>
        <h1>Le tue preferenze</h1>
        <p>
          Le tue abitudini sono il punto di partenza delle prossime ricette.
        </p>
      </div>
      <div className="impostazioni-griglia">
        <form className="pannello" onSubmit={salva}>
          <h2>
            <Leaf size={23} />
            Alimentazione
          </h2>
          <CampiPreferenze preferenze={stato.preferenze} />
          <Errore testo={errore} />
          <button className="pulsante primario largo" disabled={impegnato}>
            {impegnato ? "Salvataggio…" : "Salva preferenze"}
          </button>
        </form>
        <aside className="informazioni-locali">
          <span className="icona-sezione">
            <ShieldCheck size={26} />
          </span>
          <h2>A casa tua, davvero.</h2>
          <p>
            Inventario, preferenze e ricette sono conservati sul tuo server
            locale. Non è necessario un account.
          </p>
          <dl className="stato-sistema">
            <div>
              <dt>Catalogo alimentare</dt>
              <dd>
                {stato.catalogo_disponibile ? "Disponibile" : "Da preparare"}
              </dd>
            </div>
            <div>
              <dt>Generatore ricette</dt>
              <dd>
                {stato.generatore === "locale"
                  ? "Modello locale"
                  : stato.generatore === "simulato"
                    ? "Simulato · test"
                    : "Non configurato"}
              </dd>
            </div>
          </dl>
          <details className="dettagli">
            <summary>Configurare il generatore locale</summary>
            <div className="contenuto-dettagli">
              <p>
                Installa Ollama sul server e scarica un modello. Nel file di
                configurazione imposta:
              </p>
              <code className="blocco-codice">
                FRIDGEBRAIN_GENERATORE=locale
                <br />
                FRIDGEBRAIN_MODELLO=nome-del-modello
                <br />
                FRIDGEBRAIN_OLLAMA_URL=http://127.0.0.1:11434
              </code>
              <p className="nota">
                Riavvia il server dopo le modifiche. Consulta il README del
                progetto per Docker e la configurazione completa.
              </p>
            </div>
          </details>
          <details className="dettagli">
            <summary>Installazione e backup</summary>
            <div className="contenuto-dettagli">
              <p>
                Per installare l’app usa «Installa» o «Aggiungi alla schermata
                Home» nel menu del browser. Su smartphone usa l’indirizzo HTTPS
                del server di casa.
              </p>
              <p>
                Per conservare i tuoi dati esegui il backup di fridgebrain.db
                seguendo le istruzioni nel README. Il catalogo foods.db può
                essere rigenerato separatamente.
              </p>
              <p className="nota">
                Senza Internet l’app funziona sulla rete locale. Il server che
                conserva i dati deve essere acceso e raggiungibile.
              </p>
            </div>
          </details>
        </aside>
      </div>
      <section className="storico">
        <div className="testa-sezione">
          <h2>
            <History size={22} />
            La vita della tua cucina
          </h2>
          <span className="secondario">Ultimi 200 eventi</span>
        </div>
        <Errore testo={erroreStorico} />
        {storico === null && !erroreStorico ? (
          <Caricamento testo="Caricamento dello storico…" />
        ) : storico?.length ? (
          <ol className="lista-storico">
            {storico.map((evento) => (
              <li key={evento.id}>
                <span className="punto-storico" />
                <div>
                  <p>{evento.descrizione}</p>
                  <time dateTime={evento.creato_il}>
                    {new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(evento.creato_il))}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          !erroreStorico && (
            <Vuoto
              titolo="La tua storia comincia qui"
              testo="Qui ritroverai i prodotti consumati, le rimozioni e le ricette preparate."
            />
          )
        )}
      </section>
    </section>
  );
}
