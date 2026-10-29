import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover disabled:bg-brand/40 disabled:text-on-brand/60",
  secondary: "bg-transparent text-ink border border-rule-strong hover:border-ink-3 hover:bg-surface disabled:text-ink-3",
  ghost: "text-ink-2 hover:text-ink hover:bg-sunk disabled:text-ink-3",
  accent: "bg-accent-wash text-accent-ink border border-accent/50 hover:border-accent",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-3 text-xs gap-1.5 rounded-full",
  md: "h-9 px-4 text-sm gap-2 rounded-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** The one button. Icon-only buttons must pass aria-label. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});
