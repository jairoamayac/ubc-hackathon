// Real yield end to end: a crew supplies its dollars to Kamino Lend (klend) on devnet, a borrower
// pays interest, and the crew redeems more than it supplied.
//   HM_PROGRAM_ID=<program> RPC_URL=https://api.devnet.solana.com node scripts/kamino-e2e.mts
// Needs keys/kamino-devnet.json: { market, reserve, pythOracle } (our Kamino market on devnet).
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, type TransactionInstruction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
const sponsor = loadOrCreate("sponsor");
const kfile = JSON.parse(fs.readFileSync(new URL(`../keys/${process.env.KAMINO_FILE ?? "kamino-devnet.json"}`, import.meta.url), "utf8"));
const NEED_INTEREST = process.env.NEED_INTEREST !== "0";
const k: hm.KaminoReserve = { reserve: new PublicKey(kfile.reserve), market: new PublicKey(kfile.market), pythOracle: new PublicKey(kfile.pythOracle) };
const mint = new PublicKey(kfile.mint);
const SUPPLY = hm.fromUsd(Number(process.env.SUPPLY_USD ?? 20));
const WAIT = Number(process.env.WAIT_SECONDS ?? 90);
const JOIN = hm.fromUsd(10);

let step = 0;
const ok = (msg: string) => console.log(`  ✓ ${++step}. ${msg}`);
function assert(cond: unknown, msg: string): asserts cond { if (!cond) { console.error(`  ✗ ${msg}`); process.exit(1); } }
const usd = (u: bigint) => `$${hm.toUsd(u).toFixed(6)}`;
const ex = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
async function send(ixs: TransactionInstruction[], signers: Keypair[] = []) {
  const tx = new Transaction().add(...hm.priorityIxs(), ...ixs);
  tx.instructions[0] = (await import("@solana/web3.js")).ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
  tx.feePayer = sponsor.publicKey;
  return sendAndConfirmTransaction(conn, tx, [sponsor, ...signers], { commitment: "confirmed", maxRetries: 10 });
}
const raw = async (a: PublicKey) => (await conn.getAccountInfo(a))!.data;
async function expectFail(ixs: TransactionInstruction[], signers: Keypair[], name: string) {
  try {
    await send(ixs, signers);
  } catch (e) {
    const text = `${(e as Error).message} ${((e as { logs?: string[] }).logs ?? []).join(" ")}`;
    assert(text.includes(name), `expected ${name}, got: ${text.slice(0, 300)}`);
    return;
  }
  assert(false, `expected ${name}, but the transaction went through`);
}
async function newMember(usdAmount: bigint) {
  const kp = Keypair.generate();
  const ata = (await getOrCreateAssociatedTokenAccount(conn, sponsor, mint, kp.publicKey)).address;
  await mintTo(conn, sponsor, mint, ata, sponsor, usdAmount);
  return { kp, ata };
}
const sharesOf = async (crew: PublicKey, owner: PublicKey) => hm.decodeMember(hm.memberPda(crew, owner), await raw(hm.memberPda(crew, owner))).shares;

console.log(`Kept real yield via Kamino Lend on devnet`);
console.log(`  program ${hm.PROGRAM_ID.toBase58()}  klend ${hm.KLEND_PROGRAM_ID.toBase58()}`);
console.log(`  market ${k.market.toBase58()}  reserve ${k.reserve.toBase58()}`);

// 1. Config on this program, pointing at our Kamino reserve. The simulated yield is off (APY 0).
const cfgInfo = await conn.getAccountInfo(hm.configPda());
if (!cfgInfo) await send([hm.initConfigIx(sponsor.publicKey, mint, { apyBps: 0, timeWarp: 1, callDuration: 60, maxBoost: 5, maxWinMultiple: 5, maxPriceAge: 120 })]);
let s1 = "already set";
try {
  s1 = ex(await send([hm.setKaminoReserveIx(sponsor.publicKey, k.reserve)]));
} catch (e) {
  // Set once by design; a second run finds it already pointing at a reserve.
  assert(String((e as { logs?: string[] }).logs ?? "").includes("KaminoReserveSet"), `set_kamino_reserve failed: ${(e as Error).message}`);
}
ok(`config: simulated APY 0%, Kamino reserve set (${s1})`);

// 2. A crew and a member who adds dollars.
const alice = Keypair.generate();
const aliceAta = (await getOrCreateAssociatedTokenAccount(conn, sponsor, mint, alice.publicKey)).address;
await mintTo(conn, sponsor, mint, aliceAta, sponsor, SUPPLY);
const crewId = BigInt(Date.now());
const crew = hm.crewPda(alice.publicKey, crewId);
await send([hm.createCrewIx(sponsor.publicKey, alice.publicKey, mint, crewId, "[test] Kamino crew", "")], [alice]);
const s2 = await send([hm.depositIx(alice.publicKey, mint, crew, SUPPLY)], [alice]);
const vault = hm.crewVaultPda(crew);
assert((await getAccount(conn, vault)).amount === SUPPLY, "crew vault holds the deposit");
ok(`crew ${crew.toBase58()} holds ${usd(SUPPLY)} (${ex(s2)})`);

