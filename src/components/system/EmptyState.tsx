import { cn } from "@/lib/cn";

/** Nothing to show yet. Says why and what to do next. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  compact,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-1.5 py-6" : "gap-2.5 py-12", className)}>
      {icon && <div className="mb-1 grid size-9 place-items-center rounded-full border border-dashed border-rule-strong text-ink-3">{icon}</div>}
      <p className={cn("font-medium text-ink", compact ? "text-sm" : "text-base")}>{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
