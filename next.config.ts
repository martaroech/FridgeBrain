import type { NextConfig } from "next";
process.env.NEXT_TELEMETRY_DISABLED = "1";
const configurazione: NextConfig = {
  agentRules: false,
  output:
    process.env.FRIDGEBRAIN_DISTRIBUZIONE === "autonoma"
      ? "standalone"
      : undefined,
  outputFileTracingExcludes: {
    "/*": [
      "./data/**/*",
      "./.git/**/*",
      "./tests/**/*",
      "./test-results/**/*",
      "./playwright-report/**/*",
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default configurazione;
