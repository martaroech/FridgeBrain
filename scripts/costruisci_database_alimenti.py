"""Costruisce il catalogo SQLite da Open Food Facts compresso, senza rete."""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import time
from collections.abc import Callable, Iterator
from typing import Any


RADICE = Path(__file__).resolve().parents[1]
CAMPI_TESTUALI = (
    "generic_name", "quantity", "serving_size", "categories", "countries",
    "ingredients_text", "allergens", "traces", "labels", "nutriscore_grade",
    "lang", "lc", "product_quantity_unit", "nutrition_data_per",
    "nutrition_data_prepared_per", "no_nutrition_data",
)
CAMPI_ELENCO = (
    "categories_tags", "countries_tags", "allergens_tags", "traces_tags",
    "labels_tags", "ingredients_analysis_tags", "ingredients_tags",
    "nutrient_levels_tags", "data_quality_errors_tags", "data_quality_warnings_tags",
)
CAMPI_NUMERICI = ("nova_group", "last_modified_t", "product_quantity", "serving_quantity")
DIMENSIONE_BLOCCO = 1000
LIMITE_RIGA = 32 * 1024 * 1024


def individua_origine(cartella: Path, completo: bool = False) -> Path:
    """Identifica i dump dalla dimensione, senza leggerne preventivamente il contenuto."""
    candidati = sorted(cartella.glob("*.jsonl.gz"), key=lambda percorso: percorso.stat().st_size)
    if not candidati:
        raise ValueError(f"Nessun file .jsonl.gz trovato in {cartella}.")
    if completo and len(candidati) < 2:
        raise ValueError("Non è possibile distinguere sample e dump completo: usare --origine.")
    return candidati[-1] if completo else candidati[0]


def codice_gtin_valido(codice: str) -> bool:
    """Controlla lunghezza e cifra di controllo GTIN, preservando gli zeri iniziali."""
    if len(codice) not in (8, 12, 13, 14) or not codice.isascii() or not codice.isdigit():
        return False
    somma = sum(int(cifra) * (3 if indice % 2 == 0 else 1)
                for indice, cifra in enumerate(reversed(codice[:-1])))
    return (10 - somma % 10) % 10 == int(codice[-1])


def rifiuta_costante(valore: str) -> None:
    raise ValueError(f"Costante JSON non valida: {valore}.")


def leggi_righe(origine: Path) -> Iterator[bytes | None]:
    """Limita anche la memoria occupata da un'eventuale riga patologicamente grande."""
    with gzip.open(origine, "rb") as flusso:
        while riga := flusso.readline(LIMITE_RIGA + 1):
            if len(riga) > LIMITE_RIGA:
                while riga and not riga.endswith(b"\n"):
                    riga = flusso.readline(LIMITE_RIGA + 1)
                yield None
            else:
                yield riga


def normalizza_prodotto(prodotto: Any) -> tuple[dict[str, Any] | None, str | None]:
    """Conserva i campi OFF utili e le informazioni mancanti senza inventare valori."""
    if not isinstance(prodotto, dict):
        return None, "malformati"
    codice = prodotto.get("code")
    if not isinstance(codice, str) or not codice.strip():
        return None, "senza_barcode"
    codice = codice.strip()
    if not codice.isascii() or not codice.isdigit() or not 4 <= len(codice) <= 32:
        return None, "barcode_inconsistenti"
    nome = prodotto.get("product_name")
    if not isinstance(nome, str) or not nome.strip():
        nome = prodotto.get("product_name_it") or prodotto.get("product_name_en")
    if not isinstance(nome, str) or not nome.strip():
        return None, "senza_nome"
    dati: dict[str, Any] = {"code": codice, "product_name": nome.strip()}
    marca = prodotto.get("brands")
    if isinstance(marca, str):
        dati["brands"] = marca.strip()
    for campo in CAMPI_TESTUALI:
        valore = prodotto.get(campo)
        if isinstance(valore, str):
            dati[campo] = valore
    for campo in CAMPI_ELENCO:
        valore = prodotto.get(campo)
        if isinstance(valore, list) and all(isinstance(elemento, str) for elemento in valore):
            dati[campo] = valore
    for campo in CAMPI_NUMERICI:
        valore = prodotto.get(campo)
        if isinstance(valore, (float, int)) and not isinstance(valore, bool) and math.isfinite(valore):
            dati[campo] = valore
    # Anche le unità originali e gli eventuali campi prepared rimangono disponibili.
    # Il motore nutrizionale decide quali valori siano utilizzabili nei calcoli.
    if isinstance(prodotto.get("nutriments"), dict):
        dati["nutriments"] = prodotto["nutriments"]
    if isinstance(prodotto.get("ingredients"), list):
        dati["ingredients"] = prodotto["ingredients"]
    for campo in ("product_name_it", "ingredients_text_it"):
        if isinstance(prodotto.get(campo), str):
            dati[campo] = prodotto[campo]
    return dati, None


