import styles from "./pricing.module.css";
export default function Pricing() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Pro</h1>
      <p className={styles.p}>Avancerede opskrifter, udstyrsprofiler, statistik, offline brew mode.</p>
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.plan}>Free</div>
          <div className={styles.price}>0 kr</div>
          <ul className={styles.ul}><li>Scan + søg</li><li>Basic Brew DNA</li><li>My Bar</li></ul>
        </div>
        <div className={styles.cardPro}>
          <div className={styles.plan}>Pro</div>
          <div className={styles.price}>49 kr/m</div>
          <ul className={styles.ul}><li>Avancerede opskrifter</li><li>Udstyrsprofiler</li><li>Statistik + hit-rate</li><li>Offline Brew Mode</li></ul>
        </div>
      </div>
    </div>
  );
}
