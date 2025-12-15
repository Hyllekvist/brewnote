import type { Metadata } from "next";
import BrewClient from "./BrewClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brew Mode – BrewNote",
  description: "Step-by-step bryg med timer, pour steps og log.",
  alternates: { canonical: "/brew" },
};

export default function BrewPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const type = (searchParams?.type as string) || "coffee";
  const slug = (searchParams?.slug as string) || "";

  return <BrewClient type={type} slug={slug} />;
}
