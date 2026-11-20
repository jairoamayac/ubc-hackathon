"use client";

// "How much would it hurt to lose?" Replaces the fixed chips (product decision of 20 Nov). The amount is free,
// the coach suggests a number, and the picker nudges when it is too low to matter or far above the suggestion.
import { Minus, Plus, Sparkles } from "lucide-react";
import { STAKE_WARN_MULTIPLE } from "@/lib/brand";
import { stakeAdvice } from "@/lib/coach";
import { usd } from "@/lib/format";

export function StakePicker({ value, onChange, min, max, suggested, label = "How much would it hurt to lose?" }: {
  value: number;
  onChange: (v: number) => void;
  /** Hard minimum (the pact's minimum). */
  min: number;
  /** Optional cap: what the person can afford right now. Above it the form asks to add money. */
  max?: number;
  suggested: number;
  label?: string;
}) {
  const step = value >= 200 ? 25 : 10;
  const set = (v: number) => onChange(Math.max(min, Math.round(v)));
  const advice = stakeAdvice(value, suggested, STAKE_WARN_MULTIPLE);
  const over = max !== undefined && value > max + 1;
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="card flex items-center justify-between gap-2 p-2">
        <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Lock ${usd(step)} less`} className="btn btn-quiet h-11 min-h-11 w-11 px-0">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <label className="flex min-w-0 flex-1 items-center justify-center gap-0.5 text-[32px] font-medium tabular-nums">
          <span aria-hidden>$</span>
          <input
            inputMode="numeric"
            aria-label="Amount to lock in dollars"
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9]/g, ""));
              onChange(Number.isFinite(n) ? Math.min(n, 100000) : min);
            }}
            onBlur={() => set(value)}
            style={{ width: `${String(value).length + 1}ch` }}
            className="bg-transparent text-center outline-none"
          />
        </label>
        <button type="button" onClick={() => set(value + step)} aria-label={`Lock ${usd(step)} more`} className="btn btn-quiet h-11 min-h-11 w-11 px-0">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => set(suggested)} aria-pressed={value === suggested} className="flex min-h-9 items-center gap-1.5 rounded-full bg-lilac-tint px-3 font-medium text-violet-deep">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Suggested {usd(suggested)}
        </button>
        {max !== undefined && <span className="text-muted">You can lock up to {usd(max)} now</span>}
      </div>
      {advice && !over && (
        <p role="status" className={`mt-2 text-sm ${advice.tone === "high" ? "text-danger" : "text-muted"}`}>{advice.text}</p>
      )}
    </fieldset>
  );
}
