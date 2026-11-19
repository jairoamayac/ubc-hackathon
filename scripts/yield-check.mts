// Proves the yield on-chain: reads a crew, waits, triggers `accrue`, reads again.
//   RPC_URL=https://api.devnet.solana.com node scripts/yield-check.mts [crewAddress]
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
const sponsor = loadOrCreate("sponsor");
const state = JSON.parse(fs.readFileSync(new URL("../keys/devnet.json", import.meta.url), "utf8"));
const mint = new PublicKey(state.mint);
const crew = new PublicKey(process.argv[2] ?? state.lastCrew);

const read = async () => {
  const c = hm.decodeCrew(crew, (await conn.getAccountInfo(crew))!.data);
  const vault = (await getAccount(conn, hm.crewVaultPda(crew))).amount;
  const reserve = (await getAccount(conn, hm.yieldVaultPda())).amount;
  return { c, vault, reserve };
};
const usd = (u: bigint) => `$${hm.toUsd(u).toFixed(6)}`;

const a = await read();
console.log(`${a.c.emoji} ${a.c.name}  principal ${usd(a.c.totalPrincipal)}  pot ${usd(a.vault)}  yield paid so far ${usd(a.c.yieldPaid)}  reserve ${usd(a.reserve)}`);
await new Promise((r) => setTimeout(r, 20_000));
const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
const tx = new Transaction({ feePayer: sponsor.publicKey, blockhash, lastValidBlockHeight }).add(...hm.priorityIxs(), hm.accrueIx(mint, crew));
tx.sign(sponsor);
const sig = await conn.sendRawTransaction(tx.serialize());
await hm.confirm(conn, sig, lastValidBlockHeight);
const b = await read();
console.log(`after 20 s + accrue  pot ${usd(b.vault)} (+${usd(b.vault - a.vault)})  yield paid ${usd(b.c.yieldPaid)}  reserve ${usd(b.reserve)} (−${usd(a.reserve - b.reserve)})`);
console.log(`tx https://explorer.solana.com/tx/${sig}?cluster=devnet`);
