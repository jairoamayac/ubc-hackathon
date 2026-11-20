// End-to-end check of the house_money program on a real cluster (local validator or devnet).
//   RPC_URL=http://127.0.0.1:8899 node scripts/e2e.ts
// Every step asserts on-chain state; the script exits non-zero on the first broken invariant.
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, type TransactionInstruction } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, transfer } from "@solana/spl-token";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const conn = new Connection(RPC, "confirmed");
const cluster = RPC.includes("127.0.0.1") || RPC.includes("localhost") ? "local" : "devnet";
const sponsor = loadOrCreate("sponsor");
const stateFile = new URL(`../keys/${cluster}.json`, import.meta.url);
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

let step = 0;
const ok = (msg: string) => console.log(`  ✓ ${++step}. ${msg}`);
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) { console.error(`  ✗ ${msg}`); process.exit(1); }
}
const usd = (u: bigint) => `$${hm.toUsd(u).toFixed(6)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(ixs: TransactionInstruction[], signers: Keypair[]) {
  const tx = new Transaction().add(...hm.priorityIxs(), ...ixs);
  tx.feePayer = sponsor.publicKey; // people never hold SOL: the app sponsors every fee
  return sendAndConfirmTransaction(conn, tx, [sponsor, ...signers.filter((s) => !s.publicKey.equals(sponsor.publicKey))]);
}
async function expectFail(ixs: TransactionInstruction[], signers: Keypair[], code: string) {
  try { await send(ixs, signers); } catch (e) {
    const logs = String((e as { logs?: string[] }).logs ?? (e as Error).message);
    assert(logs.includes(code), `expected ${code}, got: ${logs.slice(0, 300)}`);
    return;
  }
  assert(false, `transaction should have failed with ${code}`);
}
const bal = async (a: PublicKey) => (await getAccount(conn, a)).amount;
async function crew(addr: PublicKey) { return hm.decodeCrew(addr, (await conn.getAccountInfo(addr))!.data); }
async function member(addr: PublicKey) { return hm.decodeMember(addr, (await conn.getAccountInfo(addr))!.data); }

console.log(`Kept e2e (pots and shares) on ${cluster} (${RPC})`);
console.log(`  program ${hm.PROGRAM_ID.toBase58()}  sponsor ${sponsor.publicKey.toBase58()}`);

// 1. Test dollar (hmUSD) and sponsor reserve
if (!state.mint) { state.mint = (await createMint(conn, sponsor, sponsor.publicKey, null, hm.DECIMALS)).toBase58(); save(); }
const mint = new PublicKey(state.mint);
const sponsorAta = (await getOrCreateAssociatedTokenAccount(conn, sponsor, mint, sponsor.publicKey)).address;
if ((await bal(sponsorAta)) < 50_000_000_000n) await mintTo(conn, sponsor, mint, sponsorAta, sponsor, 100_000_000_000n);
ok(`hmUSD mint ${mint.toBase58()} with sponsor reserve ${usd(await bal(sponsorAta))}`);

// 2. Config + vaults (5% a year, time-warped for the demo; 20 s calls on local)
const args: hm.ConfigArgs = {
  apyBps: 500, timeWarp: Number(process.env.TIME_WARP ?? 100_000), callDuration: Number(process.env.CALL_SECONDS ?? 20),
  maxBoost: 5, maxWinMultiple: 2, maxPriceAge: Number(process.env.MAX_PRICE_AGE ?? 7_200),
};
const cfgInfo = await conn.getAccountInfo(hm.configPda());
if (!cfgInfo) await send([hm.initConfigIx(sponsor.publicKey, mint, args)], []);
else await send([hm.updateConfigIx(sponsor.publicKey, args)], []);
const cfg = hm.decodeConfig((await conn.getAccountInfo(hm.configPda()))!.data);
assert(cfg.mint.equals(mint) && cfg.apyBps === 500 && cfg.maxBoost === 5, "config stored");
ok(`config: APY ${cfg.apyBps / 100}%, time warp ${cfg.timeWarp}x, calls ${cfg.callDuration}s, boost ≤ ${cfg.maxBoost}x`);

// 3. Fund the yield reserve and the house pool
for (const v of [hm.yieldVaultPda(), hm.houseVaultPda()]) {
  if ((await bal(v)) < 1_000_000_000n) await transfer(conn, sponsor, sponsorAta, v, sponsor, 5_000_000_000n);
}
ok(`yield reserve ${usd(await bal(hm.yieldVaultPda()))}, house pool ${usd(await bal(hm.houseVaultPda()))}`);

// 4. Two friends top up with "Apple Pay" (the sponsor credits test dollars)
const ana = Keypair.generate(), leo = Keypair.generate(), mallory = Keypair.generate();
const ata: Record<string, PublicKey> = {};
for (const [name, kp] of [["ana", ana], ["leo", leo], ["mallory", mallory]] as const) {
  ata[name] = (await getOrCreateAssociatedTokenAccount(conn, sponsor, mint, kp.publicKey)).address;
  await transfer(conn, sponsor, sponsorAta, ata[name], sponsor, 100_000_000n);
}
assert((await bal(ata.ana)) === 100_000_000n, "ana topped up");
ok("Ana, Leo and Mallory topped up $100 each (simulated Apple Pay), zero SOL in their wallets");

// 5. Ana creates a crew, Leo joins
const crewId = BigInt(Date.now());
const crewAddr = hm.crewPda(ana.publicKey, crewId);
await send([hm.createCrewIx(sponsor.publicKey, ana.publicKey, mint, crewId, "[test] Austin Crew", "🤠")], [ana]);
await send([hm.joinCrewIx(sponsor.publicKey, leo.publicKey, crewAddr)], [leo]);
let c = await crew(crewAddr);
assert(c.name === "[test] Austin Crew" && c.members === 2, "crew created with 2 members");
ok(`crew "${c.name}" ${c.emoji} created, ${c.members} members`);

// 6. Deposits
await send([hm.depositIx(ana.publicKey, mint, crewAddr, 50_000_000n)], [ana]);
await send([hm.depositIx(leo.publicKey, mint, crewAddr, 80_000_000n)], [leo]);
c = await crew(crewAddr);
const vault = hm.crewVaultPda(crewAddr);
assert(c.totalPrincipal === 130_000_000n, "principal tracked");
assert((await bal(vault)) >= 130_000_000n, "vault holds deposits");
ok(`deposits: Ana $50 + Leo $80 → crew vault ${usd(await bal(vault))}`);

// 7. Principal is protected: staking before any yield must fail
const anaMember = hm.memberPda(crewAddr, ana.publicKey);
await expectFail([hm.openCallIx(sponsor.publicKey, ana.publicKey, mint, crewAddr, 0, 5, 10_000_000n)], [ana], "PrincipalIsProtected");
ok("staking $10 of savings is rejected on-chain (PrincipalIsProtected)");

// 8. Strangers cannot touch a member's money
await expectFail([hm.withdrawIx(mallory.publicKey, mint, crewAddr, 1n)], [mallory], "AccountNotInitialized");
ok("Mallory cannot withdraw from a crew she is not in");

// 9. Yield accrues from the reserve
await sleep(6_000);
await send([hm.accrueIx(mint, crewAddr)], []);
c = await crew(crewAddr);
assert(c.yieldPaid > 0n, "yield paid");
let a = await member(anaMember);
const anaValue = hm.assetsForShares(a.shares, c.totalShares, await bal(vault));
assert(anaValue > a.principal, "Ana's value grew above principal");
ok(`yield paid to the crew: ${usd(c.yieldPaid)}; Ana's $50 is now ${usd(anaValue)}`);

