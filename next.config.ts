import type { NextConfig } from "next";
import { percorsoBase } from "./src/lib/percorsi";
const configurazione: NextConfig = {
  agentRules: false,
  output: "export",
  basePath: percorsoBase,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default configurazione;
