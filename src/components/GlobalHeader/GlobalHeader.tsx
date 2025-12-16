"use client";
import Link from "next/link";
import styles from "./GlobalHeader.module.css";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import BarCountBadge from "../BarCountBadge/BarCountBadge";

export function GlobalHeader({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const isMarketing = variant === "marketing";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={isMarketing ? "/" : "/home"} className={styles.brand}>
          <span className={styles.dot} />
          <span>Coffee & Tee</span>
        </Link>

        <nav className={styles.nav}>
          {isMarketing ? (
            <>
              <Link className={styles.link} href="/coffees">Kaffe</Link>
              <Link className={styles.link} href="/teas">Te</Link>
              <Link className={styles.link} href="/guides">Guides</Link>
              <Link className={styles.link} href="/pricing">Pro</Link>
              <Link className={styles.cta} href="/scan">Scan</Link>
            </>
          ) : (
            <>
              <Link className={styles.link} href="/scan">Scan</Link>
              <Link className={styles.link} href="/brew">Bryg</Link>

              {/* 👇 HER */}
              <Link className={styles.link} href="/bar">
                Min Bar <BarCountBadge />
              </Link>

              <Link className={styles.link} href="/profile">Profil</Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}