"""Analizza esclusivamente il sample e ricava fixture verificabili dal dataset reale."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

from costruisci_database_alimenti import RADICE, codice_gtin_valido, individua_origine, leggi_righe, normalizza_prodotto


def analizza_sample(origine: Path, destinazione_fixture: Path | None = None) -> dict:
    frequenze: Counter = Counter()
    tipi = defaultdict(Counter)
    candidati: dict[str, dict] = {}
    totale = 0
    for riga in leggi_righe(origine):
        if riga is None:
            continue
        try:
            prodotto = json.loads(riga)
        except (ValueError, UnicodeDecodeError):
            continue
        if not isinstance(prodotto, dict):
            continue
        totale += 1
        frequenze.update(prodotto.keys())
        for campo in ("code", "product_name", "brands", "nutriments", "ingredients", "ingredients_text", "allergens_tags", "labels_tags"):
            if campo in prodotto:
                tipi[campo][type(prodotto[campo]).__name__] += 1
        dati, _ = normalizza_prodotto(prodotto)
        if dati and codice_gtin_valido(dati["code"]) and dati.get("nutriments"):
            # Le fixture conservano i campi originali, non l'output normalizzato dell'importer.
            campi_fixture = ("code", "product_name", "product_name_it", "product_name_en", "brands", "quantity", "nutriments", "ingredients_text", "allergens_tags", "traces_tags", "labels_tags", "ingredients_analysis_tags")
            candidati[dati["code"]] = {campo: prodotto[campo] for campo in campi_fixture if campo in prodotto}
    def completezza(prodotto: dict) -> tuple[int, str]:
        punteggio = sum(bool(prodotto.get(campo)) for campo in ("brands", "ingredients_text", "allergens_tags"))
        return -punteggio, prodotto["code"]
    selezionati = sorted(candidati.values(), key=completezza)[:20]
    if len(selezionati) < 20:
        raise ValueError("Il sample non contiene almeno 20 prodotti con GTIN valido e nutrienti.")
    if destinazione_fixture:
        destinazione_fixture.parent.mkdir(parents=True, exist_ok=True)
        destinazione_fixture.write_text(json.dumps(selezionati, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "origine": origine.name, "dimensione_compressa": origine.stat().st_size,
        "prodotti": totale, "candidati_gtin_con_nutrienti": len(candidati),
        "fixture_selezionate": len(selezionati), "campi_piu_frequenti": frequenze.most_common(20),
        "tipi_campi_utili": dict(tipi),
        "barcode_fixture": [prodotto["code"] for prodotto in selezionati],
    }


if __name__ == "__main__":
    argomenti = argparse.ArgumentParser(description="Analizza il sample e genera 20 fixture con GTIN valido.")
    argomenti.add_argument("--origine", type=Path)
    argomenti.add_argument("--fixture", type=Path, default=RADICE / "tests" / "fixtures" / "prodotti_sample.json")
    opzioni = argomenti.parse_args()
    origine = opzioni.origine or individua_origine(RADICE / "data" / "raw")
    print(json.dumps(analizza_sample(origine, opzioni.fixture), ensure_ascii=False, indent=2))
