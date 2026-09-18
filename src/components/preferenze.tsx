"use client";

import type { Preferenze } from "@/lib/tipi";
import { allergeni, nutrienti } from "./comuni";

export function CampiPreferenze({ preferenze }: { preferenze: Preferenze }) {
  return (
    <div className="campi-preferenze">
      <label>
        Stile alimentare
        <select name="regime" defaultValue={preferenze.regime}>
          <option value="onnivoro">Onnivoro</option>
          <option value="vegetariano">Vegetariano</option>
          <option value="vegano">Vegano</option>
        </select>
      </label>
      <label className="scelta scelta-evidente">
        <input
          type="checkbox"
          name="priorita_scadenza"
          defaultChecked={preferenze.priorita_scadenza}
        />
        Usa prima i prodotti in scadenza
      </label>
      <details className="dettagli">
        <summary>Allergeni e ingredienti da evitare</summary>
        <div className="contenuto-dettagli">
          <fieldset>
            <legend>Allergeni da escludere</legend>
            <div className="scelte-allergeni">
              {allergeni.map(([chiave, nome]) => (
                <label className="scelta" key={chiave}>
                  <input
                    type="checkbox"
                    name="allergeni"
                    value={chiave}
                    defaultChecked={preferenze.allergeni.includes(chiave)}
                  />
                  {nome}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="nota">
            Con una restrizione attiva, un prodotto con informazioni
            insufficienti viene escluso. L’assenza di un allergene nel catalogo
            non certifica che il prodotto ne sia privo. Verifica sempre
            l’etichetta.
          </p>
          <label>
            Altri ingredienti da escludere
            <input
              name="esclusioni"
              defaultValue={preferenze.esclusioni.join(", ")}
              placeholder="Ad esempio funghi, peperoni"
              maxLength={1000}
            />
          </label>
          <p className="nota">Separa gli ingredienti con una virgola.</p>
        </div>
      </details>
      <details className="dettagli">
        <summary>Limiti nutrizionali per porzione</summary>
        <div className="contenuto-dettagli">
          <p className="nota">
            Indica solo i limiti che desideri verificare. Se un dato necessario
            è sconosciuto, la ricetta non può soddisfare il vincolo.
          </p>
          <div className="limiti-intestazione">
            <span>Nutriente</span>
            <span>Minimo</span>
            <span>Massimo</span>
          </div>
          {nutrienti.map(({ chiave, nome, unita }) => {
            const limite = preferenze.limiti.find(
              (elemento) => elemento.nutriente === chiave,
            );
            return (
              <div className="riga-limite" key={chiave}>
                <span>
                  {nome}
                  <small>{unita}</small>
                </span>
                <input
                  name={`${chiave}_minimo`}
                  aria-label={`${nome}: minimo per porzione`}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="—"
                  defaultValue={limite?.minimo ?? ""}
                />
                <input
                  name={`${chiave}_massimo`}
                  aria-label={`${nome}: massimo per porzione`}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="—"
                  defaultValue={limite?.massimo ?? ""}
                />
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
export function leggiPreferenze(dati: FormData): Preferenze {
  return {
    regime: dati.get("regime") as Preferenze["regime"],
    priorita_scadenza: dati.has("priorita_scadenza"),
    allergeni: dati.getAll("allergeni").map(String),
    esclusioni: String(dati.get("esclusioni") || "")
      .split(",")
      .map((voce) => voce.trim())
      .filter(Boolean),
    limiti: nutrienti.flatMap(({ chiave }) => {
      const minimo = dati.get(`${chiave}_minimo`);
      const massimo = dati.get(`${chiave}_massimo`);
      return minimo || massimo
        ? [
            {
              nutriente: chiave,
              ...(minimo ? { minimo: Number(minimo) } : {}),
              ...(massimo ? { massimo: Number(massimo) } : {}),
            },
          ]
        : [];
    }),
  };
}
