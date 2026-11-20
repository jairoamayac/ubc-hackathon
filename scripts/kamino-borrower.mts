// A real borrower on our Kamino market, so the hmUSD pool earns interest (lenders only earn when someone borrows).
// Deposits SOL as collateral and borrows hmUSD, with raw klend instructions (layouts from klend-interface).
//   KAMINO_FILE=kamino-local.json RPC_URL=http://127.0.0.1:8999 BORROW_USD=500 COLLATERAL_SOL=20 node scripts/kamino-borrower.mts
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction, ComputeBudgetProgram,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction } from "@solana/spl-token";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { loadOrCreate } from "./keys.mjs";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8999";
const conn = new Connection(RPC, "confirmed");
const k = JSON.parse(fs.readFileSync(new URL(`../keys/${process.env.KAMINO_FILE ?? "kamino-local.json"}`, import.meta.url), "utf8"));
const KLEND = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const FARMS = new PublicKey("FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr");
const IXS = new PublicKey("Sysvar1nstructions1111111111111111111111111");
const market = new PublicKey(k.market);
const usdReserve = new PublicKey(k.reserve), solReserve = new PublicKey(k.solReserve);
const usdMint = new PublicKey(k.mint);
const usdOracle = new PublicKey(k.pythOracle), solOracle = new PublicKey(k.solPythOracle ?? "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
const borrower: Keypair = loadOrCreate(process.env.BORROWER ?? "kamino-borrower-local");
const BORROW = BigInt(Math.round(Number(process.env.BORROW_USD ?? 500) * 1e6));
const COLL = BigInt(Math.round(Number(process.env.COLLATERAL_SOL ?? 20) * LAMPORTS_PER_SOL));

const disc = (n: string) => createHash("sha256").update(`global:${n}`).digest().subarray(0, 8);
const u64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };
const pda = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, KLEND)[0];
const m = (pubkey: PublicKey, isWritable = false, isSigner = false) => ({ pubkey, isWritable, isSigner });
const kix = (keys: ReturnType<typeof m>[], data: Buffer) => new TransactionInstruction({ programId: KLEND, keys, data });

const lma = pda([Buffer.from("lma"), market.toBytes()]);
const userMeta = pda([Buffer.from("user_meta"), borrower.publicKey.toBytes()]);
const obligation = pda([Buffer.from([0]), Buffer.from([0]), borrower.publicKey.toBytes(), market.toBytes(), PublicKey.default.toBytes(), PublicKey.default.toBytes()]);
const r = (seed: string, reserve: PublicKey) => pda([Buffer.from(seed), reserve.toBytes()]);

const refreshReserve = (reserve: PublicKey, oracle: PublicKey) =>
  kix([m(reserve, true), m(market), m(oracle), m(KLEND), m(KLEND), m(KLEND)], disc("refresh_reserve"));
const refreshObligation = (deposits: PublicKey[], borrows: PublicKey[]) =>
  kix([m(market), m(obligation, true), ...deposits.map((d) => m(d)), ...borrows.map((b) => m(b, true))], disc("refresh_obligation"));

async function send(ixs: TransactionInstruction[]) {
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ...ixs);
  return sendAndConfirmTransaction(conn, tx, [borrower], { commitment: "confirmed" });
}

console.log(`Kamino borrower ${borrower.publicKey.toBase58()} on ${RPC}`);
if ((await conn.getBalance(borrower.publicKey)) < Number(COLL) + LAMPORTS_PER_SOL) {
  if (!RPC.includes("127.0.0.1")) throw new Error("fund the borrower with SOL first");
  await conn.confirmTransaction(await conn.requestAirdrop(borrower.publicKey, Number(COLL) + 5 * LAMPORTS_PER_SOL), "confirmed");
}

