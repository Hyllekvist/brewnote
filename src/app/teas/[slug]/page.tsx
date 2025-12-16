import ProductScreen from "@/components/ProductScreen/ProductScreen";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export function generateMetadata({ params }: Props) {
  const name = params.slug.replaceAll("-", " ");
  return buildMetadata({
    title: `Te: ${name}`,
    description: "Te med Brew DNA, infusion guides og brygge-match.",
    canonical: `/teas/${params.slug}`,
    ogImage: "/og/default.svg",
  });
}

export default function TeaPage({ params }: Props) {
  const name = params.slug.replaceAll("-", " ");

  return (
    <ProductScreen
      slug={params.slug} // ✅ vigtigt
      name={name}
      meta="Tea · Origin · Type"
      dna={{ acid: 0.35, body: 0.55, sweet: 0.65 }} // placeholder
      tasteSummary="Balanceret og aromatisk te med blød sødme og lav bitterhed."
      tasteNotes={[
        { label: "blomstret", count: 210 },
        { label: "urte", count: 160 },
        { label: "honning", count: 132 },
        { label: "citrus", count: 98 },
      ]}
      recommendedBrew={{
        method: "Infusion",
        time: "3:00",
        reason: "Fremhæver aroma uden bitterhed",
        href: `/brew?type=tea&slug=${encodeURIComponent(params.slug)}`,
      }}
      variations={[
        {
          id: "short",
          method: "Kort infusion",
          description: "Lettere og mere floral kop.",
          time: "2:00",
        },
        {
          id: "standard",
          method: "Standard infusion",
          description: "Balanceret aroma og krop.",
          time: "3:00",
        },
        {
          id: "long",
          method: "Lang infusion",
          description: "Dybere smag og mere fylde.",
          time: "4:00",
        },
      ]}
    />
  );
}