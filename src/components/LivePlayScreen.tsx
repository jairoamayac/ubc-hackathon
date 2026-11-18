"use client";

import { ArrowDownRight, ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Market, Play } from "@/lib/house-money/types";
import { DemoTag, Screen, usd } from "./ui";

export function LivePlayScreen({
  play,
  market,
  onBack,
  onDemoSettle,
}: {
  play: Play;
  market: Market;
  onBack: () => void;
  onDemoSettle: (outcome: "win" | "knockout") => void;
}) {
  const up = play.direction === "up";
  // Days from when the call was placed until Friday's close (pure: no Date.now in render).
  const days = Math.max(0, Math.ceil((play.expiresAt - play.openedAt) / 86_400_000));

  return (
    <Screen>
      <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-xl bg-card" aria-label="Back">
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-ink text-paper">
          {up ? <ArrowUpRight className="h-10 w-10" strokeWidth={2.6} /> : <ArrowDownRight className="h-10 w-10" strokeWidth={2.6} />}
        </span>
        <h1 className="text-[32px] font-extrabold tracking-tight">
          SOL {up ? "up" : "down"} · {play.boost}x
        </h1>
        <p className="font-semibold text-muted">
          {usd(play.stake)} of house money · entry {usd(play.entryPrice)}
        </p>
      </div>

      <section className="card divide-y divide-stone px-5">
        <div className="flex justify-between py-3.5 font-bold">
          <span className="text-muted">Now</span>
          <span>{usd(market.price)}</span>
        </div>
        <div className="flex justify-between py-3.5 font-bold">
          <span className="text-muted">Closes</span>
          <span>
            Friday 4 PM · {days} {days === 1 ? "day" : "days"}
          </span>
        </div>
      </section>
      <p className="text-sm font-semibold text-muted">Nothing to do. Your call settles on its own and your Vault never moves.</p>

      <div className="flex-1" />
      <div className="mb-6 space-y-2">
        <p className="flex items-center gap-2 text-sm font-bold text-muted">
          <DemoTag /> Skip to Friday
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onDemoSettle("win")} className="btn btn-primary py-3.5">
            Goes my way
          </button>
          <button onClick={() => onDemoSettle("knockout")} className="btn btn-quiet py-3.5">
            Knockout
          </button>
        </div>
      </div>
    </Screen>
  );
}