// 3. The crew supplies everything to Kamino (amount 0 = the whole vault). The vault empties.
const s3 = await send([hm.refreshReserveIx(k), hm.kaminoSupplyIx(sponsor.publicKey, mint, crew, k, 0n)]);
const kp = hm.decodeCrewKamino(await raw(crew));
assert((await getAccount(conn, vault)).amount === 0n, "vault emptied into Kamino");
assert(kp.principal === SUPPLY && kp.ctokens > 0n, "crew records Kamino principal and cTokens");
const ctokenAta = (await import("@solana/spl-token")).getAssociatedTokenAddressSync(hm.kaminoAccounts(k).collMint, crew, true);
assert((await getAccount(conn, ctokenAta)).amount === kp.ctokens, "crew PDA owns the cTokens");
ok(`supplied ${usd(SUPPLY)} to Kamino, crew PDA holds ${kp.ctokens} cTokens (${ex(s3)})`);

// 4. Guards: nobody can price shares while money sits in Kamino, and only the operator can supply.
const bob = await newMember(JOIN);
await send([hm.joinCrewIx(sponsor.publicKey, bob.kp.publicKey, crew)], [bob.kp]);
await expectFail([hm.depositIx(bob.kp.publicKey, mint, crew, JOIN)], [bob.kp], "KaminoNotRedeemed");
await expectFail([hm.refreshReserveIx(k), hm.kaminoSupplyIx(alice.publicKey, mint, crew, k, 0n)], [alice], "NotOperator");
ok("a deposit priced at cost is refused (KaminoNotRedeemed) and a member can't push money into Kamino (NotOperator)");

// 5. Borrowers pay interest on our reserve; wait for it to accrue.
console.log(`    waiting ${WAIT}s for Kamino interest to accrue...`);
await new Promise((r) => setTimeout(r, WAIT * 1000));

// 6. Bob joins mid-way. One transaction: redeem (interest lands), deposit at the exact price, supply it all back.
const s6 = await send(hm.withKamino(sponsor.publicKey, mint, crew, k, [hm.depositIx(bob.kp.publicKey, mint, crew, JOIN)]), [bob.kp]);
const mid = hm.decodeCrewKamino(await raw(crew));
assert((await getAccount(conn, vault)).amount === 0n && mid.ctokens > 0n, "everything went back to Kamino");
assert(NEED_INTEREST ? mid.principal > SUPPLY + JOIN : mid.principal >= SUPPLY + JOIN - 1n, `pot re-supplied with interest (${usd(mid.principal)})`);
const earned = mid.principal - SUPPLY - JOIN;
const crewNow = hm.decodeCrew(crew, await raw(crew));
const bobValue = hm.assetsForShares(await sharesOf(crew, bob.kp.publicKey), crewNow.totalShares, mid.principal);
assert(bobValue <= JOIN && bobValue >= JOIN - 1n, `Bob's shares are worth his deposit, no slice of Alice's interest (${usd(bobValue)})`);
ok(`Bob joined with ${usd(JOIN)} at the exact price; Alice's ${usd(earned)} of interest stays hers; pot back in Kamino (${ex(s6)})`);

// 7. Anyone can bring the pot home: Alice redeems herself, no operator needed.
const s7 = await send([hm.refreshReserveIx(k), hm.kaminoRedeemIx(alice.publicKey, mint, crew, k)], [alice]);
const back = (await getAccount(conn, vault)).amount;
const after = hm.decodeCrewKamino(await raw(crew));
assert(after.principal === 0n && after.ctokens === 0n, "Kamino position closed");
assert(back + 2n >= mid.principal, `redeemed what was supplied, give or take Kamino rounding (${usd(back)})`);
ok(`Alice (not the operator) redeemed ${usd(back)} into the pot (${ex(s7)})`);

// 8. Both withdraw. Alice gets her deposit plus the interest; Bob gets his deposit.
const s8 = await send([hm.withdrawIx(alice.publicKey, mint, crew, await sharesOf(crew, alice.publicKey))], [alice]);
await send([hm.withdrawIx(bob.kp.publicKey, mint, crew, await sharesOf(crew, bob.kp.publicKey))], [bob.kp]);
const gotA = (await getAccount(conn, aliceAta)).amount;
const gotB = (await getAccount(conn, bob.ata)).amount;
assert(NEED_INTEREST ? gotA > SUPPLY : gotA >= SUPPLY - 1n, "Alice withdrew at least her deposit");
assert(gotB >= JOIN - 1n && gotB <= JOIN + 1n, "Bob withdrew his deposit");
ok(`Alice withdrew ${usd(gotA)} for ${usd(SUPPLY)} (+${usd(gotA - SUPPLY)} real interest), Bob ${usd(gotB)} for ${usd(JOIN)} (${ex(s8)})`);
console.log(`\nAll ${step} checks passed.`);
