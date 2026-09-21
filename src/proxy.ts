import { NextResponse, type NextRequest } from "next/server";
import { verificaAccesso } from "./lib/autenticazione";

export function proxy(richiesta: NextRequest) {
  // Queste risorse non contengono dati personali e servono all'installazione PWA.
  const percorso = richiesta.nextUrl.pathname;
  if (
    percorso.startsWith("/_next/static/") ||
    percorso.startsWith("/icone/") ||
    [
      "/manifest.webmanifest",
      "/servizio-worker.js",
      "/marchio.svg",
      "/favicon.ico",
    ].includes(percorso)
  )
    return NextResponse.next();
  if (
    richiesta.nextUrl.pathname === "/api/salute" &&
    richiesta.method === "GET"
  )
    return NextResponse.next();
  const rifiuto = verificaAccesso(richiesta);
  if (rifiuto) return rifiuto;
  const risposta = NextResponse.next();
  risposta.headers.set("Cache-Control", "private, no-store");
  return risposta;
}

export const config = { matcher: "/:percorso*" };
