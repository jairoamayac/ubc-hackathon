"use client";

import { ArrowDownRight, ArrowUpRight, ChevronRight, Lock } from "lucide-react";
import type { HomeState, LeagueRow } from "@/lib/house-money/types";
import { Screen, TopBar, usd } from "./ui";

export function HomeScreen({
  home,
  league,
  onCallIt,
  onOpenPlay,
  onLeague,
}: {
  home: HomeState;
  league: LeagueRow[];
  onCallIt: () => void;
  onOpenPlay: () => void;
  onLeague: () => void;
}) {
  const myRank = league.findIndex((r) => r.isMe) + 1;
  const open = home.openPlay;

  return (
    <Screen>
      <TopBar streak={home.streak} />

      {/* The Vault: the only Ink card */}
      <section className="sun rounded-3xl bg-ink p-6 text-paper">
        <p className="flex items-center gap-2 text-sm font-bold text-paper/70">
          <Lock className="h-4 w-4" /> Your Vault · protected
        </p>
        <p className="mt-2 text-5xl font-extrabold tracking-tight">{usd(home.vault.principal)}</p>
        <p className="mt-1 text-sm font-semibold text-paper/70">
          ~{(home.vault.apy * 100).toFixed(0)}% a year · {usd(home.weeklyInterest)} this week
        </p>
      </section>

      {/* House money */}
      <section className="card p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-bold text-muted">House money</p>
            <p className="text-4xl font-extrabold tracking-tight">{usd(home.houseMoney)}</p>
          </div>
          <p className="pb-1 text-right text-xs font-bold text-muted">
            Calls close
            <br />
            Friday 4 PM
          </p>
        </div>
        <div className="bar mt-4">
          <span style={{ width: `${Math.round(home.weekProgress * 100)}%` }} />
        </div>
      </section>

      {open ? (
        <button onClick={onOpenPlay} className="card flex items-center gap-4 p-4 text-left">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-paper">
            {open.direction === "up" ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-muted">Your call this week</span>
            <span className="block text-lg font-extrabold">
              SOL {open.direction === "up" ? "up" : "down"} · {open.boost}x · {usd(open.stake)}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </button>
      ) : (
        <button onClick={onCallIt} disabled={home.houseMoney <= 0} className="btn btn-primary w-full py-5 text-lg">
          Call it: SOL this week?
        </button>
      )}

      <button onClick={onLeague} className="card flex items-center justify-between p-4 text-left">
        <span>
          <span className="block text-sm font-bold text-muted">League · Dorm 4B</span>
          <span className="block text-lg font-extrabold">
            #{myRank} of {league.length}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted" />
      </button>
    </Screen>
  );
}
