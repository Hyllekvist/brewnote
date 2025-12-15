import { BrewMode } from "@/components/BrewMode/BrewMode";
import styles from "./brew.module.css";

export default function Brew() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Bryg</h1>
      <p className={styles.p}>Brew Mode er retention-loopet.</p>
      <BrewMode />
    </div>
  );
}
