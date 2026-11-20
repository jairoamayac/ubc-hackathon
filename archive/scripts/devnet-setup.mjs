// Step 1 on devnet: sponsor wallet (admin + fee payer + mint authority) and the test dollar (hmUSD).
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getMint } from "@solana/spl-token";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";

const conn = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
const sponsor = loadOrCreate("sponsor");
const program = loadOrCreate("program");
console.log("sponsor", sponsor.publicKey.toBase58());
console.log("program", program.publicKey.toBase58());

let bal = await conn.getBalance(sponsor.publicKey);
if (bal < 2 * LAMPORTS_PER_SOL) {
  try {
    const sig = await conn.requestAirdrop(sponsor.publicKey, 2 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
  } catch (e) { console.log("airdrop failed:", e.message.slice(0, 120)); }
  bal = await conn.getBalance(sponsor.publicKey);
}
console.log("sponsor SOL", bal / LAMPORTS_PER_SOL);

const cfgFile = new URL("../keys/devnet.json", import.meta.url);
const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, "utf8")) : {};
if (!cfg.mint && bal > 0.05 * LAMPORTS_PER_SOL) {
  const mint = await createMint(conn, sponsor, sponsor.publicKey, null, 6);
  cfg.mint = mint.toBase58();
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
}
if (cfg.mint) {
  const m = await getMint(conn, new (await import("@solana/web3.js")).PublicKey(cfg.mint));
  const ata = await getOrCreateAssociatedTokenAccount(conn, sponsor, m.address, sponsor.publicKey);
  if (ata.amount < 1_000_000_000n) await mintTo(conn, sponsor, m.address, ata.address, sponsor, 100_000_000_000n); // $100k reserve
  console.log("mint hmUSD", cfg.mint, "decimals", m.decimals);
}