// 0. A lender (the sponsor) puts dollars in the pool so there is something to borrow.
const LEND = BigInt(Math.round(Number(process.env.LEND_USD ?? 1000) * 1e6));
if (LEND > 0n) {
  const lender: Keypair = loadOrCreate("sponsor");
  const src = getAssociatedTokenAddressSync(usdMint, lender.publicKey);
  const collMint = r("reserve_coll_mint", usdReserve);
  const dst = getAssociatedTokenAddressSync(collMint, lender.publicKey);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(lender.publicKey, dst, lender.publicKey, collMint),
    refreshReserve(usdReserve, usdOracle),
    kix([m(lender.publicKey, false, true), m(usdReserve, true), m(market), m(lma), m(usdMint), m(r("reserve_liq_supply", usdReserve), true),
      m(collMint, true), m(src, true), m(dst, true), m(TOKEN_PROGRAM_ID), m(TOKEN_PROGRAM_ID), m(IXS)],
      Buffer.concat([disc("deposit_reserve_liquidity"), u64(LEND)])),
  );
  const sig = await sendAndConfirmTransaction(conn, tx, [lender], { commitment: "confirmed" });
  console.log(`  lender supplied $${Number(LEND) / 1e6} to the pool (${sig})`);
}

// 1. User metadata + obligation (once).
if (!(await conn.getAccountInfo(obligation))) {
  await send([
    kix([m(borrower.publicKey, false, true), m(borrower.publicKey, true, true), m(userMeta, true), m(KLEND), m(SYSVAR_RENT_PUBKEY), m(SystemProgram.programId)],
      Buffer.concat([disc("init_user_metadata"), PublicKey.default.toBuffer()])),
    kix([m(borrower.publicKey, false, true), m(borrower.publicKey, true, true), m(obligation, true), m(market), m(PublicKey.default), m(PublicKey.default),
      m(userMeta), m(SYSVAR_RENT_PUBKEY), m(SystemProgram.programId)], Buffer.concat([disc("init_obligation"), Buffer.from([0, 0])])),
  ]);
  console.log(`  obligation ${obligation.toBase58()} created`);
}

// 2. Wrap SOL and deposit it as collateral.
const wsol = getAssociatedTokenAddressSync(NATIVE_MINT, borrower.publicKey);
const sig2 = await send([
  createAssociatedTokenAccountIdempotentInstruction(borrower.publicKey, wsol, borrower.publicKey, NATIVE_MINT),
  SystemProgram.transfer({ fromPubkey: borrower.publicKey, toPubkey: wsol, lamports: COLL }),
  createSyncNativeInstruction(wsol),
  refreshReserve(solReserve, solOracle),
  refreshObligation([], []),
  kix([m(borrower.publicKey, true, true), m(obligation, true), m(market), m(lma), m(solReserve, true), m(NATIVE_MINT),
    m(r("reserve_liq_supply", solReserve), true), m(r("reserve_coll_mint", solReserve), true), m(r("reserve_coll_supply", solReserve), true),
    m(wsol, true), m(KLEND), m(TOKEN_PROGRAM_ID), m(TOKEN_PROGRAM_ID), m(IXS), m(KLEND), m(KLEND), m(FARMS)],
    Buffer.concat([disc("deposit_reserve_liquidity_and_obligation_collateral_v2"), u64(COLL)])),
]);
console.log(`  deposited ${Number(COLL) / LAMPORTS_PER_SOL} SOL as collateral (${sig2})`);

// 3. Borrow hmUSD from our pool: this is what pays the crews' interest.
const usdAta = getAssociatedTokenAddressSync(usdMint, borrower.publicKey);
const sig3 = await send([
  createAssociatedTokenAccountIdempotentInstruction(borrower.publicKey, usdAta, borrower.publicKey, usdMint),
  refreshReserve(solReserve, solOracle),
  refreshReserve(usdReserve, usdOracle),
  refreshObligation([solReserve], []),
  kix([m(borrower.publicKey, false, true), m(obligation, true), m(market), m(lma), m(usdReserve, true), m(usdMint),
    m(r("reserve_liq_supply", usdReserve), true), m(r("fee_receiver", usdReserve), true), m(usdAta, true), m(KLEND),
    m(TOKEN_PROGRAM_ID), m(IXS), m(KLEND), m(KLEND), m(FARMS)],
    Buffer.concat([disc("borrow_obligation_liquidity_v2"), u64(BORROW)])),
]);
console.log(`  borrowed $${Number(BORROW) / 1e6} hmUSD from the pool (${sig3})`);
