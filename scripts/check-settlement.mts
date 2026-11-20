// Self check for src/lib/settlement.ts. Run: node scripts/check-settlement.mts
import assert from "node:assert/strict";
import { settle, simulatedYield } from "../src/lib/settlement.ts";

// Product demo (spec 13.2): five people, $50 each, Martin and Ana keep their word.
const FEE = 5;
const demo = settle([
  { id: "martin", stake: 50, kept: true },
  { id: "ana", stake: 50, kept: true },
  { id: "ben", stake: 50, kept: false },
  { id: "cara", stake: 50, kept: false },
  { id: "dani", stake: 50, kept: false },
], FEE);
assert.equal(demo.forfeited, 150);
assert.equal(demo.fee, 7.5);
assert.equal(demo.toKeepers, 142.5);
assert.equal(demo.payouts.find((p) => p.id === "martin")?.payout, 121.25);
assert.equal(demo.payouts.find((p) => p.id === "ana")?.payout, 121.25);
assert.equal(demo.payouts.reduce((s, p) => s + p.payout, 0) + demo.fee, 250);

// Everyone kept: money back, no fee.
const allKept = settle([{ id: "a", stake: 50, kept: true }, { id: "b", stake: 20, kept: true }], FEE);
assert.equal(allKept.fee, 0);
assert.deepEqual(allKept.payouts.map((p) => p.payout), [50, 20]);

// Nobody kept: money back, no fee.
const noneKept = settle([{ id: "a", stake: 50, kept: false }, { id: "b", stake: 20, kept: false }], FEE);
assert.equal(noneKept.refundAll, true);
assert.deepEqual(noneKept.payouts.map((p) => p.payout), [50, 20]);

// Uneven stakes: keepers share by stake.
const uneven = settle([{ id: "a", stake: 100, kept: true }, { id: "b", stake: 50, kept: true }, { id: "c", stake: 60, kept: false }], FEE);
assert.equal(uneven.fee, 3);
assert.equal(uneven.payouts[0].payout, 100 + (57 * 100) / 150);
assert.equal(uneven.payouts[1].payout, 50 + (57 * 50) / 150);

// Simulated yield, spec 13.2: about $0.14 in 5 days on $250 at 4%, platform 35% is about $0.05.
const y = simulatedYield(250, 5, 4, 35);
assert.equal(y.total, 0.14);
assert.equal(y.platform, 0.05);

console.log("settlement checks passed");
