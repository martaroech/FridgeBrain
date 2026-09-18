"""Verifiche del catalogo su gzip sintetici e sui prodotti reali del sample."""

from __future__ import annotations

import gzip
from contextlib import closing as chiusura
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import time
import unittest

RADICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RADICE / "scripts"))
from costruisci_database_alimenti import codice_gtin_valido, costruisci_database, individua_origine


class VerificheImportazione(unittest.TestCase):
    def setUp(self):
        self.cartella_temporanea = tempfile.TemporaryDirectory()
        self.cartella = Path(self.cartella_temporanea.name)
        self.origine = self.cartella / "campione.jsonl.gz"
        self.destinazione = self.cartella / "foods.db"

    def tearDown(self):
        self.cartella_temporanea.cleanup()

    def scrivi_origine(self, prodotti):
        with gzip.open(self.origine, "wt", encoding="utf-8") as flusso:
            for prodotto in prodotti:
                flusso.write(json.dumps(prodotto, ensure_ascii=False) + "\n" if not isinstance(prodotto, str) else prodotto + "\n")

    def leggi_prodotto(self, codice):
        with chiusura(sqlite3.connect(self.destinazione)) as connessione:
            risultato = connessione.execute("SELECT dati FROM prodotti WHERE code=?", (codice,)).fetchone()
        return json.loads(risultato[0]) if risultato else None

    def test_importa_gzip_e_conserva_zero_iniziale(self):
        self.scrivi_origine([{"code": "0000000000123", "product_name": "Latte intero", "brands": "Fattoria"}])
        statistiche = costruisci_database(self.origine, self.destinazione)
        self.assertEqual(statistiche["importati"], 1)
        self.assertEqual(self.leggi_prodotto("0000000000123")["product_name"], "Latte intero")
        self.assertIsNone(self.leggi_prodotto("123"))
        self.assertTrue(self.origine.exists())
        self.assertEqual(list(self.cartella.glob("*.jsonl")), [])

    def test_ignora_record_malformati_e_continua(self):
        self.scrivi_origine(["{rotto", [1, 2], "null", '{"code":"1234","product_name":"Mela","nutriments":{"fat_100g":NaN}}', {"code": "12345678", "product_name": "Pera"}])
        statistiche = costruisci_database(self.origine, self.destinazione)
        self.assertEqual(statistiche["analizzati"], 5)
        self.assertEqual(statistiche["malformati"], 4)
        self.assertEqual(statistiche["importati"], 1)

    def test_record_con_campi_mancanti_e_nutrienti_sconosciuti(self):
        self.scrivi_origine([{"product_name": "Senza codice"}, {"code": "12345678"}, {"code": "12345679", "product_name": "Olio", "nutriments": {"fat_100g": 100}}])
        statistiche = costruisci_database(self.origine, self.destinazione)
        self.assertEqual(statistiche["senza_barcode"], 1)
        self.assertEqual(statistiche["senza_nome"], 1)
        dati = self.leggi_prodotto("12345679")
        self.assertNotIn("sugars_100g", dati["nutriments"])
        self.assertNotIn("allergens_tags", dati)
        self.assertNotIn("ingredients_text", dati)

    def test_non_scambia_allergeni_assenti_e_lista_vuota(self):
        self.scrivi_origine([{"code": "12345678", "product_name": "Mela", "allergens_tags": []}, {"code": "12345679", "product_name": "Pera"}])
        costruisci_database(self.origine, self.destinazione)
        self.assertEqual(self.leggi_prodotto("12345678")["allergens_tags"], [])
        self.assertNotIn("allergens_tags", self.leggi_prodotto("12345679"))

    def test_conserva_base_nutrizionale_liquidi_e_analisi_ingredienti(self):
        prodotto = {
            "code": "12345678", "product_name": "Bevanda di soia", "quantity": "1 l",
            "product_quantity": 1000, "product_quantity_unit": "ml", "nutrition_data_per": "100ml",
            "nutrition_data_prepared_per": "serving", "serving_quantity": 200, "serving_size": "200 ml",
            "nutriments": {"proteins_100g": 3.2, "proteins_unit": "g", "energy-kcal_100g": 41},
            "ingredients_analysis_tags": ["en:vegan", "en:vegetarian"],
            "ingredients": [{"id": "en:soybean", "text": "soia", "vegan": "yes"}],
        }
        self.scrivi_origine([prodotto])
        costruisci_database(self.origine, self.destinazione)
        self.assertEqual(self.leggi_prodotto("12345678"), prodotto)

    def test_codifica_utf8_invalida_non_interrompe_righe_successive(self):
        with gzip.open(self.origine, "wb") as flusso:
            flusso.write(b'{"code":"12345678","product_name":"\xff"}\n')
            flusso.write(b'{"code":"12345679","product_name":"Mela"}\n')
        statistiche = costruisci_database(self.origine, self.destinazione)
        self.assertEqual(statistiche["malformati"], 1)
        self.assertEqual(self.leggi_prodotto("12345679")["product_name"], "Mela")

    def test_campi_inconsistenti_non_diventano_dati_attendibili(self):
        self.scrivi_origine([
            {"code": "ABC1234", "product_name": "Codice illeggibile"},
            {"code": 12345678, "product_name": "Codice numerico"},
            {"code": "12345678", "product_name": "Mela", "nutriments": [], "allergens_tags": "en:milk", "ingredients": "Mela", "nova_group": True},
        ])
        statistiche = costruisci_database(self.origine, self.destinazione)
        self.assertEqual(statistiche["barcode_inconsistenti"], 1)
        self.assertEqual(statistiche["senza_barcode"], 1)
        dati = self.leggi_prodotto("12345678")
        for campo in ("nutriments", "allergens_tags", "ingredients", "nova_group"):
            self.assertNotIn(campo, dati)

    def test_duplicato_usa_ultima_occorrenza_e_statistiche_finali(self):
        self.scrivi_origine([
            {"code": "12345678", "product_name": "Nome precedente", "allergens_tags": ["en:milk"]},
            {"code": "12345678", "product_name": "Nome corretto", "nutriments": {"proteins_100g": 4.2}},
        ])
        statistiche = costruisci_database(self.origine, self.destinazione)
        self.assertEqual(statistiche["duplicati"], 1)
        self.assertEqual(statistiche["importati"], 1)
        self.assertEqual(statistiche["con_allergeni"], 0)
        self.assertEqual(statistiche["con_nutrienti"], 1)
        self.assertEqual(self.leggi_prodotto("12345678")["product_name"], "Nome corretto")

    def test_gzip_corrotto_preserva_catalogo_precedente(self):
        self.scrivi_origine([{"code": "12345678", "product_name": "Originale"}])
        costruisci_database(self.origine, self.destinazione)
        originale = self.destinazione.read_bytes()
        self.origine.write_bytes(self.origine.read_bytes()[:-8])
        with self.assertRaises((EOFError, OSError)):
            costruisci_database(self.origine, self.destinazione)
        self.assertEqual(self.destinazione.read_bytes(), originale)
        self.assertEqual(list(self.cartella.glob("*.tmp")), [])

    def test_importazione_senza_prodotti_preserva_catalogo(self):
        self.scrivi_origine([{"code": "12345678", "product_name": "Originale"}])
        costruisci_database(self.origine, self.destinazione)
        originale = self.destinazione.read_bytes()
        self.scrivi_origine([{"code": "12345678"}])
        with self.assertRaisesRegex(ValueError, "Nessun prodotto"):
            costruisci_database(self.origine, self.destinazione)
        self.assertEqual(self.destinazione.read_bytes(), originale)

    def test_non_puo_sostituire_database_personale(self):
        self.scrivi_origine([{"code": "12345678", "product_name": "Mela"}])
        personale = self.cartella / "fridgebrain.db"
        personale.write_bytes(b"dati personali")
        with self.assertRaisesRegex(ValueError, "personale"):
            costruisci_database(self.origine, personale)
        self.assertEqual(personale.read_bytes(), b"dati personali")

    def test_ricerca_indicizzata_barcode_e_testo_unicode(self):
        self.scrivi_origine([{"code": "12345678", "product_name": "Purè di patate", "brands": "La Fattoria"}])
        costruisci_database(self.origine, self.destinazione)
        with chiusura(sqlite3.connect(self.destinazione)) as connessione:
            piano = connessione.execute("EXPLAIN QUERY PLAN SELECT dati FROM prodotti WHERE code=?", ("12345678",)).fetchone()[3]
            self.assertIn("INDEX", piano)
            risultato = connessione.execute("SELECT p.code FROM ricerca_prodotti r JOIN prodotti p ON p.rowid=r.rowid WHERE ricerca_prodotti MATCH ?", ("pure",)).fetchone()
            self.assertEqual(risultato[0], "12345678")
            self.assertEqual(connessione.execute("PRAGMA integrity_check").fetchone()[0], "ok")

    def test_identificazione_sample_e_completo_dalla_dimensione(self):
        piccolo = self.cartella / "nome_non_prevedibile.jsonl.gz"
        grande = self.cartella / "altro_nome.jsonl.gz"
        piccolo.write_bytes(b"a")
        grande.write_bytes(b"aa")
        self.assertEqual(individua_origine(self.cartella), piccolo)
        self.assertEqual(individua_origine(self.cartella, completo=True), grande)

    def test_gtin_verifica_cifra_di_controllo(self):
        self.assertTrue(codice_gtin_valido("3017620422003"))
        self.assertFalse(codice_gtin_valido("3017620422004"))
        self.assertFalse(codice_gtin_valido("1234"))
        self.assertFalse(codice_gtin_valido("３０１７６２０４２２００３"))

    def test_venti_fixture_reali_preservano_identita_nutrienti_ingredienti_allergeni(self):
        prodotti = json.loads((RADICE / "tests" / "fixtures" / "prodotti_sample.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(prodotti), 20)
        self.scrivi_origine(prodotti)
        statistiche = costruisci_database(self.origine, self.destinazione)
        self.assertEqual(statistiche["importati"], len(prodotti))
        for prodotto in prodotti:
            with self.subTest(barcode=prodotto["code"]):
                self.assertTrue(codice_gtin_valido(prodotto["code"]))
                risultato = self.leggi_prodotto(prodotto["code"])
                for campo in ("code", "product_name", "brands", "nutriments", "ingredients_text", "allergens_tags", "traces_tags", "ingredients_analysis_tags"):
                    if campo in prodotto:
                        self.assertEqual(risultato.get(campo), prodotto[campo])

    def test_sample_originale_lookup_reali_e_prestazioni(self):
        originali = RADICE / "data" / "raw"
        if not list(originali.glob("*.jsonl.gz")):
            self.skipTest("Sample non installato: le fixture compresse coprono comunque l'importer.")
        sample = individua_origine(originali)
        if sample.stat().st_size > 100 * 1024 * 1024:
            self.skipTest("Nessun sample ridotto: non elaborare automaticamente il dump completo nei test.")
        fixture = json.loads((RADICE / "tests" / "fixtures" / "prodotti_sample.json").read_text(encoding="utf-8"))
        costruisci_database(sample, self.destinazione)
        with chiusura(sqlite3.connect(self.destinazione)) as connessione:
            inizio = time.perf_counter()
            for indice in range(2000):
                prodotto = fixture[indice % len(fixture)]
                risultato = connessione.execute("SELECT product_name,dati FROM prodotti WHERE code=?", (prodotto["code"],)).fetchone()
                self.assertEqual(risultato[0], prodotto["product_name"])
                self.assertEqual(json.loads(risultato[1])["nutriments"], prodotto["nutriments"])
            durata = time.perf_counter() - inizio
        print(f"\nPrestazioni: 2.000 lookup reali in {durata:.3f} s ({durata / 2:.3f} ms per lookup, inclusi parsing e verifiche).")
        self.assertLess(durata, 10, "I lookup indicizzati devono essere quasi immediati.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
