
import type { Metadata } from "next";
import BrewReviewClient from "./BrewReviewClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review – BrewNote",
  description: "Log din bryg: rating, smag og noter.",
  alternates: { canonical: "/brew/review" },
};

export default function BrewReviewPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const type = (searchParams?.type as string) || "coffee";
  const slug = (searchParams?.slug as string) || "";
  const seconds = Number(searchParams?.seconds || "0");
  const method = (searchParams?.method as string) || "Pour-over";

  return (
    <BrewReviewClient
      type={type}
      slug={slug}
      seconds={Number.isFinite(seconds) ? seconds : 0}
      method={method}
    />
  );
}