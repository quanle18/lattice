import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

// ── cn ───────────────────────────────────────────────────────────────────────

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed select-none whitespace-nowrap";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-signal-500 text-white hover:bg-signal-400 active:bg-signal-600 shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_12px_30px_-14px_rgba(58,98,240,0.9)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.16)_inset,0_16px_40px_-14px_rgba(58,98,240,1)]",
  secondary:
    "bg-ink-700 text-parchment-100 hover:bg-ink-600 border border-white/10 hover:border-white/20",
  ghost: "text-parchment-300 hover:text-parchment-100 hover:bg-white/5",
  danger: "bg-rose-500/90 text-white hover:bg-rose-500",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-12 px-6 text-[0.95rem] rounded-xl",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section" | "li";
}) {
  return <Tag className={cn("surface p-5", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-parchment-100">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-parchment-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "signal" | "aurora" | "amber" | "rose" | "outline";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-white/[0.06] text-parchment-300 border-white/10",
  signal: "bg-signal-500/15 text-signal-200 border-signal-400/25",
  aurora: "bg-aurora-500/15 text-aurora-400 border-aurora-500/25",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  rose: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  outline: "bg-transparent text-parchment-400 border-white/12",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide",
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Section heading ──────────────────────────────────────────────────────────

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-signal-300">{eyebrow}</p>
        ) : null}
        <h2 id={id} className="text-2xl font-semibold text-parchment-100 sm:text-3xl">
          {title}
        </h2>
        {description ? <p className="mt-3 text-sm leading-relaxed text-parchment-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-12 text-center">
      {icon ? <div className="mb-4 text-parchment-500">{icon}</div> : null}
      <p className="text-sm font-medium text-parchment-200">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-parchment-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// ── Icons (inline, dependency-free) ──────────────────────────────────────────

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={cn("h-5 w-5", className)} aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

export type IconName =
  | "search" | "upload" | "book" | "graph" | "sparkle" | "link" | "check"
  | "alert" | "chevron-right" | "chevron-down" | "close" | "bookmark"
  | "shield" | "scale" | "globe" | "file" | "layers" | "compass" | "user"
  | "logout" | "external" | "clock" | "database" | "lightbulb" | "target";

const ICON_PATHS: Record<IconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2z" /><path d="M4 19a2 2 0 0 1 2-2h12" /></>,
  graph: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="10" cy="18" r="2.5" /><path d="M8.2 7.1 15.6 8M7.4 8.2 9.4 15.6M16.5 10.2 11.4 16.4" /></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 9v5M12 17h.01" /></>,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  scale: <><path d="M12 3v18M7 21h10" /><path d="M5 8h14M5 8l-2 5a3 3 0 0 0 6 0zM19 8l2 5a3 3 0 0 1-6 0z" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h10" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  database: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  lightbulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 2h5.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
};
