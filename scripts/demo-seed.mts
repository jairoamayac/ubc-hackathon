// Seeds a demo group of friends with a live pact, and prints the invite link.
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

await send(conn, [hm.createCrewIx(sponsor.publicKey, keys[0].publicKey, mint, crewId, name, "")], [keys[0]]);
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

const now = () => Math.floor(Date.now() / 1000);

// A live pact: each friend locks money on their own goal
const chId = BigInt(Date.now());
const ch = hm.challengePda(crew, chId);
await send(conn, [hm.createChallengeIx(sponsor.publicKey, keys[0].publicKey, crew, chId, "Pact: this week", hm.fromUsd(5), now() + MINUTES * 60)], [keys[0]]);
const goals = ["Run 21 km by Sunday", "Gym 3 times this week", "No takeout for 7 days"];
const stakes = [20, 20, 10];
for (const [i, kp] of keys.entries()) {
  await send(conn, [hm.joinWithGoalIx(sponsor.publicKey, kp.publicKey, crew, ch, goals[i], hm.fromUsd(stakes[i]))], [kp]);
}
console.log(`  ✓ pact: Leo $20 "${goals[0]}", Maya $20 "${goals[1]}", Josh $10 "${goals[2]}"; ends in ${MINUTES} min`);

const file = new URL(`../keys/demo-${cluster}.json`, import.meta.url);
const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
saved[crew.toBase58()] = { name, friends: Object.fromEntries(friends.map(([who], i) => [who, Array.from(keys[i].secretKey)])) };
fs.writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
console.log(`\nInvite link: ${APP}/?crew=${crew.toBase58()}`);
