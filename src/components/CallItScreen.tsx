"use client";

import { ArrowDownRight, ArrowLeft, ArrowUpRight, Lock } from "lucide-react";
import { useState } from "react";
import { knockoutMovePct } from "@/lib/house-money/client";
import { RULES, type Direction, type Market } from "@/lib/house-money/types";
import { Screen, usd } from "./ui";

export function CallItScreen({
  market,
  houseMoney,
  vault,
  onBack,
  onLockIn,
}: {
  market: Market;
  houseMoney: number;
  vault: number;
  onBack: () => void;
  onLockIn: (d: Direction, boost: number, stake: number) => void;
}) {
  const [direction, setDirection] = useState<Direction | null>(null);
  const [boost, setBoost] = useState(3);
  const stake = houseMoney;

  return (
    <Screen>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-xl bg-card" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="bar flex-1">
          <span style={{ width: direction ? "66%" : "33%" }} />
        </div>
      </div>

      <div>
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">Solana this week?</h1>
        <p className="font-semibold text-muted">Now {usd(market.price)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["up", "down"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            aria-pressed={direction === d}
            className="tile flex flex-col items-center gap-1 rounded-3xl py-7 text-xl font-extrabold"
          >
            {d === "up" ? <ArrowUpRight className="h-8 w-8" strokeWidth={2.6} /> : <ArrowDownRight className="h-8 w-8" strokeWidth={2.6} />}
            {d === "up" ? "Up" : "Down"}
          </button>
        ))}
      </div>

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-bold text-muted">Boost</p>
          <p className="text-2xl font-extrabold">{boost}x</p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: RULES.maxBoost }, (_, i) => i + 1).map((b) => (
            <button
              key={b}
              onClick={() => setBoost(b)}
              aria-pressed={boost === b}
              className="tile rounded-xl py-2 font-extrabold"
            >
              {b}x
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-muted">
          Knockout if SOL moves {knockoutMovePct(boost).toFixed(0)}% against you. Best case {usd(stake * (1 + RULES.maxWinMultiple))}.
        </p>
      </section>

      <section className="card divide-y divide-stone px-5">
        <div className="flex justify-between py-3.5 font-bold">
          <span className="text-muted">Max you can lose</span>
          <span>{usd(stake)}</span>
        </div>
        <div className="flex items-center justify-between py-3.5 font-bold">
          <span className="flex items-center gap-1.5 text-muted">
            <Lock className="h-4 w-4" /> Your Vault
          </span>
          <span>{usd(vault)} · never moves</span>
        </div>
      </section>

      <div className="flex-1" />
      <button
        disabled={!direction || stake <= 0}
        onClick={() => direction && onLockIn(direction, boost, stake)}
        className="btn btn-primary mb-6 w-full py-4 text-lg"
      >
        {direction ? `Lock in ${usd(stake)}` : "Pick up or down"}
      </button>
    </Screen>
  );
}
