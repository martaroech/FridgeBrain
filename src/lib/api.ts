import { archivioApplicazione, ArchivioFridgeBrain, ErroreApplicazione } from "./servizi";

function identifica(valore: string | undefined): number {
  if (!valore || !/^[1-9]\d*$/.test(valore) || !Number.isSafeInteger(Number(valore))) throw new ErroreApplicazione("Identificatore non valido.");
  return Number(valore);
}

/** Contratto locale compatibile con le schermate esistenti. Non effettua richieste HTTP. */
export async function eseguiOperazione(percorso: string, metodo = "GET", corpo: unknown = {}, chiave?: string, archivio: ArchivioFridgeBrain = archivioApplicazione()): Promise<unknown> {
  const indirizzo = new URL(percorso, "https://fridgebrain.invalid");
  const segmenti = indirizzo.pathname.replace(/^\/api\//, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [risorsa, identificatore, azione] = segmenti;
  if (segmenti.length > 3) throw new ErroreApplicazione("Indirizzo non trovato.",404);
  if (risorsa === "stato" && !identificatore && metodo === "GET") return archivio.stato();
  if (risorsa === "prodotti" && !azione) {
    if (metodo === "GET" && !identificatore) return indirizzo.searchParams.has("codice") ? archivio.recuperaProdotto(indirizzo.searchParams.get("codice")) : archivio.cercaProdotti(indirizzo.searchParams.get("q") ?? "");
    if (metodo === "POST" && !identificatore) return archivio.salvaProdotto(corpo, undefined, chiave);
    if (metodo === "PATCH" && identificatore) return archivio.salvaProdotto(corpo,identificatore);
    if (metodo === "DELETE" && identificatore) { await archivio.eliminaProdotto(identificatore); return {ok:true}; }
  }
  if (risorsa === "inventario") {
    if (!identificatore && metodo === "GET") return archivio.inventario();
    if (!identificatore && metodo === "POST") return archivio.aggiungiInventario(corpo,chiave);
    if (identificatore && !azione && metodo === "GET") return archivio.voce(identifica(identificatore));
    if (identificatore && !azione && metodo === "PATCH") return archivio.modificaInventario(identifica(identificatore),corpo);
    if (identificatore && !azione && metodo === "DELETE") { await archivio.eliminaInventario(identifica(identificatore)); return {ok:true}; }
    if (identificatore && azione === "consuma" && metodo === "POST") { await archivio.consumaInventario(identifica(identificatore),corpo,chiave); return {ok:true}; }
  }
  if (risorsa === "spesa" && !azione) {
    if (!identificatore && metodo === "GET") return archivio.spesa();
    if (!identificatore && metodo === "POST") return archivio.aggiungiSpesa(corpo,chiave);
    if (identificatore && metodo === "PATCH") return archivio.modificaSpesa(identifica(identificatore),corpo);
    if (identificatore && metodo === "DELETE") { await archivio.eliminaSpesa(identifica(identificatore)); return {ok:true}; }
  }
  if (risorsa === "preferenze" && !identificatore) {
    if (metodo === "GET") return archivio.preferenze();
    if (metodo === "PUT") return archivio.salvaPreferenze(corpo);
  }
  if (risorsa === "posizioni" && !azione) {
    if (!identificatore && metodo === "GET") return archivio.posizioni();
    if (!identificatore && metodo === "POST") return archivio.aggiungiPosizione(corpo);
    if (identificatore && metodo === "DELETE") { await archivio.eliminaPosizione(identificatore);return {ok:true}; }
  }
  if (risorsa === "ricette") {
    if (!identificatore && metodo === "GET") return archivio.ricette();
    if (!identificatore && metodo === "POST") return archivio.generaRicetta(corpo);
    if (identificatore && !azione && metodo === "GET") return archivio.ricetta(identifica(identificatore));
    if (identificatore && !azione && metodo === "DELETE") { await archivio.eliminaRicetta(identifica(identificatore));return {ok:true}; }
    if (identificatore && azione === "prepara" && metodo === "POST") { await archivio.preparaRicetta(identifica(identificatore));return {ok:true}; }
  }
  if (risorsa === "storico" && !identificatore && metodo === "GET") return archivio.storico();
  if (!["stato","prodotti","inventario","spesa","preferenze","posizioni","ricette","storico"].includes(risorsa)) throw new ErroreApplicazione("Indirizzo non trovato.",404);
  throw new ErroreApplicazione("Operazione non disponibile per questo indirizzo.",405);
}
