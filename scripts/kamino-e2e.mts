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

console.log(`Kept real yield via Kamino Lend on devnet`);
console.log(`  program ${hm.PROGRAM_ID.toBase58()}  klend ${hm.KLEND_PROGRAM_ID.toBase58()}`);
console.log(`  market ${k.market.toBase58()}  reserve ${k.reserve.toBase58()}`);

// 1. Config on this program, pointing at our Kamino reserve. The simulated yield is off (APY 0).
const cfgInfo = await conn.getAccountInfo(hm.configPda());
if (!cfgInfo) await send([hm.initConfigIx(sponsor.publicKey, mint, { apyBps: 0, timeWarp: 1, callDuration: 60, maxBoost: 5, maxWinMultiple: 5, maxPriceAge: 120 })]);
const s1 = await send([hm.setKaminoReserveIx(sponsor.publicKey, k.reserve)]);
ok(`config: simulated APY 0%, Kamino reserve set (${ex(s1)})`);

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

// 3. The crew supplies everything to Kamino. The vault empties; the crew's assets do not change.
const s3 = await send([hm.refreshReserveIx(k), hm.kaminoSupplyIx(sponsor.publicKey, mint, crew, k, SUPPLY)]);
const kp = hm.decodeCrewKamino(await raw(crew));
assert((await getAccount(conn, vault)).amount === 0n, "vault emptied into Kamino");
assert(kp.principal === SUPPLY && kp.ctokens > 0n, "crew records Kamino principal and cTokens");
const ctokenAta = (await import("@solana/spl-token")).getAssociatedTokenAddressSync(hm.kaminoAccounts(k).collMint, crew, true);
assert((await getAccount(conn, ctokenAta)).amount === kp.ctokens, "crew PDA owns the cTokens");
ok(`supplied ${usd(SUPPLY)} to Kamino, crew PDA holds ${kp.ctokens} cTokens (${ex(s3)})`);

// 4. Borrowers pay interest on our reserve; wait for it to accrue.
console.log(`    waiting ${WAIT}s for Kamino interest to accrue...`);
await new Promise((r) => setTimeout(r, WAIT * 1000));

// 5. Redeem: principal plus interest come back to the crew vault.
const s5 = await send([hm.refreshReserveIx(k), hm.kaminoRedeemIx(sponsor.publicKey, mint, crew, k)]);
const back = (await getAccount(conn, vault)).amount;
const after = hm.decodeCrewKamino(await raw(crew));
assert(after.principal === 0n && after.ctokens === 0n, "Kamino position closed");
assert(NEED_INTEREST ? back > SUPPLY : back >= SUPPLY - 1n, `redeemed back what was supplied (${usd(back)} vs ${usd(SUPPLY)})`);
ok(`redeemed ${usd(back)}: earned ${usd(back - SUPPLY)} of real Kamino interest (${ex(s5)})`);

// 6. The member withdraws everything and gets the interest.
const shares = hm.decodeMember(hm.memberPda(crew, alice.publicKey), await raw(hm.memberPda(crew, alice.publicKey))).shares;
const s6 = await send([hm.withdrawIx(alice.publicKey, mint, crew, shares)], [alice]);
const got = (await getAccount(conn, aliceAta)).amount;
assert(NEED_INTEREST ? got > SUPPLY : got >= SUPPLY - 1n, "member withdrew at least the deposit");
ok(`member withdrew ${usd(got)} for a ${usd(SUPPLY)} deposit (${ex(s6)})`);
console.log(`\nAll ${step} checks passed.`);
