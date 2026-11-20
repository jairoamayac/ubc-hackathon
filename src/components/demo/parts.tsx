"use client";

// Small building blocks for the offline demo: shell, nav, avatars, ring, chips, banners, proof image, vote bar,
// verdict card, lock animation, 3D icons. Brand: "Lila y mandarina" (docs/brand/kept-lila/kept-brand.md).
import { ArrowLeft, Check, Home, Loader2, Lock, MessageCircle, User, Users, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { NAMES, type PersonId, type Status } from "@/lib/demo/store";

export type DemoTab = "home" | "group" | "me";

export type IconName =
  | "calendar" | "camera" | "cash" | "chat-check" | "clock" | "coins-stack" | "friends" | "money-bag"
  | "padlock-key" | "piggy-bank" | "shield-check" | "trophy";

/** One of the 12 Kept 3D objects (docs/brand/kept-lila/icons). Decorative unless a label is given. */
export function Icon3D({ name, size = 64, className = "", label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/kept/icons/${name}.png`}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 text-xl font-medium tracking-tight ${className}`}>
      <span className="dot" aria-hidden /> Kept
    </span>
  );
}

export function Shell({ children, tone = "paper" }: { children: ReactNode; tone?: "paper" | "lilac" }) {
  return (
    <div className={`relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col overflow-x-clip ${tone === "lilac" ? "bg-lilac" : "bg-paper"} sm:my-6 sm:min-h-[860px] sm:rounded-[32px] sm:shadow-[0_24px_60px_rgba(46,34,96,0.18)]`}>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

export function ScreenBody({ children }: { children: ReactNode }) {
  return <div className="enter flex flex-1 flex-col gap-4 px-5 pb-4 pt-6">{children}</div>;
}

export function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="iconbtn self-start">
      <ArrowLeft className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Back button, centered title and an optional right slot, like the v5 headers. */
export function TopBar({ onBack, title, right, backLabel = "Back" }: { onBack: () => void; title: string; right?: ReactNode; backLabel?: string }) {
  return (
    <header className="grid grid-cols-[64px_1fr_64px] items-center">
      <button onClick={onBack} aria-label={backLabel} className="iconbtn"><ArrowLeft className="h-5 w-5" aria-hidden /></button>
      <p className="text-center text-[17px] font-medium">{title}</p>
      <span className="flex justify-end whitespace-nowrap text-sm text-muted">{right}</span>
    </header>
  );
}

export function DemoBadge({ children = "Demo" }: { children?: ReactNode }) {
  return <span className="mono rounded-md bg-stone2 px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-widest text-muted">{children}</span>;
}

export function BottomNav({ tab, onTab }: { tab: DemoTab; onTab: (t: DemoTab) => void }) {
  const items: { id: DemoTab; label: string; icon: ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home className="h-5 w-5" aria-hidden /> },
    { id: "group", label: "Group", icon: <Users className="h-5 w-5" aria-hidden /> },
    { id: "me", label: "Me", icon: <User className="h-5 w-5" aria-hidden /> },
  ];
  return (
    <nav aria-label="Main" className="flex justify-between gap-1 rounded-full bg-ink p-2 shadow-[0_12px_28px_rgba(26,26,24,0.28)]">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onTab(it.id)}
          aria-current={tab === it.id ? "page" : undefined}
          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-medium transition ${tab === it.id ? "bg-mandarina text-ink" : "text-paper"}`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </nav>
  );
}

/** Each person has their own pastel, as in the v5 group screen. */
export const PASTEL: Record<PersonId, string> = { martin: "bg-lilac-tint", ana: "bg-sky", ben: "bg-butter", cara: "bg-peach", dani: "bg-mint" };

export function Avatar({ id, size = 36, white = false }: { id: PersonId; size?: number; white?: boolean }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-ink ring-2 ring-white ${white ? "bg-white" : PASTEL[id]}`}
    >
      {NAMES[id][0]}
    </span>
  );
}

export function GrokAvatar({ size = 36 }: { size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.4 }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-lilac ring-2 ring-white">
      G
    </span>
  );
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  invited: { label: "Invited", cls: "bg-white/70 text-muted" },
  on_track: { label: "In progress", cls: "bg-white text-ink" },
  proof_sent: { label: "Proof sent", cls: "bg-white text-deep" },
  disputed: { label: "Disputed", cls: "bg-ink text-white" },
  kept: { label: "Kept", cls: "bg-forest text-white" },
  missed: { label: "Missed", cls: "bg-stone text-ink" },
};
export function StatusChip({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`pill shrink-0 ${s.cls}`}>{s.label}</span>;
}

export function LockedPill({ children }: { children: ReactNode }) {
  return <span className="pill-locked"><Lock className="h-3.5 w-3.5" aria-hidden /> {children}</span>;
}

export function timeLeft(hours: number) {
  if (hours <= 0) return "Time is up";
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

export function UrgencyBanner({ hours }: { hours: number }) {
  if (hours <= 0 || hours >= 24) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-[20px] bg-butter px-4 py-3 text-sm text-ink">
      <Icon3D name="clock" size={40} />
      <p><span className="font-semibold">Your goal is at risk.</span> {hours} hours left and no proof sent yet.</p>
    </div>
  );
}

