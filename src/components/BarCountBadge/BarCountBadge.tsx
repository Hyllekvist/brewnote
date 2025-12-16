"use client";

import { useBarCount } from "@/lib/hooks/useBarCount";
import styles from "./BarCountBadge.module.css";

export default function BarCountBadge() {
  const { count, loading } = useBarCount();

  // vis ingenting hvis vi ikke ved det endnu eller count=0
  if (loading || !count) return null;

  return <span className={styles.badge}>{count}</span>;
}
