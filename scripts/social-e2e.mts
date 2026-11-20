// End-to-end checks of the social layer: bets on real-life moments and challenges where whoever fails pays.
//   RPC_URL=http://127.0.0.1:8899 node scripts/social-e2e.mts      (run scripts/e2e.mts first: it sets up mint + config)
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
    try { await hm.confirm(conn, sig, lastValidBlockHeight); return sig; }
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
const crewOf = async (c: PublicKey) => hm.decodeCrew(c, await info(c));
const memberOf = async (c: PublicKey, o: PublicKey) => hm.decodeMember(hm.memberPda(c, o), await info(hm.memberPda(c, o)));
const vaultOf = async (c: PublicKey) => (await getAccount(conn, hm.crewVaultPda(c))).amount;
async function usdToShares(crew: PublicKey, usd: number) {
  const c = await crewOf(crew);
  return (hm.fromUsd(usd) * (c.totalShares + 1000n)) / ((await vaultOf(crew)) + 1n);
}
async function valueOf(crew: PublicKey, owner: PublicKey) {
  const c = await crewOf(crew); const m = await memberOf(crew, owner);
  return hm.toUsd(hm.assetsForShares(m.shares, c.totalShares, await vaultOf(crew)));
}

console.log(`Kept social e2e on ${cluster}`);

// 1. A crew of four friends with names, each saving $50
const [ana, leo, maya, josh] = [Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()];
const people = { Ana: ana, Leo: leo, Maya: maya, Josh: josh };
const crewId = BigInt(Date.now());
const crew = hm.crewPda(ana.publicKey, crewId);
await send([hm.createCrewIx(sponsor.publicKey, ana.publicKey, mint, crewId, "[test] Party Crew", "🎉")], [ana]);
for (const [name, kp] of Object.entries(people)) {
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  const ixs: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, ata, kp.publicKey, mint),
    createTransferCheckedInstruction(sponsorAta, mint, ata, sponsor.publicKey, hm.fromUsd(50), hm.DECIMALS),
    hm.setProfileIx(sponsor.publicKey, kp.publicKey, name),
  ];
  if (kp !== ana) ixs.push(hm.joinCrewIx(sponsor.publicKey, kp.publicKey, crew));
  ixs.push(hm.depositIx(kp.publicKey, mint, crew, hm.fromUsd(50)));
  await send(ixs, [kp]);
}
const prof = hm.decodeProfile(hm.profilePda(leo.publicKey), await info(hm.profilePda(leo.publicKey)));
assert(prof.name === "Leo" && (await crewOf(crew)).members === 4, "crew + profiles");
ok(`crew "Party Crew" with Ana, Leo, Maya and Josh ($50 each, names on-chain, no SOL)`);

// 2. Bet about Leo
const betId = 1n;
const bet = hm.betPda(crew, betId);
const closesAt = Math.floor(Date.now() / 1000) + WAIT;
await send([hm.createBetIx(sponsor.publicKey, ana.publicKey, crew, betId, "¿Leo besa a la de rojo esta noche?", leo.publicKey, closesAt)], [ana]);
const stakes: [Keypair, 1 | 2, number][] = [[ana, 1, 10], [maya, 2, 5], [josh, 1, 5], [leo, 2, 5]];
const locked: Record<string, bigint> = {};
for (const [kp, side, usd] of stakes) {
  const sh = await usdToShares(crew, usd);
  locked[kp.publicKey.toBase58()] = sh;
  await send([hm.placeBetIx(sponsor.publicKey, kp.publicKey, crew, bet, side, sh)], [kp]);
}
let b = hm.decodeBet(bet, await info(bet));
assert(b.bettors === 4 && b.yesShares > 0n && b.noShares > 0n, "bets placed");
ok(`bet "${b.question}": Ana $10 sí, Josh $5 sí, Maya $5 no, Leo $5 no`);

await expectFail([hm.placeBetIx(sponsor.publicKey, ana.publicKey, crew, bet, 1, 1n)], [ana], "already in use");
ok("one position per person (a second bet by Ana is rejected)");
await expectFail([hm.voteBetIx(sponsor.publicKey, maya.publicKey, crew, bet, 1)], [maya], "BetStillOpen");
ok("nobody can vote while the bet is open");

await sleep((closesAt - Math.floor(Date.now() / 1000) + 2) * 1000);
await expectFail([hm.placeBetIx(sponsor.publicKey, sponsor.publicKey, crew, bet, 1, 1n)], [], "AccountNotInitialized");
await expectFail([hm.voteBetIx(sponsor.publicKey, leo.publicKey, crew, bet, 2)], [leo], "SubjectCantVote");
ok("Leo (the subject) can't vote on his own bet");
await send([hm.voteBetIx(sponsor.publicKey, maya.publicKey, crew, bet, 1)], [maya]);
await expectFail([hm.voteBetIx(sponsor.publicKey, maya.publicKey, crew, bet, 1)], [maya], "already in use");
ok("one vote per person (Maya can't vote twice)");
await expectFail([hm.claimBetIx(ana.publicKey, crew, bet)], [ana], "NotDecided");
await send([hm.voteBetIx(sponsor.publicKey, josh.publicKey, crew, bet, 1)], [josh]);
b = hm.decodeBet(bet, await info(bet));
assert(b.outcome === hm.OUTCOME.YES, "majority decided YES");
ok("2 of 3 eligible votes say yes → resolved: Leo did it");

