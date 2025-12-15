import Link from "next/link";
import styles from "./list.module.css";

export default function Page() {
  return (
    <div>
      <h1 className={styles.h1}>Te</h1>
      <p className={styles.p}>SEO landing / oversigt (erstattes af Supabase-data).</p>
      <ul className={styles.ul}>
        <li><Link href="/teas/sencha-konomi">Sencha Konomi</Link></li>
        <li><Link href="/teas/greymode-earl-grey">Greymode Earl Grey</Link></li>
      </ul>
    </div>
  );
}
