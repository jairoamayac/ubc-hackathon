// End-to-end checks of Burn the Boats on a real cluster:
// own goal + own stake, only participants verify, 95% of forfeits to those who did it, 5% to the platform once.
//   RPC_URL=http://127.0.0.1:8899 node scripts/btb-e2e.mts      (run scripts/e2e.mts first: it sets up mint + config)
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const conn = new Connection(RPC, "confirmed");
const cluster = RPC.includes("127.0.0.1") || RPC.includes("localhost") ? "local" : "devnet";
const sponsor = loadOrCreate("sponsor");
const state = JSON.parse(fs.readFileSync(new URL(`../keys/${cluster}.json`, import.meta.url), "utf8"));
const mint = new PublicKey(state.mint);
const sponsorAta = getAssociatedTokenAddressSync(mint, sponsor.publicKey);
const WAIT = Number(process.env.WAIT_SECONDS ?? 8);

let step = 0;
const ok = (msg: string) => console.log(`  ✓ ${++step}. ${msg}`);
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) { console.error(`  ✗ ${msg}`); process.exit(1); }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function send(ixs: TransactionInstruction[], signers: Keypair[]) {
  for (let attempt = 1; ; attempt++) {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: sponsor.publicKey, blockhash, lastValidBlockHeight }).add(...hm.priorityIxs(), ...ixs);
    tx.sign(sponsor, ...signers.filter((s) => !s.publicKey.equals(sponsor.publicKey)));
    const sig = await conn.sendRawTransaction(tx.serialize());
    try { await hm.confirm(conn, sig, lastValidBlockHeight, 90_000); return sig; }
    catch (e) { if (attempt >= 3 || !String(e).includes("expired")) throw e; }
  }
}
async function expectFail(ixs: TransactionInstruction[], signers: Keypair[], code: string) {
  try { await send(ixs, signers); } catch (e) {
    const logs = String((e as { logs?: string[] }).logs ?? (e as Error).message);
    assert(logs.includes(code), `expected ${code}, got: ${logs.slice(0, 300)}`);
    return;
  }
  assert(false, `transaction should have failed with ${code}`);
}
const info = async (a: PublicKey) => (await conn.getAccountInfo(a))!.data;
const vaultOf = async (c: PublicKey) => (await getAccount(conn, hm.crewVaultPda(c))).amount;
async function valueOf(crew: PublicKey, owner: PublicKey) {
  const c = hm.decodeCrew(crew, await info(crew));
  const m = hm.decodeMember(hm.memberPda(crew, owner), await info(hm.memberPda(crew, owner)));
  return hm.toUsd(hm.assetsForShares(m.shares, c.totalShares, await vaultOf(crew)));
}

console.log(`Burn the Boats e2e on ${cluster}`);

// 1. A boat of four friends, $60 each, paid in with "Apple Pay" (sponsor-credited test dollars)
const [maria, leo, sam, josh] = [Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()];
const people = { Maria: maria, Leo: leo, Sam: sam, Josh: josh };
const crewId = BigInt(Date.now());
const crew = hm.crewPda(maria.publicKey, crewId);
await send([hm.createCrewIx(sponsor.publicKey, maria.publicKey, mint, crewId, "[test] Sunday Runners", "⛵")], [maria]);
for (const [name, kp] of Object.entries(people)) {
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  const ixs: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, ata, kp.publicKey, mint),
    createTransferCheckedInstruction(sponsorAta, mint, ata, sponsor.publicKey, hm.fromUsd(60), hm.DECIMALS),
    hm.setProfileIx(sponsor.publicKey, kp.publicKey, name),
  ];
  if (kp !== maria) ixs.push(hm.joinCrewIx(sponsor.publicKey, kp.publicKey, crew));
  ixs.push(hm.depositIx(kp.publicKey, mint, crew, hm.fromUsd(60)));
  await send(ixs, [kp]);
}
ok("boat with Maria, Leo, Sam and Josh; $60 each in; nobody holds SOL");

// 2. A commitment with a $5 minimum; three people join with their own goals and stakes
const chId = 1n;
const ch = hm.challengePda(crew, chId);
const endsAt = Math.floor(Date.now() / 1000) + WAIT;
await send([hm.createChallengeIx(sponsor.publicKey, maria.publicKey, crew, chId, "This week's goals", hm.fromUsd(5), endsAt)], [maria]);
const goals: [Keypair, string, number][] = [[maria, "Run 21 km by Sunday", 20], [leo, "Gym 3 times", 20], [sam, "No takeout for 7 days", 10]];
for (const [kp, goal, usd] of goals) await send([hm.joinWithGoalIx(sponsor.publicKey, kp.publicKey, crew, ch, goal, hm.fromUsd(usd))], [kp]);
const g = hm.decodeGoal(await info(hm.goalPda(hm.entryPda(ch, leo.publicKey))));
assert(g.goal === "Gym 3 times", "goal stored");
ok(`Maria $20 "Run 21 km by Sunday", Leo $20 "Gym 3 times", Sam $10 "No takeout for 7 days" (goals on-chain)`);
await expectFail([hm.joinWithGoalIx(sponsor.publicKey, josh.publicKey, crew, ch, "Read a book", hm.fromUsd(2))], [josh], "StakeTooLow");
ok("a stake below the $5 minimum is rejected");

