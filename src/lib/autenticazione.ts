import { createHash, timingSafeEqual } from "node:crypto";

function impronta(valore: string): Buffer {
  return createHash("sha256").update(valore).digest();
}

/** Credenziali esclusivamente server; nessuna modalità pubblica se manca la configurazione. */
export function verificaAccesso(richiesta: Request): Response | null {
  const intestazioni = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const utente = process.env.FRIDGEBRAIN_UTENTE;
  const password = process.env.FRIDGEBRAIN_PASSWORD;
  if (!utente || utente.includes(":") || !password || password.length < 20)
    return Response.json(
      {
        errore:
          "Accesso non configurato. Imposta utente e password di almeno 20 caratteri sul server.",
      },
      { status: 503, headers: intestazioni },
    );
  const intestazione = richiesta.headers.get("authorization") ?? "";
  let credenziali = "";
  if (
    /^Basic [A-Za-z0-9+/]+=*$/i.test(intestazione) &&
    intestazione.length < 4096
  )
    credenziali = Buffer.from(intestazione.slice(6), "base64").toString("utf8");
  if (timingSafeEqual(impronta(credenziali), impronta(`${utente}:${password}`)))
    return null;
  return Response.json(
    { errore: "Accedi con le credenziali del tuo FridgeBrain." },
    {
      status: 401,
      headers: {
        ...intestazioni,
        "WWW-Authenticate": 'Basic realm="FridgeBrain", charset="UTF-8"',
      },
    },
  );
}
