// Kept edge API (Cloudflare Worker). Serves the static app plus:
//   GET  /api/config   cluster, mint and sponsor the app should use
//   POST /api/topup    simulated Apple Pay: returns a sponsor-signed transfer of test dollars (hmUSD)
//   POST /api/sponsor  vets and co-signs a transaction as fee payer, so people never hold SOL
//   POST /api/rpc      JSON-RPC proxy to a private RPC (QuickNode), only when QUICKNODE_URL is set
// The Worker only signs; the app submits to the RPC (public RPCs block datacenter IPs).
// With QUICKNODE_URL (a Worker secret, never sent to browsers) the app talks to /api/rpc, which forwards a
// short allowlist of read and send methods; RPC_URL stays as the public fallback the app uses if the proxy fails.
// The sponsor key lives in a Worker secret (SPONSOR_KEY). Devnet only.
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { MAX_CU_PRICE as HM_MAX_CU_PRICE, PROGRAM_ID, SOCIAL_PAYER_IXS, priorityIxs } from "../src/lib/house-money/solana/hm";

interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> };
  SPONSOR_KEY: string;
  RPC_URL: string;
  /** Private RPC endpoint (QuickNode), with its token. Secret: `npx wrangler secret put QUICKNODE_URL`. */
  QUICKNODE_URL?: string;
  MINT: string;
  /** Kamino Lend market, hmUSD reserve and its Pyth feed (optional: without them pots stay idle). */
  KAMINO_MARKET?: string;
  KAMINO_RESERVE?: string;
  KAMINO_ORACLE?: string;
}

const COMPUTE_BUDGET = new PublicKey("ComputeBudget111111111111111111111111111111");
// Instructions where account #0 only pays rent (the program never moves its tokens):
// create_crew, join_crew, open_call, settle_call, plus the social ones (profiles, bets, challenges, votes).
const PAYER_IXS = new Set([
  "176,106,87,57,118,114,236,48",
  "86,114,155,5,187,60,196,223",
  "153,26,89,45,252,243,183,62",
  "58,230,6,58,104,245,154,227",
  ...SOCIAL_PAYER_IXS,
  // kamino_supply / kamino_redeem: the sponsor is the operator. The program only lets these move a pot's
  // own dollars between its vault and cTokens owned by the pot's PDA, never anywhere else.
  "145,46,142,2,176,57,162,159",
  "143,225,240,130,123,5,160,84",
]);
const KLEND = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const KLEND_REFRESH_RESERVE = "2,218,138,235,79,201,25,102";
const MAX_TOPUP_USD = 500;
const MAX_CU = 400_000;
const MAX_CU_PRICE = BigInt(HM_MAX_CU_PRICE); // µlamports per compute unit

// Everything the app and its libraries call. No airdrops, no heavy history scans.
const RPC_METHODS = new Set([
  "getAccountInfo", "getMultipleAccounts", "getProgramAccounts", "getBalance", "getTokenAccountBalance",
  "getTokenAccountsByOwner", "getLatestBlockhash", "getBlockHeight", "getSlot", "getSignatureStatuses",
  "getMinimumBalanceForRentExemption", "getEpochInfo", "getVersion", "getHealth", "getGenesisHash",
  "getFeeForMessage", "isBlockhashValid", "sendTransaction", "simulateTransaction",
  // QuickNode Priority Fee API add-on: live fee estimates so transactions land when the network is busy.
  "qn_estimatePriorityFees",
]);
const MAX_RPC_BODY = 64 * 1024;
const MAX_RPC_BATCH = 20;

