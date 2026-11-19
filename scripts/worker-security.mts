// Attacks the live edge API: it must sign only House Money transactions where the sponsor just pays.
//   API=https://house-money-ubc.jairoamayac.workers.dev node scripts/worker-security.mts
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const API = process.env.API ?? "https://house-money-ubc.jairoamayac.workers.dev";
const cfg = await (await fetch(`${API}/api/config`)).json();
const conn = new Connection(cfg.rpc, "confirmed");
const sponsor = new PublicKey(cfg.sponsor);
const mint = new PublicKey(cfg.mint);
const attacker = Keypair.generate();
const { blockhash } = await conn.getLatestBlockhash("confirmed");

let pass = 0, fail = 0;
async function post(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() as { tx?: string; error?: string } };
}
function tx(ixs: TransactionInstruction[], feePayer = sponsor, signers: Keypair[] = [attacker]) {
  const t = new Transaction({ feePayer, blockhash, lastValidBlockHeight: 0 }).add(...ixs);
  const needed = t.compileMessage().accountKeys.slice(0, t.compileMessage().header.numRequiredSignatures);
  for (const s of signers) if (needed.some((k) => k.equals(s.publicKey))) t.partialSign(s);
  return t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}
async function expect(name: string, path: string, body: unknown, shouldSign: boolean) {
  const r = await post(path, body);
  const signed = r.status === 200 && !!r.body.tx;
  const ok = signed === shouldSign;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name} → ${r.status} ${r.body.error ?? (signed ? "signed" : "")}`);
}

console.log(`Edge API security checks against ${API}`);
const sponsorAta = getAssociatedTokenAddressSync(mint, sponsor);
const attackerAta = getAssociatedTokenAddressSync(mint, attacker.publicKey);
const someCrew = hm.crewPda(attacker.publicKey, 1n);

await expect("drain SOL: system transfer from sponsor", "/api/sponsor",
  { tx: tx([SystemProgram.transfer({ fromPubkey: sponsor, toPubkey: attacker.publicKey, lamports: 1_000_000_000 })]) }, false);
await expect("drain dollars: token transfer from sponsor's account", "/api/sponsor",
  { tx: tx([createTransferCheckedInstruction(sponsorAta, mint, attackerAta, sponsor, 1_000_000n, 6)]) }, false);
await expect("sponsor as the depositing owner (spend its dollars)", "/api/sponsor",
  { tx: tx([hm.depositIx(sponsor, mint, someCrew, 1_000_000n)], sponsor, []) }, false);
await expect("sponsor as crew owner (not just payer)", "/api/sponsor",
  { tx: tx([hm.createCrewIx(attacker.publicKey, sponsor, mint, 1n, "x", "x")], sponsor, []) }, false);
await expect("fee payer is not the sponsor", "/api/sponsor",
  { tx: tx([hm.createCrewIx(attacker.publicKey, attacker.publicKey, mint, 1n, "x", "x")], attacker.publicKey) }, false);
await expect("our ix smuggled next to a foreign one", "/api/sponsor",
  { tx: tx([hm.createCrewIx(sponsor, attacker.publicKey, mint, 1n, "x", "x"), SystemProgram.transfer({ fromPubkey: sponsor, toPubkey: attacker.publicKey, lamports: 1 })]) }, false);
await expect("drain SOL via a huge priority fee", "/api/sponsor",
  { tx: tx([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000_000_000 }),
    hm.createCrewIx(sponsor, attacker.publicKey, mint, 2n, "x", "x")]) }, false);
await expect("drain SOL via a moderate priority fee above the cap", "/api/sponsor",
  { tx: tx([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000_000 }), hm.createCrewIx(sponsor, attacker.publicKey, mint, 3n, "x", "x")]) }, false);
await expect("garbage payload", "/api/sponsor", { tx: "bm90IGEgdHg=" }, false);
await expect("legit: create a crew, sponsor pays rent", "/api/sponsor",
  { tx: tx([...hm.priorityIxs(), hm.createCrewIx(sponsor, attacker.publicKey, mint, 1n, "Legit", "🔥")]) }, true);
await expect("top-up $0", "/api/topup", { owner: attacker.publicKey.toBase58(), amount: 0, blockhash }, false);
await expect("top-up $10,000 (over the $500 cap)", "/api/topup", { owner: attacker.publicKey.toBase58(), amount: 10_000, blockhash }, false);
await expect("top-up to an invalid address", "/api/topup", { owner: "not-a-key", amount: 10, blockhash }, false);
await expect("legit: top-up $25", "/api/topup", { owner: attacker.publicKey.toBase58(), amount: 25, blockhash }, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
