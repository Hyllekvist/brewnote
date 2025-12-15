import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/SEO/JsonLd";
import styles from "./guide.module.css";

export const dynamic = "force-dynamic";
type Props = { params: { slug: string } };

export function generateMetadata({ params }: Props) {
  const title = `Guide: ${params.slug.replaceAll("-", " ")}`;
  return buildMetadata({ title, description: "How-to brew guide med trin, tider og tips.", canonical: `/guides/${params.slug}`, ogImage: "/og/default.svg" });
}

export default async function GuidePage({ params }: Props) {
  const headline = params.slug.replaceAll("-", " ");
  const jsonLd = { "@context": "https://schema.org", "@type": "HowTo", name: headline, step: [{ "@type": "HowToStep", text: "Dosér korrekt" },{ "@type": "HowToStep", text: "Hold styr på temperatur" },{ "@type": "HowToStep", text: "Tid + ratio" }] };

  return (
    <article className={styles.article}>
      <JsonLd data={jsonLd} />
      <h1 className={styles.h1}>{headline}</h1>
      <p className={styles.p}>Kort, SEO-venlig guide der kan udvides til fuldt indhold senere.</p>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Opskrift (MVP)</div>
        <ol className={styles.ol}><li>Dosér</li><li>Bloom/infusion</li><li>Hæld/steep</li><li>Smag & justér</li></ol>
      </div>
    </article>
  );
}