// 3. Verification rules
await expectFail([hm.voteEntryIx(sponsor.publicKey, sam.publicKey, crew, ch, leo.publicKey, false)], [sam], "BetStillOpen");
await sleep((endsAt - Math.floor(Date.now() / 1000) + 2) * 1000);
await expectFail([hm.voteEntryIx(sponsor.publicKey, josh.publicKey, crew, ch, leo.publicKey, false)], [josh], "AccountNotInitialized");
ok("Josh (no money in) can't verify; nobody verifies before the deadline");
await expectFail([hm.voteEntryIx(sponsor.publicKey, leo.publicKey, crew, ch, leo.publicKey, true)], [leo], "SubjectCantVote");
ok("nobody verifies themselves");

// Maria did it (Leo + Sam), Sam did it (Maria + Leo), Leo didn't (Maria + Sam)
const verdicts: [Keypair, Keypair[], boolean][] = [[maria, [leo, sam], true], [sam, [maria, leo], true], [leo, [maria, sam], false]];
for (const [who, voters, passed] of verdicts) {
  for (const v of voters) await send([hm.voteEntryIx(sponsor.publicKey, v.publicKey, crew, ch, who.publicKey, passed)], [v]);
}
const c = hm.decodeChallenge(ch, await info(ch));
assert(c.decided === 3 && c.failedShares > 0n && c.passedShares > 0n, "all decided");
ok("friends verify: Maria ✓, Sam ✓, Leo ✗ (2 of the other 2 participants each time)");

// 4. Payouts: platform takes 5% once; winners split 95%
await expectFail([hm.claimChallengeIx(josh.publicKey, crew, ch)], [josh], "AccountNotInitialized");
const treasuryBefore = (await getAccount(conn, hm.houseVaultPda())).amount;
await send([hm.takeFeeIx(sponsor.publicKey, mint, crew, ch)], []);
const fee = hm.toUsd((await getAccount(conn, hm.houseVaultPda())).amount - treasuryBefore);
await expectFail([hm.takeFeeIx(sponsor.publicKey, mint, crew, ch)], [], "already in use");
assert(fee > 0.99 && fee < 1.02, `platform got ~5% of Leo's $20 (got ${fee})`);
ok(`platform treasury received $${fee.toFixed(4)} (5% of Leo's $20), exactly once`);

const before = { maria: await valueOf(crew, maria.publicKey), sam: await valueOf(crew, sam.publicKey), leo: await valueOf(crew, leo.publicKey) };
for (const kp of [maria, sam, leo]) await send([hm.claimChallengeIx(kp.publicKey, crew, ch)], [kp]);
const got = {
  maria: (await valueOf(crew, maria.publicKey)) - before.maria,
  sam: (await valueOf(crew, sam.publicKey)) - before.sam,
  leo: (await valueOf(crew, leo.publicKey)) - before.leo,
};
// $19 of forfeits to winners: Maria 2/3 ($12.67), Sam 1/3 ($6.33)
assert(got.maria > 32.6 && got.maria < 32.8, `Maria ~$32.67 (got ${got.maria})`);
assert(got.sam > 16.3 && got.sam < 16.45, `Sam ~$16.33 (got ${got.sam})`);
assert(got.leo < 0.01, "Leo forfeits");
await expectFail([hm.claimChallengeIx(maria.publicKey, crew, ch)], [maria], "AlreadyClaimed");
ok(`payouts: Maria $20 → $${got.maria.toFixed(2)}, Sam $10 → $${got.sam.toFixed(2)}, Leo $20 → $0; no double claim`);

// 5. Everyone can still leave
for (const kp of [maria, leo, sam, josh]) {
  const m = hm.decodeMember(hm.memberPda(crew, kp.publicKey), await info(hm.memberPda(crew, kp.publicKey)));
  await send([hm.withdrawIx(kp.publicKey, mint, crew, m.shares)], [kp]);
}
const left = hm.toUsd(await vaultOf(crew));
assert(left < 0.05, `vault drained except dust (${left})`);
ok(`everyone withdrew; $${left.toFixed(6)} of rounding dust left in the pot`);
console.log(`\nAll ${step} Burn the Boats checks passed on ${cluster}.`);
