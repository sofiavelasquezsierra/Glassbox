"use client";
import { useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "../system/icons";

type Theme = "system" | "light" | "dark";
const KEY = "glassbox-theme";
const order: Theme[] = ["system", "light", "dark"];

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const next = order[(order.indexOf(theme) + 1) % order.length]!;
  const apply = () => {
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  };
  const Icon = theme === "light" ? SunIcon : theme === "dark" ? MoonIcon : MonitorIcon;
  return (
    <button
      type="button"
      onClick={apply}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
      className="grid size-8 place-items-center rounded-md text-ink-2 transition-colors hover:bg-sunk hover:text-ink"
    >
      <Icon />
    </button>
  );
}
