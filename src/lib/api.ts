import {
  ArchivioFridgeBrain,
  ErroreApplicazione,
  archivioApplicazione,
} from "./servizi";

function risposta(dati: unknown, stato = 200): Response {
  return Response.json(dati, {
    status: stato,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function identifica(valore: string | undefined): number {
  if (
    !valore ||
    !/^[1-9]\d*$/.test(valore) ||
    !Number.isSafeInteger(Number(valore))
  )
    throw new ErroreApplicazione("Identificatore non valido.");
  return Number(valore);
}

function verificaOrigine(richiesta: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(richiesta.method)) return;
  const origine = richiesta.headers.get("origin");
  const indirizzo = new URL(richiesta.url);
  const origini = [
    indirizzo.origin,
    ...(process.env.FRIDGEBRAIN_ORIGINI ?? "")
      .split(",")
      .map((valore) => valore.trim())
      .filter(Boolean),
  ];
  // Next può ricostruire l'URL con l'indirizzo di ascolto interno. Host conserva
  // l'autorità richiesta dal browser; le intestazioni forwarded non sono fidate.
  const host = richiesta.headers.get("host");
  if (host) {
    try {
      const pubblico = new URL(`${indirizzo.protocol}//${host}`);
      if (pubblico.host === host && !pubblico.username && !pubblico.password)
        origini.push(pubblico.origin);
    } catch {
      /* Un Host malformato non aggiunge origini autorizzate. */
    }
  }
  if (
    (origine && !origini.includes(origine)) ||
    richiesta.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ErroreApplicazione(
      "Richiesta rifiutata: apri FridgeBrain direttamente dal suo indirizzo locale.",
      403,
    );
}

async function leggiCorpo(richiesta: Request): Promise<unknown> {
  const massimo = 128 * 1024;
  if (Number(richiesta.headers.get("content-length") ?? 0) > massimo)
    throw new ErroreApplicazione("I dati inviati sono troppo grandi.", 413);
  if (!richiesta.body) return {};
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      richiesta.headers.get("content-type") ?? "",
    )
  )
    throw new ErroreApplicazione("Invia i dati nel formato JSON.", 415);
  const lettore = richiesta.body.getReader();
  const decodificatore = new TextDecoder();
  let dimensione = 0;
  let contenuto = "";
  try {
    while (true) {
      const parte = await lettore.read();
      if (parte.done) break;
      dimensione += parte.value.byteLength;
      if (dimensione > massimo) {
        await lettore.cancel();
        throw new ErroreApplicazione("I dati inviati sono troppo grandi.", 413);
      }
      contenuto += decodificatore.decode(parte.value, { stream: true });
    }
    contenuto += decodificatore.decode();
  } finally {
    lettore.releaseLock();
  }
  if (!contenuto.trim()) return {};
  try {
    return JSON.parse(contenuto);
  } catch {
    throw new ErroreApplicazione("Il contenuto JSON non è valido.");
  }
}

export async function gestisciRichiesta(
  richiesta: Request,
  archivioFornito?: ArchivioFridgeBrain,
): Promise<Response> {
  try {
    verificaOrigine(richiesta);
    const indirizzo = new URL(richiesta.url);
    const segmenti = indirizzo.pathname
      .replace(/^\/api\//, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const [risorsa, identificatore, azione] = segmenti;
    if (segmenti.length > 3)
      throw new ErroreApplicazione("Indirizzo non trovato.", 404);
    const metodo = richiesta.method;
    const archivio = archivioFornito ?? archivioApplicazione();
    if (risorsa === "salute" && segmenti.length === 1 && metodo === "GET")
      return risposta({
        ok: true,
        catalogo_disponibile: Boolean(archivio.database.catalogo()),
      });
    if (risorsa === "stato" && segmenti.length === 1 && metodo === "GET")
      return risposta(archivio.stato());
    if (risorsa === "prodotti" && !azione) {
      if (metodo === "GET" && !identificatore)
        return risposta(
          indirizzo.searchParams.has("codice")
            ? archivio.prodotto(indirizzo.searchParams.get("codice"))
            : archivio.cercaProdotti(indirizzo.searchParams.get("q") ?? ""),
        );
      if (metodo === "POST" && !identificatore)
        return risposta(
          archivio.salvaProdotto(
            await leggiCorpo(richiesta),
            undefined,
            richiesta.headers.get("idempotency-key") ?? undefined,
          ),
          201,
        );
      if (metodo === "PATCH" && identificatore)
        return risposta(
          archivio.salvaProdotto(await leggiCorpo(richiesta), identificatore),
        );
      if (metodo === "DELETE" && identificatore) {
        archivio.eliminaProdotto(identificatore);
        return risposta({ ok: true });
      }
    }
    if (risorsa === "inventario") {
      if (!identificatore && metodo === "GET")
        return risposta(archivio.inventario());
      if (!identificatore && metodo === "POST")
        return risposta(
          archivio.aggiungiInventario(
            await leggiCorpo(richiesta),
            richiesta.headers.get("idempotency-key") ?? undefined,
          ),
          201,
        );
      if (identificatore && !azione && metodo === "GET")
        return risposta(archivio.voce(identifica(identificatore)));
      if (identificatore && !azione && metodo === "PATCH")
        return risposta(
          archivio.modificaInventario(
            identifica(identificatore),
            await leggiCorpo(richiesta),
          ),
        );
      if (identificatore && !azione && metodo === "DELETE") {
        archivio.eliminaInventario(identifica(identificatore));
        return risposta({ ok: true });
      }
      if (identificatore && azione === "consuma" && metodo === "POST") {
        archivio.consumaInventario(
          identifica(identificatore),
          await leggiCorpo(richiesta),
          richiesta.headers.get("idempotency-key") ?? undefined,
        );
        return risposta({ ok: true });
      }
    }
    if (risorsa === "spesa" && !azione) {
      if (!identificatore && metodo === "GET")
        return risposta(archivio.spesa());
      if (!identificatore && metodo === "POST")
        return risposta(
          archivio.aggiungiSpesa(
            await leggiCorpo(richiesta),
            richiesta.headers.get("idempotency-key") ?? undefined,
          ),
          201,
        );
      if (identificatore && metodo === "PATCH")
        return risposta(
          archivio.modificaSpesa(
            identifica(identificatore),
            await leggiCorpo(richiesta),
          ),
        );
      if (identificatore && metodo === "DELETE") {
        archivio.eliminaSpesa(identifica(identificatore));
        return risposta({ ok: true });
      }
    }
    if (risorsa === "preferenze" && !identificatore) {
      if (metodo === "GET") return risposta(archivio.preferenze());
      if (metodo === "PUT")
        return risposta(archivio.salvaPreferenze(await leggiCorpo(richiesta)));
    }
    if (risorsa === "posizioni" && !azione) {
      if (!identificatore && metodo === "GET")
        return risposta(archivio.posizioni());
      if (!identificatore && metodo === "POST")
        return risposta(
          archivio.aggiungiPosizione(await leggiCorpo(richiesta)),
          201,
        );
      if (identificatore && metodo === "DELETE") {
        archivio.eliminaPosizione(identificatore);
        return risposta({ ok: true });
      }
    }
    if (risorsa === "ricette") {
      if (!identificatore && metodo === "GET")
        return risposta(archivio.ricette());
      if (!identificatore && metodo === "POST")
        return risposta(
          await archivio.generaRicetta(await leggiCorpo(richiesta)),
          201,
        );
      if (identificatore && !azione && metodo === "GET")
        return risposta(archivio.ricetta(identifica(identificatore)));
      if (identificatore && !azione && metodo === "DELETE") {
        archivio.eliminaRicetta(identifica(identificatore));
        return risposta({ ok: true });
      }
      if (identificatore && azione === "prepara" && metodo === "POST") {
        archivio.preparaRicetta(identifica(identificatore));
        return risposta({ ok: true });
      }
    }
    if (risorsa === "storico" && !identificatore && metodo === "GET")
      return risposta(archivio.storico());
    if (
      ![
        "salute",
        "stato",
        "prodotti",
        "inventario",
        "spesa",
        "preferenze",
        "posizioni",
        "ricette",
        "storico",
      ].includes(risorsa)
    )
      throw new ErroreApplicazione("Indirizzo non trovato.", 404);
    throw new ErroreApplicazione(
      "Operazione non disponibile per questo indirizzo.",
      405,
    );
  } catch (errore) {
    if (errore instanceof ErroreApplicazione)
      return risposta({ errore: errore.message }, errore.stato);
    // I dettagli tecnici non includono dati personali e restano nel processo del server.
    const codice =
      errore && typeof errore === "object" && "code" in errore
        ? String(errore.code)
        : "non_disponibile";
    console.error(`Errore interno FridgeBrain; codice diagnostico: ${codice}.`);
    return risposta(
      {
        errore:
          "Non è stato possibile completare l'operazione. Controlla che il database sia disponibile e riprova.",
      },
      500,
    );
  }
}
