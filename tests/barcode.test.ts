import test from "node:test";
import assert from "node:assert/strict";
import { preparaArchivio, prodottiSample } from "./supporto-archivio";

test("lo scanner UPC-A ritrova il prodotto EAN-13 del sample senza alterare codice e nutrienti", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const originale = prodottiSample.find(
    (prodotto) => prodotto.code === "0013800810168",
  )!;
  assert.ok(originale);
  for (const codice of ["013800810168", "0013800810168", "00013800810168"]) {
    const trovato = archivio.prodotto(codice);
    assert.deepEqual(trovato, originale);
  }
  const voce = archivio.aggiungiInventario({
    codice: "013800810168",
    quantita: 200,
  });
  assert.equal(voce.prodotto.code, originale.code);
});

test("gli alias GTIN dei prodotti personalizzati funzionano anche senza catalogo", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  const originale = archivio.salvaProdotto({
    code: "12345670",
    product_name: "Prodotto corto di prova",
  });
  for (const codice of ["000012345670", "0000012345670", "00000012345670"])
    assert.deepEqual(archivio.prodotto(codice), originale);
});

test("un codice esatto del catalogo precede un alias personalizzato", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const originale = prodottiSample.find(
    (prodotto) => prodotto.code === "0013800810168",
  )!;
  archivio.salvaProdotto({
    code: "013800810168",
    product_name: "Etichetta personale equivalente",
  });
  assert.deepEqual(archivio.prodotto(originale.code), originale);
  assert.equal(
    archivio.prodotto("013800810168").product_name,
    "Etichetta personale equivalente",
  );
});

test("un prodotto personalizzato esatto conserva la precedenza sul catalogo", (contesto) => {
  const { archivio } = preparaArchivio(contesto);
  const personale = archivio.salvaProdotto({
    code: "0013800810168",
    product_name: "Etichetta personale esatta",
  });
  assert.deepEqual(archivio.prodotto(personale.code), personale);
  assert.deepEqual(archivio.prodotto("013800810168"), personale);
});

test("i codici con controllo errato o lunghezza non GTIN rimangono esclusivamente esatti", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  for (const [codice, alias] of [
    ["0013800810169", "013800810169"],
    ["00001234", "1234"],
    ["000012345", "12345"],
  ]) {
    const originale = archivio.salvaProdotto({
      code: codice,
      product_name: "Codice interno di prova",
    });
    assert.deepEqual(archivio.prodotto(codice), originale);
    assert.throws(() => archivio.prodotto(alias), /catalogo/);
  }
});

test("il GTIN-14 con indicatore di imballaggio non zero non coincide col prodotto singolo", (contesto) => {
  const { archivio } = preparaArchivio(contesto, false);
  archivio.salvaProdotto({
    code: "0013800810168",
    product_name: "Prodotto singolo",
  });
  const imballaggio = archivio.salvaProdotto({
    code: "10013800810165",
    product_name: "Imballaggio multiplo",
  });
  assert.deepEqual(archivio.prodotto(imballaggio.code), imballaggio);
  assert.equal(
    archivio.prodotto("013800810168").product_name,
    "Prodotto singolo",
  );
});
