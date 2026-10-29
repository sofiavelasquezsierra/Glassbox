"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Demo" },
  { href: "/case-study", label: "Case study" },
  { href: "/stack", label: "AI stack" },
  { href: "/system", label: "Design system" },
  { href: "/resume", label: "Resume" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="15" height="15" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 13.5l2.5-3 2 1.75L14 7" fill="none" stroke="var(--brand)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path === "/dictionary" : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/80 backdrop-blur supports-[backdrop-filter]:bg-paper/65">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-1.5 focus:text-ink-inverse">
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink">
          <Logo className="size-5" />
          <span className="text-[0.9375rem] font-semibold tracking-[0.14em] uppercase">Glassbox</span>
        </Link>
        <nav aria-label="Primary" className="-mx-1 flex min-w-0 flex-1 items-center overflow-x-auto lg:flex-none">
          <ul className="flex items-center gap-0.5">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active(l.href) ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-8 items-center rounded-full px-3 text-sm whitespace-nowrap transition-colors",
                    active(l.href) ? "text-ink" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {l.label}
                  {active(l.href) && <span aria-hidden className="absolute inset-x-3 -bottom-[11px] h-px bg-brand" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center justify-end gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
