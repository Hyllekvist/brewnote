import type { Metadata } from "next";
import TasteClient from "./TasteClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Din smag – BrewNote",
  description: "Se din smagsprofil og hvor sikker vi er.",
  alternates: { canonical: "/taste" },
};

export default function TastePage() {
  return <TasteClient />;
}