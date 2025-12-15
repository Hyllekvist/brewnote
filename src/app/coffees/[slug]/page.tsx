import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/SEO/JsonLd";
import styles from "./product.module.css";

export const dynamic = "force-dynamic";
type Props = { params: { slug: string } };

export function generateMetadata({ params }: Props) {
  const title = `Kaffe: ${params.slug.replaceAll("-", " ")}`;
  return buildMetadata({ title, description: "Kaffe med Brew DNA, opskrifter og brygge-match.", canonical: `/coffees/${params.slug}`, ogImage: "/og/default.svg" });
}

export default async function CoffeePage({ params }: Props) {
  const name = params.slug.replaceAll("-", " ");
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name, brand: "Coffee & Tee" };

  return (
    <div className={styles.wrap}>
      <JsonLd data={jsonLd} />
      <h1 className={styles.h1}>{name}</h1>
      <p className={styles.p}>Her kommer Brew DNA, opskrifter, reviews og “bryg nu”. Kobl på Supabase senere.</p>
      <div className={styles.dna}>
        <div className={styles.dnaTitle}>Brew DNA</div>
        <div className={styles.dnaRow}><span>Syre</span><span className={styles.bar}><i style={{ width: "35%" }} /></span></div>
        <div className={styles.dnaRow}><span>Krop</span><span className={styles.bar}><i style={{ width: "70%" }} /></span></div>
        <div className={styles.dnaRow}><span>Sødme</span><span className={styles.bar}><i style={{ width: "45%" }} /></span></div>
      </div>
    </div>
  );
}
