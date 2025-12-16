import BarClient from "./BarClient";
import styles from "./BarPage.module.css";

export const dynamic = "force-dynamic";

export default function BarPage() {
  return (
    <main className={styles.page}>
      <div className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.h1}>Min Bar</h1>
          <p className={styles.p}>Det du har tilføjet — klar til bryg og noter.</p>
        </header>

        <BarClient />
      </div>
    </main>
  );
}
