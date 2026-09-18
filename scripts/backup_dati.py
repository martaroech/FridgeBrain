"""Copia consistente del database personale, anche mentre l'app è in esecuzione."""
import argparse
from pathlib import Path
import sqlite3
from contextlib import closing

def esegui_backup(origine, destinazione):
    origine = Path(origine).resolve()
    destinazione = Path(destinazione).resolve()
    if not origine.is_file():
        raise ValueError("Il database personale da salvare non esiste.")
    if destinazione.exists():
        raise ValueError("La destinazione esiste già: scegli un nuovo nome per conservare il backup precedente.")
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    try:
        with closing(sqlite3.connect(origine.as_uri() + "?mode=ro", uri=True)) as sorgente:
            with closing(sqlite3.connect(destinazione)) as copia:
                sorgente.backup(copia)
                if copia.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("La verifica di integrità del backup non è riuscita.")
    except Exception:
        # Il file è stato creato da questa esecuzione; un backup incompleto non deve apparire valido.
        destinazione.unlink(missing_ok=True)
        raise
    return destinazione

if __name__ == "__main__":
    argomenti = argparse.ArgumentParser(description="Backup consistente dei dati personali FridgeBrain.")
    argomenti.add_argument("--origine", default="data/fridgebrain.db")
    argomenti.add_argument("--destinazione", required=True)
    opzioni = argomenti.parse_args()
    try:
        risultato = esegui_backup(opzioni.origine, opzioni.destinazione)
        print(f"Backup verificato: {risultato}")
    except (ValueError, OSError, sqlite3.Error) as errore:
        argomenti.exit(1, f"Backup non riuscito: {errore}\n")
