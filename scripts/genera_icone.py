"""Genera le icone PWA locali con sola libreria standard Python."""
from pathlib import Path
import struct
import zlib
import math

def genera_icona(dimensione, destinazione):
    verde = (32, 77, 55)
    avorio = (247, 248, 242)
    salvia = (184, 207, 152)
    righe = bytearray()
    for y in range(dimensione):
        righe.append(0)
        for x in range(dimensione):
            ascissa, ordinata = x * 512 / dimensione, y * 512 / dimensione
            colore = verde
            if (145 <= ascissa <= 175 and 157 <= ordinata <= 356) or (145 <= ascissa <= 292 and 157 <= ordinata <= 187) or (145 <= ascissa <= 264 and 240 <= ordinata <= 271):
                colore = avorio
            # Foglia ellittica inclinata, segno discreto dell'identità healthy-tech.
            centro_x, centro_y = ascissa - 310, ordinata - 210
            lungo = (centro_x - centro_y) / math.sqrt(2)
            largo = (centro_x + centro_y) / math.sqrt(2)
            if (lungo / 92) ** 2 + (largo / 38) ** 2 <= 1:
                colore = salvia
                if abs(largo) < 4 and -77 < lungo < 65:
                    colore = verde
            righe.extend(colore)
    def blocco(nome, contenuto):
        return struct.pack(">I", len(contenuto)) + nome + contenuto + struct.pack(">I", zlib.crc32(nome + contenuto))
    contenuto = b"\x89PNG\r\n\x1a\n" + blocco(b"IHDR", struct.pack(">IIBBBBB", dimensione, dimensione, 8, 2, 0, 0, 0)) + blocco(b"IDAT", zlib.compress(bytes(righe), 9)) + blocco(b"IEND", b"")
    destinazione.write_bytes(contenuto)

if __name__ == "__main__":
    cartella = Path(__file__).resolve().parents[1] / "public" / "icone"
    cartella.mkdir(parents=True, exist_ok=True)
    for dimensione in (192, 512):
        genera_icona(dimensione, cartella / f"icona-{dimensione}.png")
    genera_icona(512, cartella / "icona-maskable.png")
    genera_icona(180, cartella / "apple-touch-icon.png")
    print("Icone PWA generate localmente.")
