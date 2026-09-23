"use client";
import { percorsoApp } from "@/lib/percorsi";
import { richiediPersistenza } from "@/lib/database";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChefHat,
  Check,
  ChevronRight,
  Clock3,
  Home,
  Leaf,
  Package,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
  Snowflake,
  Utensils,
  Warehouse,
} from "lucide-react";
import type { StatoApplicazione, VoceInventario } from "@/lib/tipi";
import { Aggiunta } from "./aggiunta";
import {
  Caricamento,
  chiamaApi,
  Errore,
  giorniAllaScadenza,
  IconaAlimento,
  Notifica,
  quantitaVoce,
  Scadenza,
  Vuoto,
} from "./comuni";
import { Inventario, DettaglioInventario } from "./inventario";
import { Ricette } from "./ricette";
import { Spesa, Impostazioni } from "./organizzazione";
import { scortaInEsaurimento } from "@/lib/motore";

type Pagina =
  "home" | "inventario" | "aggiungi" | "ricette" | "spesa" | "impostazioni";
const navigazione = [
  { chiave: "home", nome: "Home", icona: Home },
  { chiave: "inventario", nome: "Inventario", icona: Package },
  { chiave: "aggiungi", nome: "Aggiungi", icona: Plus },
  { chiave: "ricette", nome: "Ricette", icona: ChefHat },
  { chiave: "spesa", nome: "Spesa", icona: ShoppingBasket },
] as const;

