import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { BlockIcon, RefreshIcon, WarnIcon } from "./icons";

/**
 * Something failed. Always says what failed, in plain words, and offers the
 * one useful next action. `detail` carries the raw error for developers.
 */
export function ErrorState({
  title,
  children,
  detail,
  onRetry,
  retryLabel = "Try again",
  tone = "error",
  layout = "block",
  className,
}: {
  title: string;
  children?: React.ReactNode;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: "error" | "partial";
  layout?: "block" | "inline";
  className?: string;
}) {
  const Icon = tone === "error" ? BlockIcon : WarnIcon;
  const color = tone === "error" ? "text-block" : "text-warn";
  if (layout === "inline") {
    return (
      <div role="alert" className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm", tone === "error" ? "border-block/30 bg-block-wash" : "border-warn/30 bg-warn-wash", className)}>
        <Icon className={cn("mt-0.5 shrink-0", color)} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{title}</p>
          {children && <div className="text-ink-2">{children}</div>}
          {detail && <p className="mt-1 truncate font-mono text-xs text-ink-3" title={detail}>{detail}</p>}
        </div>
        {onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry} className="-my-0.5">
            <RefreshIcon size={14} /> {retryLabel}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 py-10 text-center", className)}>
      <Icon size={22} className={color} />
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
      {detail && <code className="mt-1 max-w-md rounded-sm bg-sunk px-2 py-1 font-mono text-xs break-words text-ink-3">{detail}</code>}
      {onRetry && (
        <Button size="sm" className="mt-2" onClick={onRetry}>
          <RefreshIcon size={14} /> {retryLabel}
        </Button>
      )}
    </div>
  );
}
