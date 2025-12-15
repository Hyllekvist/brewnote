import type { Metadata } from "next";
import { ProductScreen } from "@/components/ProductScreen/ProductScreen";

export const dynamic = "force-static";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const name = decodeURIComponent(params.slug).replace(/-/g, " ");
  return {
    title: `${name} – BrewNote`,
    description: `Brew DNA, presets og bryg nu for ${name}.`,
    alternates: { canonical: `/coffees/${params.slug}` },
    openGraph: {
      title: `${name} – BrewNote`,
      description: `Brew DNA • Scan • Brew Mode`,
      url: `/coffees/${params.slug}`,
      images: [{ url: `/api/og` }],
    },
  };
}

export default function CoffeeProductPage({ params }: { params: { slug: string } }) {
  const title = decodeURIComponent(params.slug).replace(/-/g, " ");

  // TODO: senere: hent fra Supabase
  return (
    <ProductScreen
      title={title}
      subtitle="Coffee • Origin • Roaster"
      imageUrl={undefined}
      dna={{ acid: 0.45, body: 0.78, sweet: 0.55 }}
      primaryCta={{
        label: "BRYG NU",
        hint: "Anbefalet opskrift • 2:45",
        href: `/brew?type=coffee&slug=${encodeURIComponent(params.slug)}`,
      }}
      presets={[
        {
          id: "espresso",
          label: "Espresso",
          sub: "Fyldig",
          brewTime: "0:30",
          methodKey: "espresso",
          dnaMini: { acid: 0.35, body: 0.85, sweet: 0.55 },
        },
        {
          id: "pourover",
          label: "Pour-over",
          sub: "Balanceret",
          brewTime: "2:45",
          methodKey: "pourover",
          dnaMini: { acid: 0.50, body: 0.65, sweet: 0.55 },
        },
        {
          id: "coldbrew",
          label: "Cold brew",
          sub: "Sød & smooth",
          brewTime: "12h",
          methodKey: "coldbrew",
          dnaMini: { acid: 0.25, body: 0.60, sweet: 0.75 },
        },
      ]}
      tasteChips={[
        { label: "chokolade", count: 337 },
        { label: "ristet", count: 188 },
        { label: "karamel", count: 142 },
        { label: "mørk frugt", count: 120 },
        { label: "vanilje", count: 98 },
      ]}
      secondary={{
        addToBarHref: `/bar?add=${encodeURIComponent(params.slug)}`,
        reviewsHref: `/coffees/${encodeURIComponent(params.slug)}#reviews`,
        editHref: `/coffees/${encodeURIComponent(params.slug)}#edit`,
      }}
    />
  );
}