export function Applicazione() {
  const [aggiornamento, impostaAggiornamento] = useState<ServiceWorkerRegistration | null>(null);
  const [pagina, impostaPagina] = useState<Pagina>("home");
  const [stato, impostaStato] = useState<StatoApplicazione | null>(null);
  const [errore, impostaErrore] = useState("");
  const [caricamento, impostaCaricamento] = useState(true);
  const [messaggio, impostaMessaggio] = useState("");
  const [dettaglio, impostaDettaglio] = useState<VoceInventario | null>(null);
  const [filtro, impostaFiltro] = useState("tutti");
  const temporizzatore = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const aggiorna = useCallback(async () => {
    const dati = await chiamaApi<StatoApplicazione>("/api/stato");
    impostaStato(dati);
    impostaErrore("");
  }, []);
  useEffect(() => {
    void aggiorna()
      .catch((problema) => impostaErrore(problema.message))
      .finally(() => impostaCaricamento(false));
    function leggiPagina() {
      const valore = window.location.hash.slice(1);
      if (
        [...navigazione.map((voce) => voce.chiave), "impostazioni"].includes(
          valore,
        )
      )
        impostaPagina(valore as Pagina);
    }
    leggiPagina();
    window.addEventListener("hashchange", leggiPagina);
    void richiediPersistenza();
    window.addEventListener("focus", ricaricaDati);
    function ricaricaDati() { void aggiorna().catch(() => {}); }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register(percorsoApp("/servizio-worker.js"), {scope: percorsoApp(), updateViaCache: "none"}).then((registrazione) => {
        if(registrazione.waiting) impostaAggiornamento(registrazione);
        registrazione.addEventListener("updatefound",()=>{const nuovo=registrazione.installing;nuovo?.addEventListener("statechange",()=>{if(nuovo.state==="installed" && navigator.serviceWorker.controller)impostaAggiornamento(registrazione);});});
        return registrazione.update();
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener("hashchange", leggiPagina);
      window.removeEventListener("focus", ricaricaDati);
      clearTimeout(temporizzatore.current);
    };
  }, [aggiorna]);
  function vai(destinazione: Pagina) {
    impostaPagina(destinazione);
    window.location.hash = destinazione;
    window.scrollTo({ top: 0 });
  }
  function notifica(testo: string) {
    clearTimeout(temporizzatore.current);
    impostaMessaggio(testo);
    temporizzatore.current = setTimeout(() => impostaMessaggio(""), 4200);
  }
  function mostraInventario(valore = "tutti") {
    impostaFiltro(valore);
    vai("inventario");
  }
  return (
    <>
      {aggiornamento && <div className="avviso" role="status">È disponibile un aggiornamento. <button className="pulsante secondario" onClick={()=>{navigator.serviceWorker.addEventListener("controllerchange",()=>window.location.reload(),{once:true});aggiornamento.waiting?.postMessage({tipo:"ATTIVA"});}}>Aggiorna app</button></div>}
      <a className="salta-contenuto" href="#contenuto">
        Vai al contenuto
      </a>
      <header className="intestazione">
        <div className="intestazione-interna">
          <button
            className="marchio"
            onClick={() => vai("home")}
            aria-label="FridgeBrain, vai alla Home"
          >
            <span className="marchio-segno">
              <Leaf size={24} strokeWidth={1.8} />
            </span>
            <span>
              fridge<span className="marchio-fine">brain</span>
              <small>PIÙ CURA, MENO SPRECHI</small>
            </span>
          </button>
          <nav className="navigazione" aria-label="Navigazione principale">
            {navigazione.map(({ chiave, nome, icona: Icona }) => (
              <button
                key={chiave}
                aria-current={pagina === chiave ? "page" : undefined}
                className={`voce-navigazione ${pagina === chiave ? "attiva" : ""} ${chiave === "aggiungi" ? "voce-aggiungi" : ""}`}
                onClick={() => {
                  if (chiave === "inventario") impostaFiltro("tutti");
                  vai(chiave);
                }}
              >
                <span>
                  <Icona size={21} />
                </span>
                {nome}
              </button>
            ))}
          </nav>
          <button
            className={`pulsante-icona impostazioni-pulsante ${pagina === "impostazioni" ? "attiva" : ""}`}
            aria-label="Impostazioni"
            onClick={() => vai("impostazioni")}
          >
            <Settings2 size={22} />
          </button>
        </div>
      </header>
      <main id="contenuto" tabIndex={-1} className="contenuto">
        {caricamento ? (
          <Caricamento testo="Apriamo la tua cucina…" />
        ) : !stato ? (
          <div className="pagina">
            <Errore testo={errore} />
            <button
              className="pulsante primario"
              onClick={() => {
                impostaCaricamento(true);
                void aggiorna()
                  .catch((problema) => impostaErrore(problema.message))
                  .finally(() => impostaCaricamento(false));
              }}
            >
              <RefreshCw size={18} />
              Riapri archivio locale
            </button>
          </div>
        ) : (
          <>
            {pagina === "home" && (
              <PaginaHome
                stato={stato}
                vai={vai}
                mostraInventario={mostraInventario}
                dettaglio={impostaDettaglio}
              />
            )}
            {pagina === "inventario" && (
              <Inventario
                key={filtro}
                stato={stato}
                filtroIniziale={filtro}
                dettaglio={impostaDettaglio}
                aggiungi={() => vai("aggiungi")}
              />
            )}
            {pagina === "aggiungi" && (
              <Aggiunta
                posizioni={stato.posizioni}
                completato={async () => {
                  await aggiorna();
                  notifica("Prodotto aggiunto alla tua cucina.");
                  mostraInventario();
                }}
              />
            )}
            {pagina === "ricette" && (
              <Ricette stato={stato} aggiorna={aggiorna} notifica={notifica} />
            )}
            {pagina === "spesa" && (
              <Spesa stato={stato} aggiorna={aggiorna} notifica={notifica} />
            )}
            {pagina === "impostazioni" && (
              <Impostazioni
                stato={stato}
                aggiorna={aggiorna}
                notifica={notifica}
              />
            )}
          </>
        )}
      </main>
      <footer className="piè-pagina">
        <span>
          <ShieldCheck size={15} />
          La tua cucina. I tuoi dati. Sempre con te.
        </span>
        <span>FridgeBrain · V1</span>
      </footer>
      {messaggio && <Notifica testo={messaggio} />}
      {dettaglio && stato && (
        <DettaglioInventario
          voce={dettaglio}
          posizioni={stato.posizioni}
          chiudi={() => impostaDettaglio(null)}
          aggiorna={aggiorna}
          notifica={notifica}
        />
      )}
    </>
  );
}

function PaginaHome({
  stato,
  vai,
  mostraInventario,
  dettaglio,
}: {
  stato: StatoApplicazione;
  vai: (pagina: Pagina) => void;
  mostraInventario: (filtro?: string) => void;
  dettaglio: (voce: VoceInventario) => void;
}) {
  const scaduti = stato.inventario.filter(
    (voce) => (giorniAllaScadenza(voce.scadenza) ?? 1) < 0,
  );
  const inScadenza = stato.inventario
    .filter((voce) => {
      const giorni = giorniAllaScadenza(voce.scadenza);
      return giorni !== null && giorni >= 0 && giorni <= 7;
    })
    .sort((prima, seconda) =>
      (prima.scadenza || "").localeCompare(seconda.scadenza || ""),
    );
  const oggi = inScadenza.filter(
    (voce) => giorniAllaScadenza(voce.scadenza) === 0,
  );
  const treGiorni = inScadenza.filter(
    (voce) => (giorniAllaScadenza(voce.scadenza) ?? 100) <= 3,
  );
  const daComprare = stato.spesa.filter((voce) => !voce.completato);
  const scorteBasse = stato.inventario.filter(scortaInEsaurimento);
  const data = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return (
    <section className="pagina home">
      <div className="saluto">
        <p className="soprattitolo">LA TUA CUCINA, IN ORDINE</p>
        <span className="data-oggi">{data}</span>
      </div>
      <div className="hero">
        <div className="hero-testo">
          <h1>
            Buono per te.
            <br />
            <span>Meglio per la tua spesa.</span>
          </h1>
          <p>
            Tieni d’occhio ciò che hai, dai valore a ciò che resta.
            <br className="solo-desktop" /> Ogni giorno, un piccolo spreco in
            meno.
          </p>
          <button className="pulsante primario" onClick={() => vai("aggiungi")}>
            <Plus size={20} />
            Aggiungi un prodotto
          </button>
        </div>
        <IllustrazioneCucina />
      </div>
      <div className="riepilogo">
        <button onClick={() => mostraInventario()}>
          <span className="etichetta-riepilogo">
            <Package size={18} />
            In casa
          </span>
          <strong>{stato.inventario.length}</strong>
          <span>
            {stato.inventario.length === 1
              ? "prodotto nel tuo inventario"
              : "prodotti nel tuo inventario"}
          </span>
        </button>
        <button onClick={() => mostraInventario("oggi")}>
          <span className="etichetta-riepilogo">
            <Clock3 size={18} />
            Scadono oggi
          </span>
          <strong>
            {oggi.length}
            <small> / {treGiorni.length} entro 3 giorni</small>
          </strong>
          <span>da tenere d’occhio</span>
        </button>
        <button onClick={() => mostraInventario("settimana")}>
          <span className="etichetta-riepilogo">
            <Leaf size={18} />
            Entro 7 giorni
          </span>
          <strong>{inScadenza.length}</strong>
          <span>occasioni per cucinare</span>
        </button>
        <button
          className={scaduti.length ? "riepilogo-critico" : ""}
          onClick={() => mostraInventario("scaduti")}
        >
          <span className="etichetta-riepilogo">
            <Clock3 size={18} />
            Scaduti
          </span>
          <strong>{scaduti.length}</strong>
          <span>
            {scaduti.length
              ? "controlla le confezioni"
              : "nessuno spreco in vista"}
          </span>
        </button>
      </div>
      <div className="home-colonne">
        <div>
          <section className="sezione-prima">
            <div className="testa-sezione">
              <div>
                <p className="soprattitolo">UN’ATTENZIONE IN PIÙ</p>
                <h2>Da consumare prima</h2>
              </div>
              <button
                className="collegamento"
                onClick={() => mostraInventario("settimana")}
              >
                Vedi tutti
                <ArrowRight size={17} />
              </button>
            </div>
            {inScadenza.length ? (
              <div className="lista-alimenti">
                {inScadenza.slice(0, 4).map((voce) => (
                  <RigaAlimento
                    key={voce.id}
                    voce={voce}
                    clic={() => dettaglio(voce)}
                  />
                ))}
              </div>
            ) : !stato.inventario.length ? (
              <Vuoto
                titolo="Il frigorifero è ancora vuoto."
                testo="Comincia dai prodotti che hai già in casa. Bastano un codice a barre e pochi secondi."
                azione="Scansiona il primo prodotto"
                onAzione={() => vai("aggiungi")}
              />
            ) : (
              <div className="tutto-in-ordine">
                <span>
                  <Check size={24} />
                </span>
                <div>
                  <h3>Nessuna scadenza nei prossimi 7 giorni</h3>
                  <p>
                    Controlla di avere indicato la data su tutte le confezioni.
                  </p>
                </div>
              </div>
            )}
            {scaduti.length > 0 && (
              <button
                className="avviso avviso-cliccabile"
                onClick={() => mostraInventario("scaduti")}
              >
                <Clock3 size={18} />
                <span>
                  {scaduti.length}{" "}
                  {scaduti.length === 1 ? "prodotto ha" : "prodotti hanno"}{" "}
                  superato la scadenza. Controlla l’inventario.
                </span>
                <ChevronRight size={19} />
              </button>
            )}
          </section>
          <section className="posizioni-home">
            {scorteBasse.length > 0 && (
              <button
                className="avviso avviso-cliccabile"
                onClick={() => mostraInventario("scorte")}
              >
                <Package size={20} />
                <span>
                  {scorteBasse.length}{" "}
                  {scorteBasse.length === 1
                    ? "prodotto in esaurimento"
                    : "prodotti in esaurimento"}
                  . Controlla le scorte.
                </span>
                <ChevronRight size={18} />
              </button>
            )}
            <div className="testa-sezione">
              <h2>Ogni cosa al suo posto</h2>
            </div>
            <div className="posizioni-elenco">
              {stato.posizioni.map((posizione) => {
                const numeroProdotti = stato.inventario.filter(
                  (voce) => voce.posizione === posizione,
                ).length;
                const Icona =
                  posizione === "Freezer"
                    ? Snowflake
                    : posizione === "Dispensa"
                      ? Warehouse
                      : Package;
                return (
                  <button
                    key={posizione}
                    onClick={() => mostraInventario(posizione)}
                  >
                    <Icona size={24} />
                    <span>
                      <strong>{posizione}</strong>
                      <small>
                        {numeroProdotti}{" "}
                        {numeroProdotti === 1 ? "prodotto" : "prodotti"}
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="home-secondaria">
          <section className="invito-ricetta">
            <span className="icona-invito">
              <Utensils size={27} />
            </span>
            <p className="soprattitolo">ISPIRAZIONE, DAL TUO FRIGO</p>
            <h2>
              Cosa posso
              <br />
              cucinare oggi?
            </h2>
            <p>
              Trasforma quello che hai in una buona idea per il prossimo pasto.
            </p>
            <button className="pulsante chiaro" onClick={() => vai("ricette")}>
              Trova una ricetta
              <ArrowRight size={18} />
            </button>
          </section>
          <section className="spesa-home">
            <div className="testa-sezione">
              <h2>Da comprare</h2>
              <span className="contatore">{daComprare.length}</span>
            </div>
            {daComprare.length ? (
              <ul>
                {daComprare.slice(0, 3).map((voce) => (
                  <li key={voce.id}>
                    <span className="cerchio-spesa" />
                    <span>{voce.nome}</span>
                    <small>{voce.quantita}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="secondario">
                La lista è libera. Annota qui ciò che manca, prima di
                dimenticarlo.
              </p>
            )}
            <button className="collegamento" onClick={() => vai("spesa")}>
              Apri la lista della spesa
              <ArrowRight size={17} />
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}
export function RigaAlimento({
  voce,
  clic,
}: {
  voce: VoceInventario;
  clic: () => void;
}) {
  return (
    <button
      className="riga-alimento"
      onClick={clic}
      aria-label={`Apri ${voce.prodotto.product_name}`}
    >
      <IconaAlimento posizione={voce.posizione} />
      <span className="nome-alimento">
        <strong>{voce.prodotto.product_name}</strong>
        <small>
          {[voce.prodotto.brands, `${quantitaVoce(voce)} · ${voce.posizione}`]
            .filter(Boolean)
            .join(" · ")}
        </small>
        <Scadenza data={voce.scadenza} />
        {scortaInEsaurimento(voce) && (
          <span className="scadenza vicina">
            <Package size={13} />
            In esaurimento
          </span>
        )}
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
function IllustrazioneCucina() {
  return (
    <div className="illustrazione-cucina" aria-hidden="true">
      <svg viewBox="0 0 360 245" fill="none">
        <ellipse
          cx="196"
          cy="206"
          rx="131"
          ry="16"
          fill="#cbd9bd"
          opacity=".5"
        />
        <path d="M102 111h177l-13 85H114z" fill="#e8d7b6" />
        <path d="M96 103h188v19H96z" fill="#f1e7d2" />
        <path
          d="M133 133v49m28-49v49m28-49v49m28-49v49m28-49v49"
          stroke="#cfbb96"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M176 119c-39-37-54-63-43-85 27 6 38 38 43 85z"
          fill="#67915a"
        />
        <path d="M169 110c-28-64-14-91 5-99 26 35 22 63-5 99z" fill="#345f3a" />
        <path d="M179 113c-1-66 20-91 42-89 10 34-8 64-42 89z" fill="#80a166" />
        <path d="M182 103c20-29 45-35 60-26-2 25-30 35-60 26z" fill="#4d7947" />
        <path d="M168 99c-35-8-52-28-44-45 24 0 40 16 44 45z" fill="#8fae70" />
        <path d="M258 116c-14-24-15-44 0-54 21 13 24 30 0 54" fill="#e9ae6b" />
        <path d="M255 73c-13-17-14-24-9-30 12 9 17 16 9 30" fill="#638957" />
        <path d="M263 73c0-22 9-32 19-32 1 16-5 28-19 32" fill="#46764c" />
        <circle cx="123" cy="108" r="27" fill="#c87456" />
        <path
          d="M117 79l6 10 8-9m-8 9 11 2m-11-2-10 2"
          stroke="#4a7047"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="278" cy="196" r="20" fill="#deb35d" />
        <path d="M274 176c8-10 18-11 22-4-7 9-13 9-22 4" fill="#59854e" />
        <path d="M73 172c-9-14-20-17-29-9 2 15 13 19 29 9z" fill="#7f9e6d" />
        <path d="M74 184c-16 1-23 8-19 18 15 3 24-4 19-18z" fill="#a9bc8c" />
        <path d="M72 167c11 23 16 38 21 44" stroke="#789665" strokeWidth="3" />
        <path
          d="M310 109l4-5m-7 0 10 6"
          stroke="#6e9573"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="87" cy="80" r="3" fill="#90aa7f" />
      </svg>
      <span className="etichetta-illustrazione">
        <Leaf size={14} />
        Ogni ingrediente conta.
      </span>
    </div>
  );
}
