"use client";

import { Flame, Home, Trophy, User, Zap } from "lucide-react";
import type { ReactNode } from "react";

export const usd = (n: number, opts: { sign?: boolean } = {}) => {
  const s = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (!opts.sign) return n < 0 ? `−${s}` : s;
  return n >= 0 ? `+${s}` : `−${s}`;
};

export function TopBar({ streak }: { streak: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-lg font-extrabold tracking-tight">house money</span>
      <span className="flex items-center gap-1 text-sm font-extrabold text-ember-text" aria-label={`${streak} call streak`}>
        <Flame className="h-4 w-4 fill-ember" /> {streak}
      </span>
    </div>
  );
}

export type Tab = "home" | "call" | "league" | "profile";

export function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home className="h-5 w-5" /> },
    { id: "call", label: "Call it", icon: <Zap className="h-5 w-5" /> },
    { id: "league", label: "League", icon: <Trophy className="h-5 w-5" /> },
    { id: "profile", label: "Me", icon: <User className="h-5 w-5" /> },
  ];
  return (
    <nav className="glass sticky bottom-3 mx-4 mt-6 flex justify-around rounded-2xl p-1.5">
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onTab(it.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold transition ${
              active ? "bg-ink text-paper" : "text-muted"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="enter flex flex-1 flex-col gap-4 px-5 pt-6">{children}</div>;
}

export function DemoTag() {
  return (
    <span className="rounded-md bg-stone px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-muted">
      Demo
    </span>
  );
}
