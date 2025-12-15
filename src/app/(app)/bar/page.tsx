import styles from "./bar.module.css";
import { ProductCard } from "@/components/ProductCard/ProductCard";

export default function Bar() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Min Bar</h1>
      <p className={styles.p}>Inventory + genkøb. (Supabase senere.)</p>
      <div className={styles.grid}>
        <ProductCard href="/coffees/gigino-80-anniversario" title="Gigino 80 Anniversario" subtitle="Toscana • mørk frugt • eg" rating={4.3} ratingCount={5072} />
        <ProductCard href="/teas/sencha-konomi" title="Sencha Konomi" subtitle="Japan • umami • frisk" />
      </div>
    </div>
  );
}
