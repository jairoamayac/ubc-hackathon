// House Money edge API (Cloudflare Worker). Serves the static app plus:
//   GET  /api/config   cluster, mint and sponsor the app should use
//   POST /api/topup    simulated Apple Pay: credits test dollars (hmUSD) to the person's account
//   POST /api/sponsor  co-signs a transaction as fee payer, so people never hold SOL
// The sponsor key lives in a Worker secret (SPONSOR_KEY). Devnet only.
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PROGRAM_ID, confirm } from "../src/lib/house-money/solana/hm";

interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> };
  SPONSOR_KEY: string;
  RPC_URL: string;
  MINT: string;
}

const COMPUTE_BUDGET = new PublicKey("ComputeBudget111111111111111111111111111111");
// create_crew, join_crew, open_call, settle_call: account #0 only pays rent (the program never moves its tokens).
const PAYER_IXS = new Set([
  "176,106,87,57,118,114,236,48",
  "86,114,155,5,187,60,196,223",
  "153,26,89,45,252,243,183,62",
  "58,230,6,58,104,245,154,227",
]);
const MAX_TOPUP_USD = 500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      const sponsor = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env.SPONSOR_KEY)));
      const conn = new Connection(env.RPC_URL, { commitment: "confirmed", disableRetryOnRateLimit: false });
      const mint = new PublicKey(env.MINT);

      if (url.pathname === "/api/config" && req.method === "GET") {
        return json({
          rpc: env.RPC_URL,
          mint: mint.toBase58(),
          sponsor: sponsor.publicKey.toBase58(),
          programId: PROGRAM_ID.toBase58(),
        });
      }

      if (url.pathname === "/api/topup" && req.method === "POST") {
        const { owner, amount } = (await req.json()) as { owner: string; amount: number };
        const usd = Number(amount);
        if (!(usd >= 1 && usd <= MAX_TOPUP_USD)) return json({ error: `Top up between $1 and $${MAX_TOPUP_USD}.` }, 400);
        const to = new PublicKey(owner);
        const from = getAssociatedTokenAddressSync(mint, sponsor.publicKey);
        const toAta = getAssociatedTokenAddressSync(mint, to);
        const tx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, toAta, to, mint),
          createTransferCheckedInstruction(from, mint, toAta, sponsor.publicKey, BigInt(Math.round(usd * 1e6)), 6),
        );
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = sponsor.publicKey;
        tx.sign(sponsor);
        const signature = await conn.sendRawTransaction(tx.serialize());
        await confirm(conn, signature, lastValidBlockHeight);
        return json({ signature });
      }

      if (url.pathname === "/api/sponsor" && req.method === "POST") {
        const { tx: b64 } = (await req.json()) as { tx: string };
        const tx = Transaction.from(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
        const problem = vet(tx, sponsor.publicKey);
        if (problem) return json({ error: problem }, 400);
        tx.partialSign(sponsor);
        if (!tx.verifySignatures()) return json({ error: "Missing signatures." }, 400);
        const signature = await conn.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
        return json({ signature });
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      const err = e as { message?: string; logs?: string[] };
      const logs = err.logs ?? [];
      const msg = logs.find((l) => l.includes("Error Message:"))?.split("Error Message: ")[1] ?? err.message ?? "Error";
      return json({ error: msg, logs }, 500);
    }
  },
};

export default worker;

/** Only sponsors calls to our program, and the sponsor may only appear as the rent payer. */
function vet(tx: Transaction, sponsor: PublicKey): string | null {
  if (!tx.feePayer?.equals(sponsor)) return "Fee payer must be the sponsor.";
  if (tx.instructions.length === 0 || tx.instructions.length > 4) return "Unexpected transaction.";
  for (const ix of tx.instructions) {
    if (ix.programId.equals(COMPUTE_BUDGET)) continue;
    if (!ix.programId.equals(PROGRAM_ID)) return "Only House Money instructions can be sponsored.";
    const disc = Array.from(ix.data.subarray(0, 8)).join(",");
    for (const [i, k] of ix.keys.entries()) {
      if (k.pubkey.equals(sponsor) && !(i === 0 && PAYER_IXS.has(disc))) return "The sponsor can only pay rent.";
    }
  }
  return null;
}
