// Unit checks for the Crossmint onramp credit rules (worker/onramp.ts): what a completed order is worth,
// whose it is, and that one order is credited once.   node scripts/onramp-check.mts
import { Keypair, PublicKey } from "@solana/web3.js";
import { CROSSMINT, REISSUE_AFTER_MS, creditFor, nextStep, topupTx, type CmOrder, type CreditRecord } from "../worker/onramp.ts";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? "✓" : "✗"} ${name}`); };

const USDC = CROSSMINT.staging.usdc;
const MINT = USDC.split(":")[1];
const me = Keypair.generate().publicKey.toBase58();
const order = (o: Partial<CmOrder> & { status?: string; qty?: string; amount?: string; to?: string; mint?: string } = {}): CmOrder => ({
  orderId: "11111111-2222-3333-4444-555555555555",
  phase: o.phase ?? "completed",
  payment: { status: "completed" },
  lineItems: [{
    executionParams: { amount: o.amount ?? "50" },
    delivery: {
      status: o.status ?? "completed",
      recipient: { walletAddress: o.to ?? me },
      tokens: o.qty === undefined ? [] : [{ contractAddress: o.mint ?? MINT, quantity: o.qty, decimals: 6, locator: `solana:${o.mint ?? MINT}` }],
    },
  }],
});

const c1 = creditFor(order({ qty: "49870000" }), USDC);
ok("delivered amount is credited 1:1 (49.87)", "usd" in c1 && c1.usd === 49.87 && c1.owner === me);
const c2 = creditFor(order(), USDC);
ok("no token list: falls back to the amount paid (50)", "usd" in c2 && c2.usd === 50);
const c3 = creditFor(order({ phase: "delivery", status: "in-progress" }), USDC);
ok("still processing is 'pending', not final", "error" in c3 && c3.pending === true);
const c4 = creditFor(order({ phase: "completed", status: "failed" }), USDC);
ok("failed delivery is final", "error" in c4 && !c4.pending);
ok("more than $500 is refused", "error" in creditFor(order({ amount: "900" }), USDC));
ok("a bad recipient is refused", "error" in creditFor(order({ to: "not-a-key" }), USDC));
ok("two line items are refused", "error" in creditFor({ ...order(), lineItems: [...order().lineItems!, ...order().lineItems!] }, USDC));
const c5 = creditFor(order({ qty: "49870000", mint: "SomeOtherMint111111111111111111111111111111", amount: "50" }), USDC);
ok("another token's quantity is ignored (uses amount paid)", "usd" in c5 && c5.usd === 50);

const now = Date.now();
const rec: CreditRecord = { orderId: "x", owner: me, usd: 50, signature: "sig", issuedAt: now };
ok("first time: issue", nextStep(null, null, now) === "issue");
ok("issued and landed: done (no second credit)", nextStep(rec, true, now + 5_000) === "done");
ok("issued, confirmed flag: done", nextStep({ ...rec, confirmed: true }, null, now + 999_999) === "done");
ok("issued, not landed yet, fresh: wait", nextStep(rec, false, now + 10_000) === "wait");
ok("issued, RPC unsure, old: wait (never risk a double credit)", nextStep(rec, null, now + REISSUE_AFTER_MS + 1) === "wait");
ok("issued, provably not landed, blockhash expired: reissue", nextStep(rec, false, now + REISSUE_AFTER_MS + 1) === "issue");

const sponsor = Keypair.generate(), mint = Keypair.generate().publicKey;
const bh = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";
const t1 = topupTx(sponsor, mint, new PublicKey(me), 50, bh, "kept-onramp:abc"); t1.sign(sponsor);
const t2 = topupTx(sponsor, mint, new PublicKey(me), 50, bh, "kept-onramp:abc"); t2.sign(sponsor);
ok("same order + blockhash gives the identical transaction (a double request cannot land twice)", t1.signature!.equals(t2.signature!));
ok("credit carries the order id as a memo", t1.instructions.some((i) => Buffer.from(i.data).toString() === "kept-onramp:abc"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
