import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-ink-inverse hover:bg-ink/85 disabled:bg-ink/40",
  secondary: "bg-surface text-ink border border-rule-strong hover:border-ink-3 hover:bg-raised disabled:text-ink-3",
  ghost: "text-ink-2 hover:text-ink hover:bg-sunk disabled:text-ink-3",
  accent: "bg-accent-wash text-accent-ink border border-accent/50 hover:border-accent",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-sm",
  md: "h-9 px-3.5 text-sm gap-2 rounded-md",
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
