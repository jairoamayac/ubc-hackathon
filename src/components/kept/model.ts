// View helpers that turn on-chain rounds into what the v5 screens show. Every money split goes through
// settle() (lib/settlement) with FEE_PERCENT (lib/brand), the same rule the program applies.
import * as hm from "@/lib/house-money/solana/hm";
import { phaseOf, type ChallengeView, type CrewDetail, type EntryView, type Phase } from "@/lib/house-money/solana/live";
import { FEE_PERCENT } from "@/lib/brand";
import { settle } from "@/lib/settlement";
import type { GoalState } from "./ui";

export function entryState(e: EntryView, phase: Phase): GoalState {
  switch (e.entry.status) {
    case hm.ENTRY.PASSED: return "kept";
    case hm.ENTRY.FAILED: return "missed";
    case hm.ENTRY.REFUNDED: return "refunded";
    default: return phase === "open" ? "progress" : "voting";
  }
}

export type Outcome = {
  /** Nobody kept their word (or nobody missed): every stake goes back, no fee. */
  refundAll: boolean;
  forfeited: number;
  fee: number;
  toKeepers: number;
  rows: { e: EntryView; state: GoalState; payout: number }[];
};

/** Who gets what once a round is settled. Refunded entries (tie or no votes) get their stake back. */
export function outcomeOf(v: ChallengeView): Outcome {
  const decided = v.entries.filter((e) => e.entry.status === hm.ENTRY.PASSED || e.entry.status === hm.ENTRY.FAILED);
  const s = settle(decided.map((e) => ({ id: e.entry.address.toBase58(), stake: e.stakeUsd, kept: e.entry.status === hm.ENTRY.PASSED })), FEE_PERCENT);
  const byId = new Map(s.payouts.map((p) => [p.id, p.payout]));
  const rows = v.entries.map((e) => {
    const state = entryState(e, "settled");
    const payout = state === "refunded" ? e.stakeUsd : (byId.get(e.entry.address.toBase58()) ?? e.stakeUsd);
    // Your own line uses the exact on-chain payout when there is one.
    return { e, state, payout: e.isMe && v.mine && phaseOf(v, Infinity) === "settled" ? v.mine.payoutUsd : payout };
  });
  return { refundAll: s.refundAll, forfeited: s.forfeited, fee: s.fee, toKeepers: s.toKeepers, rows };
}

export type MyGoal = { crew: CrewDetail; crewName: string; v: ChallengeView; me: EntryView & { usd: number; payoutUsd: number }; phase: Phase };

export function myGoals(details: Record<string, CrewDetail>, names: Record<string, string>, now: number): MyGoal[] {
  const out: MyGoal[] = [];
  for (const [k, d] of Object.entries(details)) {
    for (const v of d.challenges) {
      if (!v.mine) continue;
      out.push({ crew: d, crewName: names[k] ?? "Group", v, me: v.mine, phase: phaseOf(v, now) });
    }
  }
  return out.sort((a, b) => a.v.challenge.endsAt - b.v.challenge.endsAt);
}

export function percentElapsed(v: ChallengeView, now: number) {
  // Rounds don't store a start time; the id is the creation time in ms.
  const start = Number(v.challenge.challengeId) / 1000;
  const end = v.challenge.endsAt;
  if (!(start > 0 && start < end)) return now >= end ? 100 : 0;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

export function roundTitle(v: ChallengeView) {
  return v.challenge.title.replace(/^Pact:\s*/, "");
}
