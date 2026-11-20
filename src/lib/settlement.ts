// Pure settlement rule used by the demo and by the result screens: the people who missed leave their stake,
// the platform keeps feePercent (FEE_PERCENT in lib/brand) of what was forfeited, the rest is shared pro rata among the people who kept
// their word (by stake). If nobody missed or nobody kept, everyone gets their stake back and no fee is taken.
// It mirrors the program's take_fee rule; the program stays the source of truth for real money.
export type Member = { id: string; stake: number; kept: boolean };
export type Payout = { id: string; stake: number; kept: boolean; payout: number };
export type Settlement = {
  forfeited: number;
  fee: number;
  toKeepers: number;
  refundAll: boolean;
  payouts: Payout[];
  /** Always equals the sum of all stakes: payouts plus fee. */
  total: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function settle(members: Member[], feePercent: number): Settlement {
  const total = members.reduce((s, m) => s + m.stake, 0);
  const keptStake = members.filter((m) => m.kept).reduce((s, m) => s + m.stake, 0);
  const forfeited = members.filter((m) => !m.kept).reduce((s, m) => s + m.stake, 0);
  const refundAll = forfeited === 0 || keptStake === 0;
  if (refundAll) {
    return { forfeited: 0, fee: 0, toKeepers: 0, refundAll, total, payouts: members.map((m) => ({ id: m.id, stake: m.stake, kept: m.kept, payout: m.stake })) };
  }
  const fee = cents((forfeited * feePercent) / 100);
  const toKeepers = cents(forfeited - fee);
  const payouts = members.map((m) => ({
    id: m.id,
    stake: m.stake,
    kept: m.kept,
    payout: m.kept ? cents(m.stake + (toKeepers * m.stake) / keptStake) : 0,
  }));
  return { forfeited, fee, toKeepers, refundAll, payouts, total };
}

/** Simulated yield on locked money, for the demo only: simple interest over a number of days. */
export function simulatedYield(locked: number, days: number, apyPercent: number, platformPercent: number) {
  const total = cents((locked * (apyPercent / 100) * days) / 365);
  const platform = cents((total * platformPercent) / 100);
  return { total, platform, rest: cents(total - platform) };
}
