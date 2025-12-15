import styles from "./profile.module.css";
export default function Profile() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Profil</h1>
      <p className={styles.p}>Auth + prefs + udstyr. (Supabase Auth næste.)</p>
      <div className={styles.card}><div className={styles.k}>Tema</div><div className={styles.v}>Skiftes via toggle i headeren</div></div>
    </div>
  );
}
