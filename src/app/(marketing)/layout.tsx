import { GlobalHeader } from "@/components/GlobalHeader/GlobalHeader";
import styles from "./marketing.module.css";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <GlobalHeader variant="marketing" />
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}><div className={styles.inner}>© {new Date().getFullYear()} Coffee & Tee</div></footer>
    </div>
  );
}
