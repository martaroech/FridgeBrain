import type { Metadata, Viewport } from "next";
import "./globals.css";
import { percorsoApp } from "@/lib/percorsi";

export const metadata: Metadata = {
  title: "FridgeBrain · La tua cucina, con più cura",
  description:
    "Il tuo inventario alimentare, le scadenze e le ricette. Sempre con te.",
  icons: { icon: percorsoApp("/marchio.svg"), apple: percorsoApp("/icone/apple-touch-icon.png") },
  manifest: percorsoApp("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FridgeBrain",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#204d37",
};

export default function LayoutPrincipale({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
