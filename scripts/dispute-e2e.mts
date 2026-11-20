// End-to-end checks of `open_dispute` on a real cluster (local validator or devnet):
// who may open one, when, once per entry, the KEPT:DisputeOpened log, and that settlement is unaffected.
//   RPC_URL=http://127.0.0.1:8899 node scripts/dispute-e2e.mts     (run scripts/e2e.mts first: it sets up mint + config)
// On devnet pass SPONSOR as the funded fee payer key in keys/sponsor.json (same as the other scripts).
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";
import { parseDisputeEvents } from "../worker/quicknode.ts";

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
    assert(logs.includes(code), `expected ${code}, got: ${logs.slice(-500)}`);
    return;
  }
  assert(false, `transaction should have failed with ${code}`);
}
const info = async (a: PublicKey) => (await conn.getAccountInfo(a))!.data;

console.log(`open_dispute e2e on ${cluster}`);
const [maria, leo, sam, josh] = [Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()];
const crewId = BigInt(Date.now());
const crew = hm.crewPda(maria.publicKey, crewId);
await send([hm.createCrewIx(sponsor.publicKey, maria.publicKey, mint, crewId, "[test] Dispute Crew", "⚖️")], [maria]);
for (const [name, kp] of Object.entries({ Maria: maria, Leo: leo, Sam: sam, Josh: josh })) {
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
const chId = 1n;
const ch = hm.challengePda(crew, chId);
const endsAt = Math.floor(Date.now() / 1000) + WAIT;
await send([hm.createChallengeIx(sponsor.publicKey, maria.publicKey, crew, chId, "Dispute test pact", hm.fromUsd(5), endsAt)], [maria]);
for (const [kp, goal, usd] of [[maria, "Run 21 km by Sunday", 20], [leo, "Gym 3 times", 20], [sam, "No takeout for 7 days", 10]] as [Keypair, string, number][]) {
  await send([hm.joinWithGoalIx(sponsor.publicKey, kp.publicKey, crew, ch, goal, hm.fromUsd(usd))], [kp]);
}
ok("group of four, pact with three participants (Maria, Leo, Sam); Josh has no money in the pact");

// Optional upgrade test: UPGRADE_HOOK upgrades the program NOW, after the pact and stakes exist under the old
// program, so everything below runs on old accounts with the new program.
if (process.env.UPGRADE_HOOK) {
  execSync(process.env.UPGRADE_HOOK, { stdio: "inherit" });
  ok("program upgraded in place while the pact and its stakes already existed");
}

const maEntry = hm.entryPda(ch, maria.publicKey);
const open = (opener: Keypair, target: Keypair, reason: number) => hm.openDisputeIx(sponsor.publicKey, opener.publicKey, ch, target.publicKey, reason);

// 1. Window
await expectFail([open(leo, maria, 1)], [leo], "BetStillOpen");
ok("nobody can dispute before the pact ends");
await sleep((endsAt - Math.floor(Date.now() / 1000) + 2) * 1000);

// 2. Who
await expectFail([open(josh, maria, 1)], [josh], "AccountNotInitialized");
ok("Josh (no money in the pact) cannot open a dispute");
await expectFail([open(leo, maria, 9)], [leo], "BadReason");
ok("unknown reason codes are rejected");

// 3. Leo disputes Maria's proof: log + event + Dispute account
const sig = await send([open(leo, maria, hm.DISPUTE_REASON.PROOF)], [leo]);
const tx = await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
const logs = tx!.meta!.logMessages!;
const line = logs.find((l) => l.includes(hm.DISPUTE_LOG_PREFIX));
assert(line, "the program logs KEPT:DisputeOpened");
assert(line.includes(`challenge=${ch.toBase58()}`) && line.includes(`member=${maria.publicKey.toBase58()}`) && line.includes(`disputer=${leo.publicKey.toBase58()}`) && line.includes("reason=1"), `log fields: ${line}`);
assert(logs.some((l) => l.startsWith("Program data: ")), "an Anchor DisputeOpened event is emitted");
const d = hm.decodeDispute(hm.disputePda(maEntry), await info(hm.disputePda(maEntry)));
assert(d.opener.equals(leo.publicKey) && d.member.equals(maria.publicKey) && d.entry.equals(maEntry) && d.reason === 1, "Dispute account stores opener, member, entry and reason");
ok(`Leo disputes Maria's proof. Log: ${line.replace("Program log: ", "")}`);

// 4. What the Worker's parser extracts from the real transaction logs
const parsed = parseDisputeEvents([[{ signature: sig, slot: tx!.slot, blockTime: tx!.blockTime, logs, success: true }]], hm.PROGRAM_ID.toBase58());
assert(parsed.length === 1 && parsed[0].challenge === ch.toBase58() && parsed[0].member === maria.publicKey.toBase58() && parsed[0].disputer === leo.publicKey.toBase58() && parsed[0].reason === 1, "Worker parser reads the real log");
ok(`Worker parser extracts the event from the real logs: signature ${sig.slice(0, 12)}…, slot ${tx!.slot}`);
if (process.env.WRITE_SAMPLE) {
  fs.writeFileSync(process.env.WRITE_SAMPLE, JSON.stringify({ data: [[{ signature: sig, slot: tx!.slot, blockTime: tx!.blockTime, programInvocations: [], logs, success: true }]], metadata: { network: `solana-${cluster}`, dataset: "programs_with_logs" } }, null, 2));
}

// 5. Once per entry
await expectFail([open(sam, maria, 1)], [sam], "already in use");
ok("a second dispute on the same entry is rejected");

// 6. The owner can appeal their own result
await send([open(sam, sam, hm.DISPUTE_REASON.APPEAL)], [sam]);
ok("Sam appeals his own result (opener = owner is allowed)");

// 7. Settlement is not blocked: confirm, take the fee, collect
const verdicts: [Keypair, Keypair[], boolean][] = [[maria, [leo, sam], true], [sam, [maria, leo], true], [leo, [maria, sam], false]];
for (const [who, voters, passed] of verdicts) for (const v of voters) await send([hm.voteEntryIx(sponsor.publicKey, v.publicKey, crew, ch, who.publicKey, passed)], [v]);
await send([hm.takeFeeIx(sponsor.publicKey, mint, crew, ch)], []);
for (const kp of [maria, sam, leo]) await send([hm.claimChallengeIx(kp.publicKey, crew, ch)], [kp]);
ok("disputed entries still get confirmed, fee taken and results collected (dispute is advisory)");

// 8. After collecting, nothing left to contest
await expectFail([open(maria, leo, 1)], [maria], "AlreadyClaimed");
ok("a collected result can no longer be disputed");

console.log(`\nAll ${step} dispute checks passed on ${cluster}.`);