def costruisci_database(
    origine: Path,
    destinazione: Path,
    avanzamento: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Importa a blocchi e sostituisce il catalogo solo dopo una verifica completa."""
    origine = origine.resolve()
    destinazione = destinazione.resolve()
    if origine == destinazione or destinazione.suffix.lower() != ".db":
        raise ValueError("La destinazione deve essere un file .db diverso dal dataset originale.")
    if destinazione.name.lower() == "fridgebrain.db":
        raise ValueError("Il catalogo non può sostituire il database personale fridgebrain.db.")
    cartella_originali = (RADICE / "data" / "raw").resolve()
    if destinazione.is_relative_to(cartella_originali):
        raise ValueError("Non è consentito scrivere il catalogo nella cartella degli originali data/raw.")
    if not origine.is_file():
        raise ValueError(f"Dataset non trovato: {origine}.")
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    descrittore, nome_temporaneo = tempfile.mkstemp(prefix=f".{destinazione.name}.", suffix=".tmp", dir=destinazione.parent)
    os.close(descrittore)
    temporaneo = Path(nome_temporaneo)
    statistiche: dict[str, Any] = {
        "origine": origine.name, "dimensione_origine": origine.stat().st_size,
        "analizzati": 0, "importati": 0, "ignorati": 0, "malformati": 0,
        "senza_barcode": 0, "barcode_inconsistenti": 0, "senza_nome": 0,
        "duplicati": 0, "con_nutrienti": 0, "con_ingredienti": 0, "con_allergeni": 0,
    }
    inizio = time.perf_counter()
    connessione: sqlite3.Connection | None = None
    try:
        connessione = sqlite3.connect(temporaneo)
        connessione.executescript("""
            PRAGMA journal_mode=OFF;
            PRAGMA synchronous=OFF;
            PRAGMA temp_store=FILE;
            PRAGMA cache_size=-32768;
            CREATE TABLE prodotti (
                code TEXT PRIMARY KEY,
                product_name TEXT NOT NULL,
                brands TEXT,
                dati TEXT NOT NULL CHECK(json_valid(dati))
            );
            CREATE TABLE metadati (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL);
        """)
        blocco: list[tuple[str, str, str | None, str]] = []
        validi = 0
        interrogazione = """INSERT INTO prodotti(code,product_name,brands,dati) VALUES (?,?,?,?)
            ON CONFLICT(code) DO UPDATE SET product_name=excluded.product_name,
            brands=excluded.brands,dati=excluded.dati"""
        for riga in leggi_righe(origine):
            statistiche["analizzati"] += 1
            try:
                if riga is None:
                    raise ValueError("Riga superiore al limite di sicurezza.")
                prodotto = json.loads(riga, parse_constant=rifiuta_costante)
                dati, motivo = normalizza_prodotto(prodotto)
                if dati is None:
                    statistiche[motivo] += 1
                    statistiche["ignorati"] += 1
                    continue
                serializzato = json.dumps(dati, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
            except (ValueError, UnicodeDecodeError, TypeError, RecursionError, OverflowError):
                statistiche["malformati"] += 1
                statistiche["ignorati"] += 1
                continue
            blocco.append((dati["code"], dati["product_name"], dati.get("brands"), serializzato))
            validi += 1
            if len(blocco) >= DIMENSIONE_BLOCCO:
                connessione.executemany(interrogazione, blocco)
                connessione.commit()
                blocco.clear()
            if avanzamento and statistiche["analizzati"] % 50000 == 0:
                trascorsi = time.perf_counter() - inizio
                avanzamento(f"Analizzati {statistiche['analizzati']:,} prodotti in {trascorsi:.1f} s; ignorati {statistiche['ignorati']:,}.")
        if blocco:
            connessione.executemany(interrogazione, blocco)
            connessione.commit()
        statistiche["importati"] = connessione.execute("SELECT COUNT(*) FROM prodotti").fetchone()[0]
        statistiche["duplicati"] = validi - statistiche["importati"]
        if not statistiche["importati"]:
            raise ValueError("Nessun prodotto utilizzabile: il catalogo precedente è stato conservato.")
        for riga in connessione.execute("SELECT dati FROM prodotti"):
            dati = json.loads(riga[0])
            statistiche["con_nutrienti"] += bool(dati.get("nutriments"))
            statistiche["con_ingredienti"] += bool(dati.get("ingredients_text") or dati.get("ingredients"))
            statistiche["con_allergeni"] += bool(dati.get("allergens_tags") or dati.get("allergens"))
        if avanzamento:
            avanzamento("Creazione degli indici di ricerca e verifica del database…")
        connessione.executescript("""
            CREATE VIRTUAL TABLE ricerca_prodotti USING fts5(
                product_name, brands, content='prodotti', content_rowid='rowid',
                tokenize='unicode61 remove_diacritics 2'
            );
            INSERT INTO ricerca_prodotti(ricerca_prodotti) VALUES('rebuild');
            ANALYZE;
        """)
        esito = connessione.execute("PRAGMA integrity_check").fetchone()[0]
        if esito != "ok":
            raise ValueError("Il catalogo generato non supera il controllo di integrità.")
        statistiche["durata_secondi"] = round(time.perf_counter() - inizio, 3)
        statistiche["prodotti_al_secondo"] = round(statistiche["analizzati"] / max(statistiche["durata_secondi"], 0.001), 1)
        connessione.executemany("INSERT INTO metadati(chiave,valore) VALUES (?,?)", [
            ("versione_schema", "1"), ("fonte", "Open Food Facts"),
            ("licenza", "Open Database License (ODbL)"),
            ("statistiche", json.dumps(statistiche, ensure_ascii=False)),
            ("data_importazione", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        ])
        connessione.commit()
        connessione.execute("PRAGMA journal_mode=DELETE")
        connessione.close()
        connessione = None
        with temporaneo.open("r+b") as flusso:
            os.fsync(flusso.fileno())
        statistiche["dimensione_database"] = temporaneo.stat().st_size
        os.replace(temporaneo, destinazione)
        return statistiche
    finally:
        if connessione is not None:
            connessione.close()
        temporaneo.unlink(missing_ok=True)


def principale() -> int:
    argomenti = argparse.ArgumentParser(description="Genera foods.db da Open Food Facts in streaming, senza decomprimere il dump su disco.")
    scelta = argomenti.add_mutually_exclusive_group()
    scelta.add_argument("--campione", action="store_true", help="Utilizza il .jsonl.gz più piccolo (predefinito).")
    scelta.add_argument("--completo", action="store_true", help="Utilizza il .jsonl.gz più grande, dopo la verifica del sample.")
    scelta.add_argument("--origine", type=Path, help="Percorso esplicito del dataset compresso.")
    argomenti.add_argument("--cartella-dati", type=Path, default=RADICE / "data" / "raw", help="Cartella che contiene i file originali.")
    argomenti.add_argument("--destinazione", type=Path, default=RADICE / "data" / "processed" / "foods.db", help="Catalogo SQLite di destinazione.")
    opzioni = argomenti.parse_args()
    try:
        origine = opzioni.origine or individua_origine(opzioni.cartella_dati, opzioni.completo)
        print(f"Importazione di {origine} ({origine.stat().st_size:,} byte compressi).", flush=True)
        statistiche = costruisci_database(origine, opzioni.destinazione, lambda messaggio: print(messaggio, flush=True))
        print(json.dumps(statistiche, ensure_ascii=False, indent=2))
        print(f"Catalogo pronto: {opzioni.destinazione.resolve()}", flush=True)
        return 0
    except (OSError, ValueError, sqlite3.Error, EOFError) as errore:
        print(f"Importazione non riuscita: {errore}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(principale())
