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
      <rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 13.5l2.5-3 2 1.75L14 7" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path === "/dictionary" : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-1.5 focus:text-ink-inverse">
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink">
          <Logo className="size-5" />
          <span className="font-medium tracking-tight">Glassbox</span>
        </Link>
        <nav aria-label="Primary" className="-mx-1 flex min-w-0 flex-1 items-center overflow-x-auto">
          <ul className="flex items-center gap-0.5">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active(l.href) ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-8 items-center rounded-md px-2.5 text-sm whitespace-nowrap transition-colors",
                    active(l.href) ? "text-ink" : "text-ink-2 hover:bg-sunk hover:text-ink",
                  )}
                >
                  {l.label}
                  {active(l.href) && <span aria-hidden className="absolute inset-x-2.5 -bottom-[11px] h-px bg-ink" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
