"use client";
import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => { const t = document.documentElement.getAttribute("data-theme") as any; if (t) setTheme(t); }, []);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  return (
    <button className={styles.btn} type="button" onClick={() => setTheme((p) => (p === "dark" ? "light" : "dark"))}>
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
