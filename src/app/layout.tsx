import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Coffee & Tee — Brew DNA", template: "%s — Coffee & Tee" },
  description: "Scan coffee & tea, get Brew DNA, brew smarter.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: { title: "Coffee & Tee", description: "Scan coffee & tea, get Brew DNA, brew smarter.", images: ["/og/default.svg"], type: "website" },
  icons: { icon: "/icons/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
