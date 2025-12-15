import Link from "next/link";
import styles from "./list.module.css";

export default function Page() {
  return (
    <div>
      <h1 className={styles.h1}>Guides</h1>
      <p className={styles.p}>SEO landing / oversigt (erstattes af Supabase-data).</p>
      <ul className={styles.ul}>
        <li><Link href="/guides/pourover-basics">Pour-over basics</Link></li>
        <li><Link href="/guides/espresso-dial-in">Espresso dial-in</Link></li>
      </ul>
    </div>
  );
}
