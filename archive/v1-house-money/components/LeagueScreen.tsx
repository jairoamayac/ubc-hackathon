"use client";

import { Flame, Link2 } from "lucide-react";
import type { LeagueRow } from "@/lib/house-money/types";
import { Screen } from "./ui";

export function LeagueScreen({ league }: { league: LeagueRow[] }) {
  return (
    <Screen>
      <div>
        <p className="text-sm font-bold text-muted">Weekly league</p>
        <h1 className="text-[32px] font-extrabold tracking-tight">Dorm 4B</h1>
        <p className="font-semibold text-muted">Ranked by % on house money. No money between friends.</p>
      </div>

      <ol className="card divide-y divide-stone px-4">
        {league.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 py-3.5">
            <span className={`w-5 text-center font-extrabold ${i === 0 ? "text-ember" : "text-muted"}`}>{i + 1}</span>
            <span
              className={`grid h-10 w-10 place-items-center rounded-xl text-sm font-extrabold ${
                r.isMe ? "bg-ink text-paper" : "bg-stone"
              }`}
            >
              {r.avatar}
            </span>
            <span className="flex-1">
              <span className="block font-extrabold">
                {r.name} {r.isMe && <span className="text-sm font-bold text-muted">· you</span>}
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-muted">
                <Flame className="h-3.5 w-3.5" /> {r.streak}
              </span>
            </span>
            <span className={`font-extrabold ${r.returnPct >= 0 ? "text-gain" : "text-ink"}`}>
              {r.returnPct >= 0 ? "+" : "−"}
              {Math.abs(r.returnPct).toFixed(1)}%
            </span>
          </li>
        ))}
      </ol>

      <button className="btn btn-quiet w-full py-4">
        <Link2 className="h-5 w-5" /> Invite friends
      </button>
    </Screen>
  );
}
