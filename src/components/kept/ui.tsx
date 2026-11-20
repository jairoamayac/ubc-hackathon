"use client";

// Kept v5 building blocks ("Lila y mandarina", docs/brand/kept-lila/kept-brand.md). Shared by the live app
// and the offline demo so both look the same.
import { ArrowLeft, Home, Loader2, Lock, User, Users, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export type Tab = "home" | "group" | "me";

export type Icon3DName =
  | "padlock-key" | "coins-stack" | "cash" | "money-bag" | "calendar" | "clock"
  | "shield-check" | "trophy" | "friends" | "camera" | "chat-check" | "piggy-bank";

/** 3D icon: hero or empty-state art only, never inline in text, never below 64px. */
export function Icon3D({ name, size = 96, glow, className = "" }: { name: Icon3DName; size?: number; glow?: boolean; className?: string }) {
  const s = Math.max(64, size);
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={`/kept/icons/${name}.png`} alt="" width={s} height={s} className={`icon3d ${glow ? "" : className}`} />;
  return glow ? <span aria-hidden className={`glow inline-block ${className}`} style={{ width: s, height: s }}>{img}</span> : <span aria-hidden className="contents">{img}</span>;
}

export function Shell({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-paper sm:my-6 sm:min-h-[860px] sm:overflow-hidden sm:rounded-[32px] sm:shadow-[0_20px_50px_rgba(46,34,96,.22)]">
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`enter flex flex-1 flex-col gap-4 px-5 pb-6 pt-5 ${className}`}>{children}</div>;
}

/** Screen header: round back button, centered title, optional right slot. */
export function Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="grid min-h-12 grid-cols-[48px_1fr_48px] items-center">
      {onBack ? (
        <button onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_8px_22px_rgba(26,26,24,.07)]">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : <span />}
      {title ? <h1 className="truncate text-center font-medium">{title}</h1> : <span />}
      <span className="flex justify-end">{right}</span>
    </header>
  );
}

export function Wordmark() {
  return <span className="flex items-center gap-2 text-lg font-medium tracking-tight"><span className="h-2 w-2 rounded-full bg-forest" aria-hidden /> Kept</span>;
}

export function BottomNav({ tab, onTab, groupDisabled }: { tab: Tab; onTab: (t: Tab) => void; groupDisabled?: boolean }) {
  const items: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home className="h-5 w-5" aria-hidden /> },
    { id: "group", label: "Group", icon: <Users className="h-5 w-5" aria-hidden /> },
    { id: "me", label: "Me", icon: <User className="h-5 w-5" aria-hidden /> },
  ];
  return (
    <nav aria-label="Main" className="sticky bottom-3 z-30 mx-5 mt-2 flex h-[64px] items-center gap-1 rounded-full bg-ink px-2 shadow-[0_12px_28px_rgba(26,26,24,.28)]">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onTab(it.id)}
          disabled={it.id === "group" && groupDisabled}
          aria-current={tab === it.id ? "page" : undefined}
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-medium transition disabled:opacity-40 ${tab === it.id ? "bg-mand text-ink" : "text-paper"}`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </nav>
  );
}

export function LockedPill({ children = "Locked" }: { children?: ReactNode }) {
  return <span className="pill bg-[#ddefe5] text-forest"><Lock className="h-3 w-3" aria-hidden /> {children}</span>;
}

/** Status of one person's goal. */
export type GoalState = "progress" | "voting" | "kept" | "missed" | "refunded";
export function StatePill({ state }: { state: GoalState }) {
  switch (state) {
    case "kept": return <span className="pill pill-kept">Kept</span>;
    case "missed": return <span className="pill pill-missed">Missed</span>;
    case "refunded": return <span className="pill pill-progress">Refunded</span>;
    case "voting": return <span className="pill pill-dark">Voting</span>;
    default: return <span className="pill pill-progress">In progress</span>;
  }
}

export function Avatar({ name, size = 36, tone = "bg-lilac-tint" }: { name: string; size?: number; tone?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-violet-deep ring-2 ring-white ${tone}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Percentage ring for the goal hero (Deep violet on Lilac). */
export function Ring({ percent, size = 112 }: { percent: number; size?: number }) {
  const p = Math.max(0, Math.min(100, percent));
  const c = 2 * Math.PI * 40;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(p)}% of the time used`}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(46,34,96,.14)" strokeWidth="12" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#2E2260" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 50 50)" />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[26px]">{Math.round(p)}%</span>
    </span>
  );
}

export function Steps({ step, of }: { step: number; of: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-label="Steps" aria-valuemin={1} aria-valuemax={of} aria-valuenow={step}>
      {Array.from({ length: of }, (_, i) => <i key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-violet-deep" : "bg-stone"}`} />)}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}</p>;
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-danger bg-white px-4 py-3 text-sm text-danger">
      <span>{text}</span>
      {onRetry && <button onClick={onRetry} className="min-h-9 shrink-0 font-medium underline">Try again</button>}
    </div>
  );
}

/** Empty state with 3D art. */
export function Empty({ icon, title, body, children }: { icon: Icon3DName; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-6 text-center">
      <Icon3D name={icon} size={88} />
      <p className="mt-1 text-lg font-medium">{title}</p>
      <p className="text-sm text-muted">{body}</p>
      {children && <div className="mt-3 w-full">{children}</div>}
    </div>
  );
}

export function PreviewBadge({ children = "Preview" }: { children?: ReactNode }) {
  return <span className="rounded-md bg-stone px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted">{children}</span>;
}

/** Accessible bottom sheet: labelled, focus moves in and back, Escape closes. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}
        className="enter max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[24px] bg-paper p-6 pb-8 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="dialog-title" className="text-2xl font-medium leading-tight tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_8px_22px_rgba(26,26,24,.07)]"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function timeLeft(seconds: number) {
  if (seconds <= 0) return "Time is up";
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function dateLabel(secs: number) {
  return new Date(secs * 1000).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
