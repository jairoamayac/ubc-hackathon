"use client";

// Small building blocks for the offline demo: shell, nav, avatars, ring, chips, banners, proof image, vote bar,
// verdict card, lock animation. Brand: Forest. No gradients, no shadows. Two font weights.
import { ArrowLeft, Check, Loader2, Lock, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { BottomNav as KeptNav } from "../kept/ui";
import { NAMES, type PersonId, type Status } from "@/lib/demo/store";

export type DemoTab = "home" | "group" | "me";

// Same shell and nav as the live app (components/kept/ui), so the demo matches Kept v5.
export { Shell } from "../kept/ui";

export function ScreenBody({ children }: { children: ReactNode }) {
  return <div className="enter flex flex-1 flex-col gap-4 px-5 pb-4 pt-6">{children}</div>;
}

export function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex min-h-11 items-center gap-1 self-start text-muted">
      <ArrowLeft className="h-5 w-5" aria-hidden /> {label}
    </button>
  );
}

export function DemoBadge({ children = "Demo" }: { children?: ReactNode }) {
  return <span className="rounded-md bg-stone px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">{children}</span>;
}

export function BottomNav({ tab, onTab }: { tab: DemoTab; onTab: (t: DemoTab) => void }) {
  return <KeptNav tab={tab} onTab={onTab} />;
}

export function Avatar({ id, size = 36 }: { id: PersonId; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${id === "martin" ? "bg-forest text-white" : "bg-mint text-forest"}`}
    >
      {NAMES[id][0]}
    </span>
  );
}

export function GrokAvatar({ size = 36 }: { size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.4 }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-medium text-paper">
      G
    </span>
  );
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  invited: { label: "Invited", cls: "border border-stone text-muted" },
  on_track: { label: "On track", cls: "bg-mint text-forest" },
  proof_sent: { label: "Proof sent", cls: "bg-mint text-forest" },
  disputed: { label: "Disputed", cls: "bg-ink text-paper" },
  kept: { label: "Kept", cls: "bg-forest text-white" },
  missed: { label: "Missed", cls: "border border-danger text-danger" },
};
export function StatusChip({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`shrink-0 rounded-full px-3 py-0.5 text-sm ${s.cls}`}>{s.label}</span>;
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
    <div role="status" className="rounded-xl border border-forest bg-mint px-4 py-3 text-sm text-forest">
      <span className="font-medium">Your goal is at risk.</span> {hours} hours left and no proof sent yet.
    </div>
  );
}

export function ProgressRing({ percent, label, sub }: { percent: number; label: string; sub: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative mx-auto h-36 w-36" role="img" aria-label={`${label}, ${sub}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E6E4DD" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#2E2260" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: "stroke-dashoffset 500ms ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-medium tabular-nums">{label}</span>
        <span className="text-xs text-muted">{sub}</span>
      </div>
    </div>
  );
}

/** A generic activity screenshot drawn in SVG: distance, date, route. Not any brand's screen. */
export function ProofImage({ km = "21.1", date = "Sat, Nov 21", short = false }: { km?: string; date?: string; short?: boolean }) {
  const route = short ? "M34 134 L62 108 L96 124 L128 90" : "M34 128 C48 96 66 138 92 108 S144 88 164 108 S128 140 90 134 S44 116 34 128";
  return (
    <svg viewBox="0 0 200 160" role="img" aria-label={`Activity screenshot: Run, ${km} kilometers, ${date}`} className="w-full rounded-xl border border-stone bg-paper">
      <rect x="0" y="0" width="200" height="160" fill="#FAFAF7" />
      <text x="14" y="24" fontSize="9" fill="#5C5B55">Morning run</text>
      <text x="14" y="52" fontSize="26" fill="#1A1A18" fontWeight="500">{km} km</text>
      <text x="14" y="68" fontSize="8" fill="#5C5B55">{date} · 1:52:40 · 5:19 /km</text>
      <rect x="14" y="78" width="172" height="68" rx="8" fill="#DDEFE5" />
      <path d={route} fill="none" stroke="#1F5F4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VoteBar({ approve, dispute, total }: { approve: number; dispute: number; total: number }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-stone" role="img" aria-label={`${approve} approve, ${dispute} dispute, out of ${total}`}>
        <span style={{ width: `${(approve / total) * 100}%` }} className="bg-forest transition-all" />
        <span style={{ width: `${(dispute / total) * 100}%` }} className="bg-ink transition-all" />
      </div>
      <p className="mt-2 text-sm text-muted">{approve + dispute} of {total} votes in · {approve} approve · {dispute} dispute</p>
    </div>
  );
}

export function Check3({ items, step }: { items: string[]; step: number }) {
  return (
    <ul className="space-y-2" aria-label="Grok Bot checks">
      {items.map((label, i) => {
        const done = step > i;
        const active = step === i;
        return (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-forest bg-forest text-white" : "border-stone text-muted"}`}>
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            </span>
            <span className={done ? "text-ink" : "text-muted"}>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function VerdictCard({ confidence, reasons, confirms, needed, total }: { confidence: number; reasons: { label: string; detail: string }[]; confirms: number; needed: number; total: number }) {
  return (
    <section aria-label="Grok Bot proposal" className="rounded-xl border border-forest bg-mint p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-medium text-forest"><GrokAvatar size={24} /> Grok Bot proposes: Approved</p>
        <span className="rounded-full bg-forest px-2.5 py-0.5 text-white tabular-nums">{confidence}%</span>
      </div>
      <ul className="mt-3 space-y-2">
        {reasons.map((r) => (
          <li key={r.label} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
            <span><span className="font-medium">{r.label}.</span> <span className="text-muted">{r.detail}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted">{confirms} of {needed} confirmations needed from the {total} friends in the group.</p>
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
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper">
      <div className="lock-pop flex h-24 w-24 items-center justify-center rounded-full bg-forest text-white">
        <Lock className="h-10 w-10" aria-hidden />
      </div>
      <p className="mt-6 text-2xl font-medium tracking-tight">Locked in.</p>
      <p className="mt-1 text-sm text-muted">Locked in the contract, not with us.</p>
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} className="enter max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl border border-stone bg-paper p-6 pb-8 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="sheet-title" className="text-2xl font-medium leading-tight tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ChatBubble({ from, text, mine }: { from: PersonId | "grok" | "system"; text: string; mine: boolean }) {
  if (from === "system") return <p className="mx-auto max-w-[85%] text-center text-xs text-muted">{text}</p>;
  const grok = from === "grok";
  return (
    <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      {grok ? <GrokAvatar size={28} /> : <Avatar id={from} size={28} />}
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${grok ? "border border-ink bg-paper" : mine ? "bg-forest text-white" : "bg-mint text-ink"}`}>
        {grok && <p className="mb-0.5 flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted"><MessageCircle className="h-3 w-3" aria-hidden /> Grok Bot</p>}
        {text}
      </div>
    </div>
  );
}
