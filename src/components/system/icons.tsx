import type { SVGProps } from "react";

/** 16px stroke icons drawn for this system. Decorative by default; pass aria-label to expose. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
  const labelled = rest["aria-label"] !== undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => base({ ...p, children: <path d="M3.5 8.5l3 3 6-7" /> });
export const WarnIcon = (p: IconProps) =>
  base({ ...p, children: <><path d="M8 2.5l6 11H2l6-11z" /><path d="M8 6.5v3" /><circle cx="8" cy="11.6" r="0.4" fill="currentColor" /></> });
export const BlockIcon = (p: IconProps) =>
  base({ ...p, children: <><path d="M5.5 2h5L14 5.5v5L10.5 14h-5L2 10.5v-5L5.5 2z" /><path d="M6 6l4 4M10 6l-4 4" /></> });
export const PendingIcon = (p: IconProps) => base({ ...p, children: <circle cx="8" cy="8" r="5.5" strokeDasharray="2 2.6" /> });
export const SkipIcon = (p: IconProps) => base({ ...p, children: <><circle cx="8" cy="8" r="5.5" /><path d="M5.5 8h5" /></> });
export const CopyIcon = (p: IconProps) =>
  base({ ...p, children: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5V3.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2" /></> });
export const UndoIcon = (p: IconProps) => base({ ...p, children: <><path d="M5 4L2.5 6.5 5 9" /><path d="M2.5 6.5H10a3.5 3.5 0 010 7H7" /></> });
export const CloseIcon = (p: IconProps) => base({ ...p, children: <path d="M4 4l8 8M12 4l-8 8" /> });
export const EnterIcon = (p: IconProps) => base({ ...p, children: <><path d="M13 3.5v4a2 2 0 01-2 2H3" /><path d="M6 6.5l-3 3 3 3" /></> });
export const SunIcon = (p: IconProps) =>
  base({ ...p, children: <><circle cx="8" cy="8" r="2.75" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></> });
export const MoonIcon = (p: IconProps) => base({ ...p, children: <path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z" /> });
export const MonitorIcon = (p: IconProps) => base({ ...p, children: <><rect x="2" y="2.5" width="12" height="8.5" rx="1.5" /><path d="M5.5 14h5M8 11v3" /></> });
export const CodeIcon = (p: IconProps) => base({ ...p, children: <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" /> });
export const TableIcon = (p: IconProps) => base({ ...p, children: <><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M2 6h12M2 9.5h12M6.5 6v7.5" /></> });
export const ChevronRight = (p: IconProps) => base({ ...p, children: <path d="M6 3.5L10.5 8 6 12.5" /> });
export const ChevronLeft = (p: IconProps) => base({ ...p, children: <path d="M10 3.5L5.5 8l4.5 4.5" /> });
export const ChevronDown = (p: IconProps) => base({ ...p, children: <path d="M3.5 6L8 10.5 12.5 6" /> });
export const PencilIcon = (p: IconProps) => base({ ...p, children: <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z" /> });
export const ShieldIcon = (p: IconProps) => base({ ...p, children: <><path d="M8 1.75l5 2v4c0 3.2-2.2 5.4-5 6.5-2.8-1.1-5-3.3-5-6.5v-4l5-2z" /><path d="M5.75 8l1.6 1.6 2.9-3.1" /></> });
export const DatabaseIcon = (p: IconProps) =>
  base({ ...p, children: <><ellipse cx="8" cy="3.75" rx="5" ry="1.75" /><path d="M3 3.75v8.5c0 1 2.2 1.75 5 1.75s5-.75 5-1.75v-8.5" /><path d="M3 8c0 1 2.2 1.75 5 1.75S13 9 13 8" /></> });
export const RefreshIcon = (p: IconProps) => base({ ...p, children: <><path d="M13 3.5v3h-3" /><path d="M12.6 6.5A5 5 0 103.4 9.5" /></> });
export const InfoIcon = (p: IconProps) => base({ ...p, children: <><circle cx="8" cy="8" r="6" /><path d="M8 7.25v4" /><circle cx="8" cy="5" r="0.4" fill="currentColor" /></> });
export const ArrowRight = (p: IconProps) => base({ ...p, children: <path d="M3 8h10M9 4l4 4-4 4" /> });
export const PlayIcon = (p: IconProps) => base({ ...p, children: <path d="M5 3.5v9l7.5-4.5L5 3.5z" /> });

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className={`motion-safe:animate-spin ${className ?? ""}`}>
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M8 2.5a5.5 5.5 0 015.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
