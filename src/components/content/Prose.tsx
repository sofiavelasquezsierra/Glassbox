import { cn } from "@/lib/cn";

/** Long-form building blocks for /case-study and /stack. */
export function Article({ children, serif, className }: { children: React.ReactNode; serif?: boolean; className?: string }) {
  return (
    <main>
    <article
      className={cn(
        "mx-auto max-w-[72ch] px-4 py-12 text-ink-2 sm:px-6",
        serif ? "font-display text-[1.1875rem] leading-[1.7]" : "text-base leading-7",
        "[&_a]:text-ink [&_a]:underline [&_a]:decoration-rule-strong [&_a]:underline-offset-2 hover:[&_a]:decoration-ink",
        "[&_strong]:font-medium [&_strong]:text-ink [&_code]:rounded-xs [&_code]:bg-sunk [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.8em] [&_code]:text-ink",
        className,
      )}
    >
      {children}
    </article>
    </main>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow font-sans">{children}</p>;
}

export function Title({ children, lede }: { children: React.ReactNode; lede?: React.ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="mt-2 display text-4xl leading-[1.1] text-ink sm:text-[3.25rem]">{children}</h1>
      {lede && <p className="mt-4 font-sans text-lg leading-relaxed text-ink-2">{lede}</p>}
    </header>
  );
}

export function H2({ id, children, n }: { id: string; children: React.ReactNode; n?: string }) {
  return (
    <h2 id={id} className="mt-14 mb-4 scroll-mt-20 border-t border-rule pt-6 font-sans text-xl font-medium tracking-tight text-ink">
      {n && <span className="mr-2 font-mono text-sm font-normal text-ink-3">{n}</span>}
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-2 font-sans text-base font-medium text-ink">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-5">{children}</p>;
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="mb-5 list-disc space-y-2 pl-5 marker:text-ink-3">{children}</ul>;
}

/** Content only the author can provide. Visible in every environment so nothing ships half-written by accident. */
export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 rounded-md border border-dashed border-accent bg-accent-wash-2 px-4 py-3 font-sans text-sm text-ink-2">
      <span className="mr-1.5 font-mono text-2xs font-medium text-accent-ink">Sofia Velasquez Sierra</span>
      {children}
    </div>
  );
}

/** Image slot for a Figma export. Shows a labeled placeholder until `src` is set. */
export function Figure({ src, alt, caption, aspect = "16/10" }: { src?: string; alt: string; caption: React.ReactNode; aspect?: string }) {
  return (
    <figure className="my-8 font-sans">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full rounded-md border border-rule" />
      ) : (
        <div className="grid place-items-center rounded-md border border-dashed border-rule-strong bg-sunk text-center" style={{ aspectRatio: aspect }}>
          <p className="max-w-xs px-4 text-sm text-ink-3">
            <span className="block font-mono text-2xs text-accent-ink">TODO(you): Figma export</span>
            {alt}
          </p>
        </div>
      )}
      <figcaption className="mt-2 text-sm text-ink-3">{caption}</figcaption>
    </figure>
  );
}

export function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <aside className="my-6 rounded-md border border-rule bg-surface px-4 py-3 font-sans text-sm leading-6 text-ink-2 shadow-1">
      <p className="eyebrow mb-1">{label}</p>
      {children}
    </aside>
  );
}
