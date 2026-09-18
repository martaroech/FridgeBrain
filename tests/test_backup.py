"""Verifica il backup dei dati personali senza usare l'inventario reale."""

from contextlib import closing
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from backup_dati import esegui_backup


class VerificheBackup(unittest.TestCase):
    def setUp(self):
        self.temporanei = tempfile.TemporaryDirectory(prefix="fridgebrain-backup-")
        self.cartella = Path(self.temporanei.name)
        self.origine = self.cartella / "fridgebrain.db"
        self.destinazione = self.cartella / "copie" / "fridgebrain-salvato.db"

    def tearDown(self):
        self.temporanei.cleanup()

    def test_copia_consistente_include_dati_wal_con_archivio_aperto(self):
        with closing(sqlite3.connect(self.origine)) as connessione:
            connessione.execute("PRAGMA journal_mode=WAL")
            connessione.execute("PRAGMA wal_autocheckpoint=0")
            connessione.execute("CREATE TABLE inventario(nome TEXT, quantita REAL)")
            connessione.execute("INSERT INTO inventario VALUES ('Ceci', 250)")
            connessione.commit()
            self.assertTrue(Path(str(self.origine) + "-wal").exists())
            self.assertEqual(esegui_backup(self.origine, self.destinazione), self.destinazione.resolve())
            with closing(sqlite3.connect(self.destinazione)) as copia:
                self.assertEqual(copia.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(copia.execute("SELECT * FROM inventario").fetchall(), [("Ceci", 250)])
            connessione.execute("UPDATE inventario SET quantita=100")
            connessione.commit()
            with closing(sqlite3.connect(self.destinazione)) as copia:
                self.assertEqual(copia.execute("SELECT quantita FROM inventario").fetchone()[0], 250)

    def test_rifiuta_di_sovrascrivere_backup_esistente(self):
        with closing(sqlite3.connect(self.origine)) as connessione:
            connessione.execute("CREATE TABLE inventario(nome TEXT)")
        self.destinazione.parent.mkdir()
        self.destinazione.write_bytes(b"copia da preservare")
        with self.assertRaisesRegex(ValueError, "esiste già"):
            esegui_backup(self.origine, self.destinazione)
        self.assertEqual(self.destinazione.read_bytes(), b"copia da preservare")

    def test_origine_inesistente_non_crea_un_backup_vuoto(self):
        with self.assertRaisesRegex(ValueError, "non esiste"):
            esegui_backup(self.origine, self.destinazione)
        self.assertFalse(self.destinazione.exists())
        self.assertFalse(self.origine.exists())

    def test_archivio_corrotto_non_lascia_una_copia_parziale(self):
        self.origine.write_bytes(b"questo non e un database SQLite")
        with self.assertRaises(sqlite3.DatabaseError):
            esegui_backup(self.origine, self.destinazione)
        self.assertFalse(self.destinazione.exists())
        self.assertEqual(self.origine.read_bytes(), b"questo non e un database SQLite")


if __name__ == "__main__":
    unittest.main(verbosity=2)
