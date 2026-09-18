import { gestisciRichiesta } from "../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (richiesta: Request) => gestisciRichiesta(richiesta);
export const POST = (richiesta: Request) => gestisciRichiesta(richiesta);
export const PUT = (richiesta: Request) => gestisciRichiesta(richiesta);
export const PATCH = (richiesta: Request) => gestisciRichiesta(richiesta);
export const DELETE = (richiesta: Request) => gestisciRichiesta(richiesta);
