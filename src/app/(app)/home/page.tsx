import Link from "next/link";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Hjem</h1>
      <p className={styles.p}>Din genvej til næste bryg.</p>
      <div className={styles.row}>
        <Link className={styles.card} href="/scan"><div className={styles.cardTitle}>Scan</div><div className={styles.cardText}>Find kaffe/te hurtigt</div></Link>
        <Link className={styles.card} href="/brew"><div className={styles.cardTitle}>Bryg</div><div className={styles.cardText}>Timer + steps + log</div></Link>
      </div>
    </div>
  );
}
