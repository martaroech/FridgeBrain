"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Plus,
  ScanBarcode,
  Search,
} from "lucide-react";
import type { Prodotto, Unita, VoceInventario } from "@/lib/tipi";
import {
  allergeni,
  chiamaApi,
  chiaveOperazione,
  Errore,
  InformazioniProdotto,
  nutrienti,
} from "./comuni";

function ignoraLogZxing() {
  const originale = console.error;
  console.error = (...argomenti: Parameters<typeof console.error>) => {
    if (
      typeof argomenti[0] === "string" &&
      argomenti[0].includes("MultiFormatReader")
    )
      return;
    originale(...argomenti);
  };
  return () => {
    console.error = originale;
  };
}

function Fotocamera({ rilevato }: { rilevato: (codice: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [errore, impostaErrore] = useState("");
  const [tentativo, impostaTentativo] = useState(0);
  const [attiva, impostaAttiva] = useState(false);
  useEffect(() => {
    let annullato = false;
    let giaLetto = false;
    let controllo: { stop: () => void } | undefined;
    let ripristinaLog: (() => void) | undefined;
    async function avvia() {
      impostaErrore("");
      impostaAttiva(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        impostaErrore(
          "Fotocamera non disponibile. Usa il codice manuale; da smartphone la fotocamera richiede una connessione HTTPS.",
        );
        return;
      }
      try {
        const { BarcodeFormat, BrowserMultiFormatOneDReader } = await import(
          "@zxing/browser"
        );
        if (annullato || !video.current) return;
        ripristinaLog = ignoraLogZxing();
        const formati = new Map();
        // DecodeHintType.POSSIBLE_FORMATS: solo barcode alimentari, niente QR.
        formati.set(2, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        const lettore = new BrowserMultiFormatOneDReader(formati);
        controllo = await lettore.decodeFromVideoDevice(
          undefined,
          video.current,
          (risultato, _errore, comandi) => {
            if (risultato && !annullato && !giaLetto) {
              giaLetto = true;
              comandi.stop();
              rilevato(risultato.getText());
            }
          },
        );
        if (annullato || giaLetto) controllo.stop();
        else impostaAttiva(true);
      } catch (problema) {
        if (annullato) return;
        const nome = problema instanceof Error ? problema.name : "";
        impostaErrore(
          nome === "NotAllowedError"
            ? "Permesso fotocamera negato. Puoi consentirlo nelle impostazioni del browser oppure inserire il codice qui sotto."
            : "La fotocamera non è disponibile o è utilizzata da un’altra applicazione. Inserisci il codice manualmente o riprova.",
        );
      }
    }
    void avvia();
    return () => {
      annullato = true;
      controllo?.stop();
      ripristinaLog?.();
    };
  }, [rilevato, tentativo]);
  return (
    <>
      <div className="scanner">
        <video
          ref={video}
          muted
          playsInline
          aria-label="Anteprima fotocamera per la scansione"
        />
        <div className="scanner-sovrapposto">
          <div className="scanner-cornice">
            {!attiva &&
              (errore ? <CameraOff size={37} /> : <Camera size={37} />)}
          </div>
          <p>
            {attiva
              ? "Inquadra il codice a barre"
              : errore
                ? "Puoi usare il codice manuale"
                : "Attivazione della fotocamera…"}
          </p>
          <span>La scansione avviene sul tuo dispositivo</span>
        </div>
      </div>
      {errore && (
        <div className="errore-fotocamera">
          <Errore testo={errore} />
          <button
            type="button"
            className="pulsante testuale"
            onClick={() => impostaTentativo(tentativo + 1)}
          >
            Riprova fotocamera
          </button>
        </div>
      )}
    </>
  );
}

export function CampiInventario({
  posizioni,
  voce,
  prodotto,
}: {
  posizioni: string[];
  voce?: VoceInventario;
  prodotto?: Prodotto;
}) {
  const dichiarata = prodotto?.quantity?.match(
    /^\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\s*$/i,
  );
  const unitaDichiarata = dichiarata?.[2].toLowerCase();
  const quantitaDichiarata = dichiarata
    ? Number(dichiarata[1].replace(",", ".")) *
      (unitaDichiarata === "kg" || unitaDichiarata === "l"
        ? 1000
        : unitaDichiarata === "cl"
          ? 10
          : 1)
    : "";
  return (
    <div className="campi-inventario">
      <div className="griglia-campi">
        <label>
          Confezioni
          <input
            name="confezioni"
            type="number"
            min="1"
            max="9999"
            step="1"
            required
            defaultValue={voce?.confezioni ?? 1}
          />
        </label>
        <label>
          Posizione
          <select
            name="posizione"
            defaultValue={voce?.posizione || posizioni[0] || "Frigorifero"}
          >
            {posizioni.map((posizione) => (
              <option key={posizione}>{posizione}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="griglia-campi quantita-campi">
        <label>
          Quantità totale residua
          <input
            name="quantita"
            type="number"
            min="0.01"
            max="1000000"
            step="any"
            placeholder="Opzionale"
            defaultValue={voce?.quantita ?? quantitaDichiarata}
            aria-describedby="nota-quantita"
          />
        </label>
        <label>
          Unità
          <select
            name="unita"
            defaultValue={
              voce?.unita ||
              (unitaDichiarata && ["l", "cl", "ml"].includes(unitaDichiarata)
                ? "ml"
                : "g")
            }
          >
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="pz">pezzi</option>
          </select>
        </label>
      </div>
      <p className="nota" id="nota-quantita">
        Quantità complessiva di tutte le confezioni. Per le ricette servono
        grammi o millilitri misurati.
      </p>
      <label>
        Data di scadenza
        <input
          name="scadenza"
          type="date"
          defaultValue={voce?.scadenza || ""}
        />
      </label>
      <p className="nota">
        Leggi la data sulla confezione. Puoi aggiungerla anche in seguito.
      </p>
      <details className="dettagli">
        <summary>Avviso scorta minima (opzionale)</summary>
        <div className="contenuto-dettagli">
          <label>
            Scorta minima
            <input
              name="scorta_minima"
              type="number"
              min="0.001"
              max="1000000"
              step="any"
              placeholder="Nessun avviso"
              defaultValue={voce?.scorta_minima ?? ""}
            />
          </label>
          <p className="nota">
            Usa la stessa unità della quantità residua. Quando raggiungi questa
            soglia, il prodotto è segnalato come in esaurimento. Lascia vuoto
            per disattivare.
          </p>
        </div>
      </details>
    </div>
  );
}
export function leggiInventario(dati: FormData) {
  return {
    confezioni: Number(dati.get("confezioni")),
    quantita: dati.get("quantita") ? Number(dati.get("quantita")) : null,
    unita: dati.get("unita") as Unita,
    posizione: String(dati.get("posizione")),
    scadenza: dati.get("scadenza") || null,
    scorta_minima: dati.get("scorta_minima")
      ? Number(dati.get("scorta_minima"))
      : null,
  };
}

export function Aggiunta({
  posizioni,
  completato,
}: {
  posizioni: string[];
  completato: () => Promise<void>;
}) {
  const operazioni = useRef(new Map<string, string>());
  const [codice, impostaCodice] = useState("");
  const [prodotto, impostaProdotto] = useState<Prodotto | null>(null);
  const [errore, impostaErrore] = useState("");
  const [impegnato, impostaImpegnato] = useState(false);
  const [personalizza, impostaPersonalizza] = useState(false);
  const [assente, impostaAssente] = useState(false);
  const [scansione, impostaScansione] = useState(true);
  const cerca = useCallback(async (valore: string) => {
    if (!valore.trim()) return;
    impostaScansione(false);
    impostaImpegnato(true);
    impostaErrore("");
    impostaAssente(false);
    impostaCodice(valore.trim());
    try {
      const trovato = await chiamaApi<Prodotto>(
        `/api/prodotti?codice=${encodeURIComponent(valore.trim())}`,
      );
      impostaProdotto(trovato);
    } catch (problema) {
      impostaErrore(
        problema instanceof Error ? problema.message : "Ricerca non riuscita.",
      );
      impostaAssente(true);
    } finally {
      impostaImpegnato(false);
    }
  }, []);
  async function salva(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    impostaImpegnato(true);
    impostaErrore("");
    const dati = new FormData(evento.currentTarget);
    try {
      let selezionato = prodotto;
      if (personalizza && !prodotto) {
        const valori: Record<string, unknown> = {};
        nutrienti.forEach(({ campo }) => {
          const valore = dati.get(campo);
          if (valore !== "" && valore !== null) valori[campo] = Number(valore);
        });
        const dichiarati = dati.getAll("allergeni").map(String);
        const etichette = dati.getAll("etichette").map(String);
        const personalizzato = {
          code: codice.trim(),
          product_name: String(dati.get("nome")).trim(),
          brands: String(dati.get("marca")).trim(),
          quantity: String(dati.get("confezione")).trim(),
          ingredients_text: String(dati.get("ingredienti")).trim(),
          nutriments: valori,
          allergens_tags: dichiarati.length ? dichiarati : undefined,
          labels_tags: etichette,
          unita_nutrizionale: dati.get("base_nutrizionale"),
          personalizzato: true,
        };
        selezionato = await chiamaApi<Prodotto>(
          "/api/prodotti",
          "POST",
          personalizzato,
          chiaveOperazione(operazioni.current, "/api/prodotti", personalizzato),
        );
      }
      if (!selezionato)
        throw new Error("Seleziona un prodotto prima di aggiungerlo.");
      impostaProdotto(selezionato);
      impostaPersonalizza(false);
      const aggiunta = { codice: selezionato.code, ...leggiInventario(dati) };
      await chiamaApi(
        "/api/inventario",
        "POST",
        aggiunta,
        chiaveOperazione(operazioni.current, "/api/inventario", aggiunta),
      );
      await completato();
    } catch (problema) {
      impostaErrore(
        problema instanceof Error
          ? problema.message
          : "Salvataggio non riuscito.",
      );
    } finally {
      impostaImpegnato(false);
    }
  }
  if (prodotto || personalizza)
    return (
      <section className="pagina aggiunta-prodotto">
        <button
          className="pulsante testuale ritorno"
          onClick={() => {
            impostaProdotto(null);
            impostaPersonalizza(false);
            impostaErrore("");
          }}
        >
          <ArrowLeft size={17} />
          Cambia prodotto
        </button>
        <div className="testata-pagina">
          <p className="soprattitolo">Un posto nella tua cucina</p>
          <h1>{personalizza ? "Crea il tuo prodotto" : "Aggiungi in casa"}</h1>
          <p>Quantità, posizione e scadenza. Al resto pensiamo noi.</p>
        </div>
        <form className="pannello modulo-aggiunta" onSubmit={salva}>
          {prodotto && <InformazioniProdotto prodotto={prodotto} />}
          {personalizza && (
            <>
              <div className="codice-riepilogo">
                <ScanBarcode size={20} />
                <span>Codice {codice}</span>
              </div>
              <label>
                Nome prodotto
                <input
                  name="nome"
                  required
                  maxLength={200}
                  autoComplete="off"
                />
              </label>
              <div className="griglia-campi">
                <label>
                  Marca
                  <input name="marca" maxLength={150} placeholder="Opzionale" />
                </label>
                <label>
                  Quantità sulla confezione
                  <input
                    name="confezione"
                    placeholder="Ad esempio 500 g"
                    maxLength={80}
                  />
                </label>
              </div>
              <details className="dettagli">
                <summary>
                  Ingredienti, allergeni e valori nutrizionali (opzionali)
                </summary>
                <div className="contenuto-dettagli">
                  <label>
                    Ingredienti
                    <textarea
                      name="ingredienti"
                      rows={3}
                      maxLength={10000}
                      placeholder="Trascrivi l’etichetta"
                    />
                  </label>
                  <fieldset>
                    <legend>Allergeni dichiarati in etichetta</legend>
                    <div className="scelte-allergeni">
                      {allergeni.map(([valore, nome]) => (
                        <label className="scelta" key={valore}>
                          <input
                            type="checkbox"
                            name="allergeni"
                            value={valore}
                          />
                          {nome}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Dichiarazioni esplicite del produttore</legend>
                    <p className="nota">
                      Seleziona solo le indicazioni effettivamente riportate in
                      etichetta.
                    </p>
                    <div className="scelte-allergeni">
                      {[
                        ["en:vegan", "Vegano"],
                        ["en:vegetarian", "Vegetariano"],
                        ["en:gluten-free", "Senza glutine"],
                        ["en:milk-free", "Senza latte"],
                      ].map(([valore, nome]) => (
                        <label className="scelta" key={valore}>
                          <input
                            type="checkbox"
                            name="etichette"
                            value={valore}
                          />
                          {nome}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    Base dei valori nutrizionali
                    <select name="base_nutrizionale">
                      <option value="g">Per 100 g</option>
                      <option value="ml">Per 100 ml</option>
                    </select>
                  </label>
                  <div className="griglia-campi">
                    {nutrienti.map(({ nome, unita, campo }) => (
                      <label key={campo}>
                        {nome} ({unita})
                        <input
                          type="number"
                          min="0"
                          step="any"
                          name={campo}
                          placeholder="Sconosciuto"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="nota">
                    Lascia vuoti i dati non riportati: non saranno interpretati
                    come zero.
                  </p>
                </div>
              </details>
            </>
          )}
          <h3 className="titolo-form">Dove lo conservi?</h3>
          <CampiInventario
            posizioni={posizioni}
            prodotto={prodotto || undefined}
          />
          <Errore testo={errore} />
          <button className="pulsante primario largo" disabled={impegnato}>
            <Plus size={20} />
            {impegnato ? "Salvataggio…" : "Aggiungi all’inventario"}
          </button>
        </form>
      </section>
    );
  return (
    <section className="pagina pagina-scanner">
      <div className="testata-pagina">
        <p className="soprattitolo">Dal sacchetto al frigorifero</p>
        <h1>Aggiungi un prodotto</h1>
        <p>Inquadra il codice a barre. Lo cerchiamo nel tuo catalogo locale.</p>
      </div>
      <div className="scanner-griglia">
        <div>
          {scansione ? (
            <Fotocamera rilevato={cerca} />
          ) : (
            <div className="scanner scanner-spento">
              <ScanBarcode size={54} />
              <p>Pronto per il prossimo prodotto</p>
              <button
                className="pulsante chiaro"
                onClick={() => impostaScansione(true)}
              >
                <Camera size={18} />
                Apri fotocamera
              </button>
            </div>
          )}
        </div>
        <div className="manuale">
          <span className="icona-sezione">
            <ScanBarcode size={24} />
          </span>
          <h2>Hai il codice a portata di mano?</h2>
          <p>
            Inserisci le cifre sotto il codice a barre, inclusi gli eventuali
            zeri iniziali.
          </p>
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              void cerca(codice);
            }}
          >
            <label>
              Codice a barre
              <input
                name="codice"
                value={codice}
                onChange={(evento) => impostaCodice(evento.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ad esempio 8001234567890"
                maxLength={32}
                required
              />
            </label>
            <button className="pulsante primario largo" disabled={impegnato}>
              <Search size={18} />
              {impegnato ? "Ricerca nel catalogo…" : "Cerca prodotto"}
            </button>
          </form>
          <Errore testo={errore} />
          {assente && (
            <div className="prodotto-assente">
              <h3>Non trovi il tuo prodotto?</h3>
              <p>
                Puoi salvarne le informazioni. La prossima scansione lo
                riconoscerà.
              </p>
              <button
                className="pulsante secondario largo"
                disabled={impegnato}
                onClick={() => {
                  impostaPersonalizza(true);
                  impostaErrore("");
                }}
              >
                Inserisci manualmente
              </button>
            </div>
          )}
          <p className="nota nota-privata">
            Il catalogo e i tuoi dati restano a casa tua. Nessuna ricerca su
            Internet.
          </p>
        </div>
      </div>
    </section>
  );
}