export function ProgressRing({ percent, label, sub, size = 136 }: { percent: number; label: string; sub?: string; size?: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={sub ? `${label}, ${sub}` : label}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(46,34,96,0.16)" strokeWidth="14" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#2E2260" strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: "stroke-dashoffset 500ms ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-deep">
        <span className="big text-[30px]">{label}</span>
        {sub && <span className="text-[11px]">{sub}</span>}
      </div>
    </div>
  );
}

/** A generic activity screenshot drawn in SVG: distance, date, route. Not any brand's screen. */
export function ProofImage({ km = "21.1", date = "Sat, Nov 21", short = false }: { km?: string; date?: string; short?: boolean }) {
  const route = short ? "M34 134 L62 108 L96 124 L128 90" : "M34 128 C48 96 66 138 92 108 S144 88 164 108 S128 140 90 134 S44 116 34 128";
  return (
    <svg viewBox="0 0 200 160" role="img" aria-label={`Activity screenshot: Run, ${km} kilometers, ${date}`} className="w-full rounded-[20px] bg-white shadow-[0_10px_28px_rgba(26,26,24,0.08)]">
      <rect x="0" y="0" width="200" height="160" rx="14" fill="#FFFFFF" />
      <text x="14" y="24" fontSize="9" fill="#5C5B55">Morning run</text>
      <text x="14" y="52" fontSize="26" fill="#1A1A18" fontWeight="700">{km} km</text>
      <text x="14" y="68" fontSize="8" fill="#5C5B55">{date} · 1:52:40 · 5:19 /km</text>
      <rect x="14" y="78" width="172" height="68" rx="10" fill="#D6E6FF" />
      <path d={route} fill="none" stroke="#2E2260" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="34" cy={short ? 134 : 128} r="4" fill="#FF7A3D" />
    </svg>
  );
}

export function VoteBar({ approve, dispute, total }: { approve: number; dispute: number; total: number }) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-stone" role="img" aria-label={`${approve} approve, ${dispute} dispute, out of ${total}`}>
        <span style={{ width: `${(approve / total) * 100}%` }} className="bg-forest transition-all" />
        <span style={{ width: `${(dispute / total) * 100}%` }} className="bg-ink transition-all" />
      </div>
      <p className="mt-2 text-sm text-muted">{approve + dispute} of {total} votes in · {approve} approve · {dispute} dispute</p>
    </div>
  );
}

export function Check3({ items, step, dark = false }: { items: string[]; step: number; dark?: boolean }) {
  return (
    <ul className="space-y-2" aria-label="Grok Bot checks">
      {items.map((label, i) => {
        const done = step > i;
        const active = step === i;
        return (
          <li key={label} className={`flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0 ${dark ? "border-white/15" : "border-stone"}`}>
            <span className={done ? "" : dark ? "text-white/60" : "text-muted"}>{label}</span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${done ? "border-lilac bg-lilac text-deep" : dark ? "border-white/30 text-white/70" : "border-stone text-muted"}`}>
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function VerdictCard({ confidence, reasons, confirms, needed, total }: { confidence: number; reasons: { label: string; detail: string }[]; confirms: number; needed: number; total: number }) {
  return (
    <section aria-label="Grok Bot proposal" className="surface-lilac p-5 text-sm">
      <Icon3D name="shield-check" size={96} className="float absolute -right-1 -top-1" />
      <span className="pill bg-ink text-white"><GrokAvatar size={18} /> Grok Bot verdict</span>
      <p className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">Proposes: approved</p>
      <p className="mt-1">Confidence <span className="mono font-medium">{confidence}%</span>. The group still decides.</p>
      <ul className="mt-4 space-y-2 border-t border-deep/20 pt-3">
        {reasons.map((r) => (
          <li key={r.label} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-locked text-forest"><Check className="h-3 w-3" aria-hidden /></span>
            <span><span className="font-semibold">{r.label}.</span> {r.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3">{confirms} of {needed} confirmations needed from the {total} friends in the group.</p>
    </section>
  );
}

export function LockAnimation({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const t = setTimeout(() => done.current(), 1700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-lilac text-deep">
      <div className="lock-pop"><Icon3D name="padlock-key" size={220} /></div>
      <p className="mt-4 text-[34px] font-bold tracking-tight">Locked in.</p>
      <p className="mt-1 text-sm">Locked in the contract, not with us.</p>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-deep/40" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} className="enter max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-paper p-6 pb-8 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="sheet-title" className="text-2xl font-semibold leading-tight tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ChatBubble({ from, text, mine }: { from: PersonId | "grok" | "system"; text: string; mine: boolean }) {
  if (from === "system") return <p className="mx-auto max-w-[85%] rounded-full bg-stone2 px-3 py-1 text-center text-xs text-muted">{text}</p>;
  const grok = from === "grok";
  return (
    <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      {grok ? <GrokAvatar size={28} /> : <Avatar id={from} size={28} />}
      <div className={`max-w-[78%] rounded-[20px] px-4 py-2.5 text-sm ${grok ? "bg-ink text-white" : mine ? "bg-lilac text-deep" : "bg-white text-ink shadow-[0_6px_18px_rgba(26,26,24,0.07)]"}`}>
        {grok && <p className="mono mb-0.5 flex items-center gap-1 text-[11px] uppercase tracking-widest text-lilac"><MessageCircle className="h-3 w-3" aria-hidden /> Grok Bot</p>}
        {text}
      </div>
    </div>
  );
}
