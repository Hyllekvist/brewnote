import Link from "next/link";
import styles from "./list.module.css";

export default function Page() {
  return (
    <div>
      <h1 className={styles.h1}>Kaffe</h1>
      <p className={styles.p}>SEO landing / oversigt (erstattes af Supabase-data).</p>
      <ul className={styles.ul}>
        <li><Link href="/coffees/gigino-80-anniversario">Gigino 80 Anniversario</Link></li>
        <li><Link href="/coffees/daily-juju">Daily Juju</Link></li>
      </ul>
    </div>
  );
}
