import styles from "./BarPage.module.css";
import { BarClient } from "./BarClient";

export const dynamic = "force-dynamic";

export default function BarPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Din Bar</h1>
        <p className={styles.sub}>
          Det du har tilføjet — klar til bryg og noter.
        </p>
      </header>

      <BarClient />
    </main>
  );
}
