import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./roaster.module.css";

export const dynamic = "force-dynamic";
type Props = { params: { slug: string } };

export function generateMetadata({ params }: Props) {
  const title = `Roaster: ${params.slug.replaceAll("-", " ")}`;
  return buildMetadata({ title, description: "Roaster/brand-side med produkter, badges og køb-links.", canonical: `/roasters/${params.slug}`, ogImage: "/og/default.svg" });
}

export default async function RoasterPage({ params }: Props) {
  const name = params.slug.replaceAll("-", " ");
  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>{name}</h1>
      <p className={styles.p}>Brand-side til SEO. Senere: list produkter fra Supabase + køb-links.</p>
    </div>
  );
}
