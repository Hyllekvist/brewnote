import { GlobalHeader } from "@/components/GlobalHeader/GlobalHeader";
import { BottomNav } from "@/components/BottomNav/BottomNav";
import styles from "./appshell.module.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <GlobalHeader variant="app" />
      <main className={styles.main}>{children}</main>
      <BottomNav />
    </div>
  );
}
