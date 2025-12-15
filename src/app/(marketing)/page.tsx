import Link from "next/link";
import styles from "./home.module.css";

export default function MarketingHome() {
  return (
    <div className={styles.hero}>
      <div className={styles.kicker}>Brew DNA</div>
      <h1 className={styles.h1}>Scan kaffe & te. Bryg bedre. Gentag.</h1>
      <p className={styles.p}>
        Vivino-style discovery, men med fokus på <b>ritual</b>, <b>opskrift</b> og en profil der hjælper dig til en bedre kop.
      </p>
      <div className={styles.ctas}>
        <Link className={styles.primary} href="/scan">Åbn Scan</Link>
        <Link className={styles.secondary} href="/guides">Se guides</Link>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}><div className={styles.cardTitle}>Brew Mode</div><div className={styles.cardText}>Timer + steps + smagscheck → smartere anbefalinger.</div></div>
        <div className={styles.card}><div className={styles.cardTitle}>SEO motor</div><div className={styles.cardText}>Programmatic sider for kaffe/te/guides/roasters.</div></div>
        <div className={styles.card}><div className={styles.cardTitle}>My Bar</div><div className={styles.cardText}>Inventory, batches, peak window og genkøb.</div></div>
      </div>
    </div>
  );
}
