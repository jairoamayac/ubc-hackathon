"use client";

import { Flame, Lock, Share2 } from "lucide-react";
import type { Play } from "@/lib/house-money/types";
import { Screen, usd } from "./ui";

const confettiColors = ["#c4442e", "#1f1d24", "#e9e5df"];

export function ResultScreen({
  play,
  vault,
  streak,
  onContinue,
}: {
  play: Play;
  vault: number;
  streak: number;
  onContinue: () => void;
}) {
  const payout = play.payout ?? 0;
  const delta = payout - play.stake;
  const won = play.state === "won";
  const ko = play.state === "knockout";

  return (
    <Screen>
      {won && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={i}
              className="confetti"
              style={{
                left: `${(i * 41) % 100}%`,
                background: confettiColors[i % confettiColors.length],
                animationDelay: `${(i % 6) * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center gap-3 pt-8">
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-ember-text">
          {won ? "You called it" : ko ? "Knockout" : "Close one"}
        </p>
        <p className={`text-7xl font-extrabold tracking-tight ${won ? "text-gain" : "text-ink"}`}>
          {usd(ko ? -play.stake : delta, { sign: true })}
        </p>
        <p className="text-lg font-semibold text-muted">
          {won
            ? `${usd(payout)} goes back to your house money.`
            : ko
              ? "That one didn't land. You lost this week's house money, nothing more."
              : `${usd(payout)} goes back to your house money.`}
        </p>

        <div className="sun mt-6 flex items-center justify-between rounded-3xl bg-ink p-5 text-paper">
          <span className="flex items-center gap-2 font-bold text-paper/70">
            <Lock className="h-4 w-4" /> Your Vault
          </span>
          <span className="text-2xl font-extrabold">{usd(vault)}</span>
        </div>
        <p className="text-center text-sm font-bold text-muted">Untouched. Always.</p>

        <div className="card mt-4 p-5">
          <p className="text-lg font-extrabold leading-snug">
            {won ? `Turned ${usd(play.stake)} of house money into ${usd(payout)}.` : "Took a swing with house money. Savings never moved."}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm font-bold text-ember-text">
            <Flame className="h-4 w-4 fill-ember" /> {streak}-call streak · #HouseMoney
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3 pb-6">
        <button className="btn btn-quiet px-5 py-4" aria-label="Share">
          <Share2 className="h-5 w-5" />
        </button>
        <button onClick={onContinue} className="btn btn-primary py-4 text-lg">
          Continue
        </button>
      </div>
    </Screen>
  );
}
