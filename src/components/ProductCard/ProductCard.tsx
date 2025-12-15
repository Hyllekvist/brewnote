import Link from "next/link";
import styles from "./ProductCard.module.css";

export function ProductCard(props: { href: string; title: string; subtitle: string; rating?: number; ratingCount?: number }) {
  const { href, title, subtitle, rating, ratingCount } = props;
  return (
    <Link href={href} className={styles.card}>
      <div className={styles.badge}>Brew DNA</div>
      <div className={styles.title}>{title}</div>
      <div className={styles.sub}>{subtitle}</div>
      <div className={styles.meta}>
        {typeof rating === "number" ? <span>⭐ {rating.toFixed(1)} ({ratingCount ?? 0})</span> : <span className={styles.muted}>Ingen rating endnu</span>}
        <span className={styles.arrow}>›</span>
      </div>
    </Link>
  );
}
