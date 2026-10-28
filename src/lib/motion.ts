/** Motion tokens for Framer Motion; mirrors the CSS variables in src/styles/tokens.css. */
export const duration = { instant: 0.08, fast: 0.14, base: 0.22, slow: 0.36, chart: 0.65 } as const;
export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1.15],
  exit: [0.4, 0, 1, 1],
} as const;
export const spring = { type: "spring", stiffness: 380, damping: 34, mass: 0.8 } as const;
