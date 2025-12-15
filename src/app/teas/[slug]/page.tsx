import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/SEO/JsonLd";
import styles from "../product.module.css";

export const dynamic = "force-dynamic";
type Props = { params: { slug: string } };

export function generateMetadata({ params }: Props) {
  const title = `Te: ${params.slug.replaceAll("-", " ")}`;
  return buildMetadata({ title, description: "Te med Brew DNA, opskrifter og brygge-match.", canonical: `/teas/${params.slug}`, ogImage: "/og/default.svg" });
}

export default async function TeaPage({ params }: Props) {
  const name = params.slug.replaceAll("-", " ");
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name, brand: "Coffee & Tee" };
  return (
    <div className={styles.wrap}>
      <JsonLd data={jsonLd} />
      <h1 className={styles.h1}>{name}</h1>
      <p className={styles.p}>Her kommer Brew DNA, infusion guides og reviews.</p>
    </div>
  );
}
