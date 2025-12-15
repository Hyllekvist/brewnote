import Link from "next/link";
import styles from "./list.module.css";

export default function Page() {
  return (
    <div>
      <h1 className={styles.h1}>Roasters</h1>
      <p className={styles.p}>SEO landing / oversigt (erstattes af Supabase-data).</p>
      <ul className={styles.ul}>
        <li><Link href="/roasters/barbanera">Barbanera</Link></li>
        <li><Link href="/roasters/biolab-tea">BIOLAB TEA</Link></li>
      </ul>
    </div>
  );
}
