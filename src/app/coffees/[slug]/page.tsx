import type { Metadata } from "next";
import ProductScreen from "@/components/ProductScreen/ProductScreen";

export const dynamic = "force-static";

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const name = decodeURIComponent(params.slug).replace(/-/g, " ");
  return {
    title: `${name} – BrewNote`,
    description: `Brew DNA, bryg-anbefaling og vurderinger for ${name}.`,
    alternates: { canonical: `/coffees/${params.slug}` },
    openGraph: {
      title: `${name} – BrewNote`,
      description: `Brew DNA • Brew Mode • Reviews`,
      url: `/coffees/${params.slug}`,
      images: [{ url: `/api/og` }],
    },
  };
}

export default function CoffeeProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const name = decodeURIComponent(params.slug).replace(/-/g, " ");

  return (
    <ProductScreen
      slug={params.slug} // ✅ NYT
      name={name}
      meta="Coffee · Origin · Roaster"
      dna={{ acid: 0.45, body: 0.78, sweet: 0.55 }}
      tasteSummary="Mørk og fyldig med lav syre og en rund sødme."
      tasteNotes={[
        { label: "chokolade", count: 337 },
        { label: "ristet", count: 188 },
        { label: "karamel", count: 142 },
        { label: "mørk frugt", count: 120 },
        { label: "vanilje", count: 98 },
      ]}
      recommendedBrew={{
        method: "Pour-over",
        time: "2:45",
        reason: "Balancerer krop og sødme",
        href: `/brew?type=coffee&slug=${encodeURIComponent(params.slug)}`,
      }}
      variations={[
        {
          id: "espresso",
          method: "Espresso",
          description: "Mere intensitet og tungere krop.",
          time: "0:30",
        },
        {
          id: "coldbrew",
          method: "Cold brew",
          description: "Mere sødme, mindre bitterhed.",
          time: "12h",
        },
        {
          id: "aeropress",
          method: "AeroPress",
          description: "Renere kop med høj klarhed.",
          time: "1:45",
        },
      ]}
    />
  );
}