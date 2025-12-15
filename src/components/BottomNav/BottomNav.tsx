"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { href: "/home", label: "Hjem", icon: "🏠" },
  { href: "/scan", label: "Scan", icon: "📷" },
  { href: "/brew", label: "Bryg", icon: "⏱️" },
  { href: "/bar", label: "Bar", icon: "🗂️" },
  { href: "/profile", label: "Profil", icon: "👤" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className={styles.nav} aria-label="Bundnavigation">
      {ITEMS.map((it) => {
        const active = path === it.href;
        return (
          <Link key={it.href} href={it.href} className={`${styles.item} ${active ? styles.active : ""}`}>
            <span className={styles.icon}>{it.icon}</span>
            <span className={styles.label}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