const before = (await memberOf(crew, ana.publicKey)).shares;
const totalLocked = b.yesShares + b.noShares;
let paid = 0n;
for (const kp of [ana, josh, maya, leo]) {
  const m0 = (await memberOf(crew, kp.publicKey)).shares;
  await send([hm.claimBetIx(kp.publicKey, crew, bet)], [kp]);
  paid += (await memberOf(crew, kp.publicKey)).shares - m0;
}
const anaGain = (await memberOf(crew, ana.publicKey)).shares - before;
assert(anaGain === hm.winnerPayout(locked[ana.publicKey.toBase58()], b.yesShares, b.noShares), "Ana payout matches formula");
assert(paid <= totalLocked && totalLocked - paid < 10n, `shares conserved (paid ${paid} of ${totalLocked})`);
await expectFail([hm.claimBetIx(ana.publicKey, crew, bet)], [ana], "AlreadyClaimed");
ok(`payouts: winners split the losers' $10 pro-rata; shares conserved (dust ${totalLocked - paid}); no double claim`);
ok(`Ana now has $${(await valueOf(crew, ana.publicKey)).toFixed(2)}, Maya $${(await valueOf(crew, maya.publicKey)).toFixed(2)} (stakes kept earning yield)`);

// 3. Challenge: whoever fails pays the rest
const chId = 1n;
const ch = hm.challengePda(crew, chId);
const endsAt = Math.floor(Date.now() / 1000) + WAIT;
await send([hm.createChallengeIx(sponsor.publicKey, ana.publicKey, crew, chId, "Gym 3 veces esta semana", hm.fromUsd(10), endsAt)], [ana]);
for (const kp of [ana, leo, maya]) await send([hm.joinChallengeIx(sponsor.publicKey, kp.publicKey, crew, ch)], [kp]);
let c = hm.decodeChallenge(ch, await info(ch));
assert(c.participants === 3, "3 joined");
ok(`challenge "${c.title}": Ana, Leo and Maya each lock $10`);

await expectFail([hm.voteEntryIx(sponsor.publicKey, maya.publicKey, crew, ch, leo.publicKey, false)], [maya], "BetStillOpen");
await sleep((endsAt - Math.floor(Date.now() / 1000) + 2) * 1000);
await expectFail([hm.joinChallengeIx(sponsor.publicKey, josh.publicKey, crew, ch)], [josh], "BetClosed");
await expectFail([hm.voteEntryIx(sponsor.publicKey, leo.publicKey, crew, ch, leo.publicKey, true)], [leo], "SubjectCantVote");
ok("no joining after the deadline, no voting before it, nobody votes on themselves");

// Only participants verify now (Josh didn't put money in, so he can't vote)
await expectFail([hm.voteEntryIx(sponsor.publicKey, josh.publicKey, crew, ch, leo.publicKey, false)], [josh], "AccountNotInitialized");
const verdicts: [Keypair, Keypair[], boolean][] = [
  [ana, [leo, maya], true], [leo, [ana, maya], false], [maya, [ana, leo], true],
];
for (const [who, voters, passed] of verdicts) {
  for (const v of voters) await send([hm.voteEntryIx(sponsor.publicKey, v.publicKey, crew, ch, who.publicKey, passed)], [v]);
  if (who === ana) await expectFail([hm.claimChallengeIx(ana.publicKey, crew, ch)], [ana], "NotDecided");
}
c = hm.decodeChallenge(ch, await info(ch));
assert(c.decided === 3 && c.failedShares > 0n, "all decided");
ok("crew votes: Ana ✓, Maya ✓, Leo ✗ (skipped the gym)");

const leoBefore = await valueOf(crew, leo.publicKey);
const anaBefore = await valueOf(crew, ana.publicKey);
for (const kp of [ana, leo, maya]) await send([hm.claimChallengeIx(kp.publicKey, crew, ch)], [kp]);
const anaWon = (await valueOf(crew, ana.publicKey)) - anaBefore;
const leoGot = (await valueOf(crew, leo.publicKey)) - leoBefore;
assert(anaWon > 14.6 && anaWon < 14.9, `Ana got back ~$14.75 (got ${anaWon})`);
assert(leoGot < 0.01, "Leo forfeits his stake");
await send([hm.takeFeeIx(sponsor.publicKey, mint, crew, ch)], []);
ok(`settled: Ana and Maya get $10 back + $4.75 each from Leo (5% to the platform); Leo pays $10`);

// 4. Everyone can still leave with what they have
for (const kp of [ana, leo, maya, josh]) {
  const m = await memberOf(crew, kp.publicKey);
  await send([hm.withdrawIx(kp.publicKey, mint, crew, m.shares)], [kp]);
}
const left = hm.toUsd(await vaultOf(crew));
assert(left < 0.05, `vault drained except dust (${left})`);
ok(`everyone withdrew; $${left.toFixed(6)} of rounding dust left in the vault`);
console.log(`\nAll ${step} social checks passed on ${cluster}.`);
