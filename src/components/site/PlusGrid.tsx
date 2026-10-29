/** Faint plus-sign grid behind the top of every page. Decorative; fades out downward. */
export function PlusGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] w-full"
      style={{ maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 100%)" }}
    >
      <defs>
        <pattern id="plus-grid" width="44" height="44" patternUnits="userSpaceOnUse" x="22" y="22">
          <path d="M-4 0h8M0 -4v8" stroke="var(--grid)" strokeWidth="1" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#plus-grid)" />
    </svg>
  );
}