/** Why a JSON-RPC call may not go through the proxy, or null if it may. */
function vetRpc(call: unknown): string | null {
  const c = call as { jsonrpc?: string; method?: unknown; params?: unknown[] };
  if (!c || c.jsonrpc !== "2.0" || typeof c.method !== "string") return "Not a JSON-RPC 2.0 call.";
  if (!RPC_METHODS.has(c.method)) return `Method ${c.method} is not available.`;
  // Program-wide scans are the expensive call: only ours.
  if (c.method === "getProgramAccounts" && c.params?.[0] !== PROGRAM_ID.toBase58()) return "Only Kept accounts can be listed.";
  return null;
}

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
      const mint = new PublicKey(env.MINT);

      if (url.pathname === "/api/config" && req.method === "GET") {
        return json({
          rpc: env.QUICKNODE_URL ? `${url.origin}/api/rpc` : env.RPC_URL,
          fallbackRpc: env.QUICKNODE_URL ? env.RPC_URL : null,
          mint: mint.toBase58(),
          sponsor: sponsor.publicKey.toBase58(),
          programId: PROGRAM_ID.toBase58(),
          kamino: env.KAMINO_RESERVE && env.KAMINO_MARKET && env.KAMINO_ORACLE
            ? { market: env.KAMINO_MARKET, reserve: env.KAMINO_RESERVE, pythOracle: env.KAMINO_ORACLE }
            : null,
        });
      }

      if (url.pathname === "/api/rpc" && req.method === "POST") {
        if (!env.QUICKNODE_URL) return json({ error: "No private RPC configured." }, 404);
        const text = await req.text();
        if (text.length > MAX_RPC_BODY) return json({ error: "Request too large." }, 413);
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          return json({ error: "Invalid JSON." }, 400);
        }
        const calls = Array.isArray(body) ? body : [body];
        if (calls.length === 0 || calls.length > MAX_RPC_BATCH) return json({ error: "Bad batch size." }, 400);
        for (const c of calls) {
          const problem = vetRpc(c);
          if (problem) return json({ error: problem }, 403);
        }
        const upstream = await fetch(env.QUICKNODE_URL, { method: "POST", headers: { "content-type": "application/json" }, body: text });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }

      if (url.pathname === "/api/topup" && req.method === "POST") {
        const { owner, amount, blockhash } = (await req.json()) as { owner: string; amount: number; blockhash: string };
        const usd = Number(amount);
        if (!(usd >= 1 && usd <= MAX_TOPUP_USD)) return json({ error: `Top up between $1 and $${MAX_TOPUP_USD}.` }, 400);
        const to = new PublicKey(owner);
        const from = getAssociatedTokenAddressSync(mint, sponsor.publicKey);
        const toAta = getAssociatedTokenAddressSync(mint, to);
        const tx = new Transaction().add(
          ...priorityIxs(),
          createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, toAta, to, mint),
          createTransferCheckedInstruction(from, mint, toAta, sponsor.publicKey, BigInt(Math.round(usd * 1e6)), 6),
        );
        tx.recentBlockhash = blockhash;
        tx.feePayer = sponsor.publicKey;
        tx.sign(sponsor);
        return json({ tx: b64(tx) });
      }

      if (url.pathname === "/api/sponsor" && req.method === "POST") {
        const { tx: raw } = (await req.json()) as { tx: string };
        const tx = Transaction.from(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
        const problem = vet(tx, sponsor.publicKey);
        if (problem) return json({ error: problem }, 400);
        tx.partialSign(sponsor);
        if (!tx.verifySignatures()) return json({ error: "Missing signatures." }, 400);
        return json({ tx: b64(tx) });
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      const err = e as { message?: string; logs?: string[] };
      const logs = err.logs ?? [];
      const msg = logs.find((l) => l.includes("Error Message:"))?.split("Error Message: ")[1] ?? err.message ?? "Error";
      // The Worker makes no network calls, so any failure here comes from a malformed request.
      return json({ error: msg, logs }, 400);
    }
  },
};

export default worker;

const b64 = (tx: Transaction) => btoa(String.fromCharCode(...tx.serialize()));

/** Only sponsors calls to our program, and the sponsor may only appear as the rent payer. */
function vet(tx: Transaction, sponsor: PublicKey): string | null {
  if (!tx.feePayer?.equals(sponsor)) return "Fee payer must be the sponsor.";
  if (tx.instructions.length === 0 || tx.instructions.length > 9) return "Unexpected transaction.";
  for (const ix of tx.instructions) {
    if (ix.programId.equals(COMPUTE_BUDGET)) {
      // Cap what a sponsored transaction can cost: ≤ 400k CU at ≤ 1,000,000 µlamports/CU (~0.0004 SOL).
      const kind = ix.data[0];
      const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
      if (kind === 2 && ix.data.length === 5 && view.getUint32(1, true) <= MAX_CU) continue;
      if (kind === 3 && ix.data.length === 9 && view.getBigUint64(1, true) <= MAX_CU_PRICE) continue;
      return "Priority fee above the sponsor's cap.";
    }
    if (ix.programId.equals(KLEND)) {
      // Only Kamino's permissionless price/interest refresh, which Kamino requires before a supply or redeem.
      if (Array.from(ix.data).join(",") === KLEND_REFRESH_RESERVE && !ix.keys.some((k) => k.pubkey.equals(sponsor))) continue;
      return "Only Kept instructions can be sponsored.";
    }
    if (!ix.programId.equals(PROGRAM_ID)) return "Only Kept instructions can be sponsored.";
    const disc = Array.from(ix.data.subarray(0, 8)).join(",");
    for (const [i, k] of ix.keys.entries()) {
      if (k.pubkey.equals(sponsor) && !(i === 0 && PAYER_IXS.has(disc))) return "The sponsor can only pay rent.";
    }
  }
  return null;
}
