import Link from "next/link";
import styles from "./scan.module.css";

export default function Scan() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Scan</h1>
      <p className={styles.p}>MVP: søg + vælg. Kamera-scan kommer som næste step.</p>
      <div className={styles.search}>
        <input className={styles.input} placeholder="Søg efter kaffe eller te…" />
        <button className={styles.btn} type="button">Søg</button>
      </div>
      <div className={styles.hint}>
        Prøv: <Link href="/coffees/gigino-80-anniversario">coffee slug</Link> · <Link href="/teas/sencha-konomi">tea slug</Link>
      </div>
    </div>
  );
}
