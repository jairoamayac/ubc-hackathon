// Seeds demo crews so the leaderboard has life. Members are throwaway devnet keys; fees and rent are sponsored.
//   RPC_URL=https://api.devnet.solana.com node scripts/seed.mts
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
const sponsor = loadOrCreate("sponsor");
const cluster = RPC.includes("127.0.0.1") ? "local" : "devnet";
const state = JSON.parse(fs.readFileSync(new URL(`../keys/${cluster}.json`, import.meta.url), "utf8"));
const mint = new PublicKey(state.mint);
const sponsorAta = (await getOrCreateAssociatedTokenAccount(conn, sponsor, mint, sponsor.publicKey)).address;

async function send(ixs: TransactionInstruction[], signers: Keypair[]) {
  for (let attempt = 1; ; attempt++) {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: sponsor.publicKey, blockhash, lastValidBlockHeight }).add(...hm.priorityIxs(), ...ixs);
    tx.sign(sponsor, ...signers);
    const sig = await conn.sendRawTransaction(tx.serialize());
    try {
      await hm.confirm(conn, sig, lastValidBlockHeight);
      return sig;
    } catch (e) {
      if (attempt >= 3 || !String(e).includes("expired")) throw e;
    }
  }
}

const crews = [
  { name: "Longhorn Roommates", emoji: "🏠", deposits: [120, 95, 80, 60] },
  { name: "LATAM Builders", emoji: "🌮", deposits: [200, 150, 75] },
  { name: "Spring Break Fund", emoji: "✈️", deposits: [40, 35, 30, 25, 20] },
];

for (const c of crews) {
  const members = c.deposits.map(() => Keypair.generate());
  const id = BigInt(Date.now());
  const crew = hm.crewPda(members[0].publicKey, id);
  await send([hm.createCrewIx(sponsor.publicKey, members[0].publicKey, mint, id, c.name, c.emoji)], [members[0]]);
  for (const [i, kp] of members.entries()) {
    const ata = getAssociatedTokenAddressSync(mint, kp.publicKey);
    const amount = hm.fromUsd(c.deposits[i]);
    const ixs = [
      createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, ata, kp.publicKey, mint),
      createTransferCheckedInstruction(sponsorAta, mint, ata, sponsor.publicKey, amount, hm.DECIMALS),
    ];
    if (i > 0) ixs.push(hm.joinCrewIx(sponsor.publicKey, kp.publicKey, crew));
    ixs.push(hm.depositIx(kp.publicKey, mint, crew, amount));
    await send(ixs, [kp]);
  }
  console.log(`  ✓ ${c.emoji} ${c.name}: ${members.length} members, $${c.deposits.reduce((a, b) => a + b, 0)} → ${crew.toBase58()}`);
}
