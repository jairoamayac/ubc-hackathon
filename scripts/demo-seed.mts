// Seeds a demo crew of friends with a live bet and a live challenge, and prints the invite link.
// Their keys are kept in keys/demo-<cluster>.json so scripts/demo-act.mts can make them vote later.
//   RPC_URL=... APP_URL=https://house-money-ubc.jairoamayac.workers.dev MINUTES=10 node scripts/demo-seed.mts
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const APP = process.env.APP_URL ?? "http://localhost:8787";
const MINUTES = Number(process.env.MINUTES ?? 10);
const conn = new Connection(RPC, "confirmed");
const cluster = RPC.includes("127.0.0.1") || RPC.includes("localhost") ? "local" : "devnet";
const sponsor = loadOrCreate("sponsor");
const state = JSON.parse(fs.readFileSync(new URL(`../keys/${cluster}.json`, import.meta.url), "utf8"));
const mint = new PublicKey(state.mint);
const sponsorAta = getAssociatedTokenAddressSync(mint, sponsor.publicKey);

export async function send(c: Connection, ixs: TransactionInstruction[], signers: Keypair[]) {
  for (let attempt = 1; ; attempt++) {
    const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: sponsor.publicKey, blockhash, lastValidBlockHeight }).add(...hm.priorityIxs(), ...ixs);
    tx.sign(sponsor, ...signers);
    const sig = await c.sendRawTransaction(tx.serialize());
    try { await hm.confirm(c, sig, lastValidBlockHeight); return sig; }
    catch (e) { if (attempt >= 3 || !String(e).includes("expired")) throw e; }
  }
}

const name = process.env.CREW ?? "Saturday Squad";
const friends: [string, number][] = [["Leo", 60], ["Maya", 80], ["Josh", 45]];
const keys = friends.map(() => Keypair.generate());
const crewId = BigInt(Date.now());
const crew = hm.crewPda(keys[0].publicKey, crewId);

await send(conn, [hm.createCrewIx(sponsor.publicKey, keys[0].publicKey, mint, crewId, name, "🎉")], [keys[0]]);
for (const [i, [who, usd]] of friends.entries()) {
  const kp = keys[i];
  const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
  const ixs: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, ata, kp.publicKey, mint),
    createTransferCheckedInstruction(sponsorAta, mint, ata, sponsor.publicKey, hm.fromUsd(usd), hm.DECIMALS),
    hm.setProfileIx(sponsor.publicKey, kp.publicKey, who),
  ];
  if (i > 0) ixs.push(hm.joinCrewIx(sponsor.publicKey, kp.publicKey, crew));
  ixs.push(hm.depositIx(kp.publicKey, mint, crew, hm.fromUsd(usd)));
  await send(conn, ixs, [kp]);
}
console.log(`  ✓ ${name}: Leo $60, Maya $80, Josh $45`);

const crewInfo = async () => {
  const [ci, vi] = await conn.getMultipleAccountsInfo([crew, hm.crewVaultPda(crew)]);
  return { c: hm.decodeCrew(crew, ci!.data), vault: vi!.data.readBigUInt64LE(64) };
};
const toShares = async (usd: number) => {
  const { c, vault } = await crewInfo();
  return (hm.fromUsd(usd) * (c.totalShares + 1000n)) / (vault + 1n);
};
const now = () => Math.floor(Date.now() / 1000);

// A live bet about Leo, with money on both sides
const betId = BigInt(Date.now());
const bet = hm.betPda(crew, betId);
await send(conn, [hm.createBetIx(sponsor.publicKey, keys[1].publicKey, crew, betId, "Will Leo kiss the girl in red tonight?", keys[0].publicKey, now() + MINUTES * 60)], [keys[1]]);
await send(conn, [hm.placeBetIx(sponsor.publicKey, keys[1].publicKey, crew, bet, 1, await toShares(10))], [keys[1]]);
await send(conn, [hm.placeBetIx(sponsor.publicKey, keys[2].publicKey, crew, bet, 2, await toShares(5))], [keys[2]]);
await send(conn, [hm.placeBetIx(sponsor.publicKey, keys[0].publicKey, crew, bet, 1, await toShares(5))], [keys[0]]);
console.log(`  ✓ bet "Will Leo kiss the girl in red tonight?" (Maya $10 yes, Leo $5 yes, Josh $5 no), closes in ${MINUTES} min`);

// A live challenge everyone is in
const chId = BigInt(Date.now());
const ch = hm.challengePda(crew, chId);
await send(conn, [hm.createChallengeIx(sponsor.publicKey, keys[2].publicKey, crew, chId, "Gym 3 times this week", hm.fromUsd(10), now() + MINUTES * 60)], [keys[2]]);
for (const kp of keys) await send(conn, [hm.joinChallengeIx(sponsor.publicKey, kp.publicKey, crew, ch)], [kp]);
console.log(`  ✓ challenge "Gym 3 times this week" ($10 each), ends in ${MINUTES} min`);

const file = new URL(`../keys/demo-${cluster}.json`, import.meta.url);
const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
saved[crew.toBase58()] = { name, friends: Object.fromEntries(friends.map(([who], i) => [who, Array.from(keys[i].secretKey)])) };
fs.writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
console.log(`\nInvite link: ${APP}/?crew=${crew.toBase58()}`);