// 10. Tryhard mode: Ana calls SOL up 5x with exactly her yield
const playable = anaValue - a.principal;
const stake = playable > 1n ? playable - 1n : playable;
await expectFail([hm.openCallIx(sponsor.publicKey, ana.publicKey, mint, crewAddr, 0, 5, playable + 1_000_000n)], [ana], "PrincipalIsProtected");
await send([hm.openCallIx(sponsor.publicKey, ana.publicKey, mint, crewAddr, 0, 5, stake)], [ana]);
const callAddr = hm.callPda(anaMember);
const call = hm.decodeCall(callAddr, (await conn.getAccountInfo(callAddr))!.data);
a = await member(anaMember);
assert(a.openCall && call.stake === stake && call.boost === 5, "call opened");
const entry = Number(call.entryPrice) * 10 ** call.expo;
ok(`Ana called SOL ↑ 5x with ${usd(stake)} of yield at Pyth price $${entry.toFixed(4)}`);

// 11. Withdrawals are locked while a call is open; settling before expiry fails
await expectFail([hm.withdrawIx(ana.publicKey, mint, crewAddr, 1n)], [ana], "CallOpen");
await expectFail([hm.settleCallIx(sponsor.publicKey, mint, crewAddr, ana.publicKey)], [], "CallNotExpired");
ok("withdraw while the call is open and early settlement are both rejected");

// 12. Settle after expiry with the Pyth price
const wait = Math.max(0, call.expiresAt * 1000 - Date.now()) + 3_000;
console.log(`    … waiting ${Math.round(wait / 1000)} s for the call to expire`);
await sleep(wait);
const houseBefore = await bal(hm.houseVaultPda());
await send([hm.settleCallIx(sponsor.publicKey, mint, crewAddr, ana.publicKey)], []);
a = await member(anaMember);
assert(!a.openCall && a.callsPlayed === 1, "call settled");
assert((await conn.getAccountInfo(callAddr)) === null, "call account closed");
const houseAfter = await bal(hm.houseVaultPda());
const payout = houseBefore - houseAfter;
ok(`settled: payout ${usd(payout)} back into the crew (house pool ${usd(houseBefore)} → ${usd(houseAfter)})`);

// 13. Ana's savings survived the call
c = await crew(crewAddr);
const anaAfter = hm.assetsForShares(a.shares, c.totalShares, await bal(vault));
assert(anaAfter >= a.principal, "principal intact after the call");
ok(`Ana's savings after the call: ${usd(anaAfter)} (principal ${usd(a.principal)} intact)`);

// 14. Leo leaves with at least what he put in
const l = await member(hm.memberPda(crewAddr, leo.publicKey));
const before = await bal(ata.leo);
await send([hm.withdrawIx(leo.publicKey, mint, crewAddr, l.shares)], [leo]);
const got = (await bal(ata.leo)) - before;
assert(got >= 80_000_000n, `Leo got back ${got}`);
ok(`Leo withdrew everything: ${usd(got)} for $80 deposited`);

// 15. Leaderboard data is readable straight from the chain
const all = await conn.getProgramAccounts(hm.PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: (await import("bs58")).default.encode(Uint8Array.from(hm.ACCOUNT_DISC.Crew)) } }] });
assert(all.length >= 1, "crews listed");
ok(`${all.length} crew(s) listed for the leaderboard via getProgramAccounts`);

state.lastCrew = crewAddr.toBase58();
save();
console.log(`\nAll ${step} checks passed on ${cluster}.`);
