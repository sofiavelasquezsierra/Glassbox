"use client";
import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "../system/icons";

type Theme = "light" | "dark";
const KEY = "glassbox-theme";

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. Dark is the default. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const apply = () => {
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    document.documentElement.dataset.theme = next;
  };
  const Icon = theme === "light" ? SunIcon : MoonIcon;
  return (
    <button
      type="button"
      onClick={apply}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
      className="grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-sunk hover:text-ink"
    >
      <Icon />
    </button>
  );
}
