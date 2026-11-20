// Kept edge API (Cloudflare Worker). Serves the static app plus:
//   GET  /api/config   cluster, mint and sponsor the app should use
//   POST /api/topup    simulated Apple Pay: returns a sponsor-signed transfer of test dollars (hmUSD)
//   POST /api/sponsor  vets and co-signs a transaction as fee payer, so people never hold SOL
//   POST /api/rpc      JSON-RPC proxy to a private RPC (QuickNode), only when QUICKNODE_URL is set
//   POST /api/onramp/order, /api/onramp/credit: Crossmint (Apple Pay or a card), see worker/onramp.ts and docs/ONRAMP.md
//   GET  /.well-known/apple-developer-merchantid-domain-association: Apple Pay domain file (committed; CROSSMINT_APPLE_PAY_DOMAIN_FILE overrides)
//   /api/appeal, /api/grok/verdict, /api/disputes/:id, /api/streams/quicknode: Grok Bot appeals council (worker/grok.ts)
// The Worker only signs; the app submits to the RPC (public RPCs block datacenter IPs).
// With QUICKNODE_URL (a Worker secret, never sent to browsers) the app talks to /api/rpc, which forwards a
// short allowlist of read and send methods; RPC_URL stays as the public fallback the app uses if the proxy fails.
// The sponsor key lives in a Worker secret (SPONSOR_KEY). Devnet only.
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { KEPT_IX, MAX_CU_PRICE as HM_MAX_CU_PRICE, PROGRAM_ID, priorityIxs } from "../src/lib/house-money/solana/hm";
import { handleGrok, type GrokEnv } from "./grok";
// Apple Pay domain file from the Crossmint console (staging) for kept.jairoamayac.workers.dev, served byte for byte.
import APPLE_PAY_DOMAIN_FILE from "./apple-developer-merchantid-domain-association.txt";
import { handleOnramp, topupTx, type OnrampEnv, type OnrampKV } from "./onramp";

interface Env extends GrokEnv, OnrampEnv {
  /** Optional override of the committed Apple Pay domain file (e.g. for another domain or production). */
  CROSSMINT_APPLE_PAY_DOMAIN_FILE?: string;
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
  /** Cloudflare rate limiters (wrangler.jsonc "ratelimits"). Missing in a binding-less dev run: no limit. */
  SPONSOR_LIMIT?: RateLimiter;
  TOPUP_LIMIT?: RateLimiter;
  RPC_LIMIT?: RateLimiter;
}
interface RateLimiter { limit(o: { key: string }): Promise<{ success: boolean }> }

const COMPUTE_BUDGET = new PublicKey("ComputeBudget111111111111111111111111111111");
// Only the Kept instructions the app sends get sponsored (no old calls or bets: they were rent sinks).
const disc = (name: keyof typeof KEPT_IX) => KEPT_IX[name].join(",");
const APP_IXS = new Set((["create_crew", "join_crew", "deposit", "withdraw", "set_profile", "create_challenge", "join_challenge",
  "join_with_goal", "vote_entry", "finalize_entry", "take_fee", "claim_challenge", "open_dispute", "kamino_supply", "kamino_redeem"] as const).map(disc));
// Of those, where account #0 may be the sponsor: it only pays rent (the program never moves its tokens), or,
// for kamino_supply/redeem, it is the operator, which can only move a pot's own dollars between its vault
// and cTokens owned by the pot's PDA. The supply must be "the whole vault" (amount 0), as the app sends it.
const PAYER_IXS = new Set((["create_crew", "join_crew", "set_profile", "create_challenge", "join_challenge", "vote_entry",
  "join_with_goal", "take_fee", "open_dispute", "kamino_supply", "kamino_redeem"] as const).map(disc));
const KAMINO_SUPPLY = disc("kamino_supply");
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
/** Program-wide scans per request (the app sends one per request). */
const MAX_RPC_SCANS = 2;
const RPC_TIMEOUT_MS = 8_000;

/** Why a JSON-RPC call may not go through the proxy, or null if it may. */
function vetRpc(call: unknown): string | null {
  const c = call as { jsonrpc?: string; method?: unknown; params?: unknown[] };
  if (!c || c.jsonrpc !== "2.0" || typeof c.method !== "string") return "Not a JSON-RPC 2.0 call.";
  if (!RPC_METHODS.has(c.method)) return `Method ${c.method} is not available.`;
  // Program-wide scans are the expensive call: only ours.
  if (c.method === "getProgramAccounts" && c.params?.[0] !== PROGRAM_ID.toBase58()) return "Only Kept accounts can be listed.";
  return null;
}

/** sendTransaction through our RPC only for transactions the sponsor pays for (the app's own). */
function sponsoredOnly(call: { method?: unknown; params?: unknown[] }, sponsor: PublicKey): string | null {
  if (call.method !== "sendTransaction" && call.method !== "simulateTransaction") return null;
  try {
    const raw = String(call.params?.[0] ?? "");
    const bytes = Uint8Array.from(atob(raw), (ch) => ch.charCodeAt(0));
    return Transaction.from(bytes).feePayer?.equals(sponsor) ? null : "Only Kept transactions can be sent here.";
  } catch {
    return "Only Kept transactions can be sent here.";
  }
}

/** Per-IP (and per-key) budget; a missing limiter binding means no limit. */
async function allowed(limiter: RateLimiter | undefined, key: string) {
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    return true;
  }
}
const ipOf = (req: Request) => req.headers.get("cf-connecting-ip") ?? "local";
const tooMany = () => json({ error: "Too many requests. Try again in a minute." }, 429);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/.well-known/apple-developer-merchantid-domain-association") {
      const file = env.CROSSMINT_APPLE_PAY_DOMAIN_FILE || APPLE_PAY_DOMAIN_FILE;
      if (!file) return new Response("Not found", { status: 404 });
      return new Response(file, { headers: { "content-type": "text/plain", "cache-control": "public, max-age=3600" } });
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      // Grok Bot appeals council. These routes do not need the sponsor key and never sign anything.
      const grok = await handleGrok(req, url, env);
      if (grok) return grok;
      const sponsor = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env.SPONSOR_KEY)));
      const mint = new PublicKey(env.MINT);

      const onramp = await handleOnramp(req, url, env, {
        kv: env.DISPUTES as unknown as OnrampKV | undefined, // same namespace, keys prefixed "onramp:"
        sponsor, signTx: (t) => t.sign(sponsor), mint, prefix: priorityIxs(), rpc: env.QUICKNODE_URL || env.RPC_URL,
        allow: (key) => allowed(env.TOPUP_LIMIT, key), ip: ipOf(req),
      });
      if (onramp) return onramp;

      if (url.pathname === "/api/config" && req.method === "GET") {
        return json({
          rpc: env.QUICKNODE_URL ? `${url.origin}/api/rpc` : env.RPC_URL,
          fallbackRpc: env.QUICKNODE_URL ? env.RPC_URL : null,
          mint: mint.toBase58(),
          sponsor: sponsor.publicKey.toBase58(),
          programId: PROGRAM_ID.toBase58(),
          onramp: !!env.CROSSMINT_SERVER_KEY && !!env.DISPUTES,
          kamino: env.KAMINO_RESERVE && env.KAMINO_MARKET && env.KAMINO_ORACLE
            ? { market: env.KAMINO_MARKET, reserve: env.KAMINO_RESERVE, pythOracle: env.KAMINO_ORACLE }
            : null,
        });
      }

      if (url.pathname === "/api/rpc" && req.method === "POST") {
        if (!env.QUICKNODE_URL) return json({ error: "No private RPC configured." }, 404);
        // Browsers send Origin: only our own pages may spend our RPC credits. (Scripts and servers send none;
        // this is a deterrent, the method allowlist and QuickNode's own rate limits are the real bound.)
        const origin = req.headers.get("origin");
        if (origin && origin !== url.origin) return json({ error: "Not allowed from this site." }, 403);
        if (!(await allowed(env.RPC_LIMIT, ipOf(req)))) return tooMany();
        if (Number(req.headers.get("content-length") ?? 0) > MAX_RPC_BODY) return json({ error: "Request too large." }, 413);
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
          const problem = vetRpc(c) ?? sponsoredOnly(c, sponsor.publicKey);
          if (problem) return json({ error: problem }, 403);
        }
        if (calls.filter((c) => (c as { method?: string }).method === "getProgramAccounts").length > MAX_RPC_SCANS) {
          return json({ error: "Too many scans in one request." }, 400);
        }
        // Fail fast: a hung upstream call returns 504 and the app retries it on the public RPC.
        let upstream: Response;
        try {
          upstream = await fetch(env.QUICKNODE_URL, {
            method: "POST", headers: { "content-type": "application/json" },
            // Forward exactly what was checked (re-serialized), never the raw text: duplicate JSON keys could
            // otherwise mean one method here and another upstream.
            body: JSON.stringify(body), signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
          });
        } catch {
          return json({ error: "Private RPC timed out." }, 504);
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }

      if (url.pathname === "/api/topup" && req.method === "POST") {
        if (!(await allowed(env.TOPUP_LIMIT, `ip:${ipOf(req)}`))) return tooMany();
        const { owner, amount, blockhash } = (await req.json()) as { owner: string; amount: number; blockhash: string };
        if (!(await allowed(env.TOPUP_LIMIT, `owner:${owner}`))) return tooMany();
        const usd = Number(amount);
        if (!(usd >= 1 && usd <= MAX_TOPUP_USD)) return json({ error: `Top up between $1 and $${MAX_TOPUP_USD}.` }, 400);
        const tx = topupTx(sponsor, mint, new PublicKey(owner), usd, blockhash, undefined, priorityIxs());
        tx.sign(sponsor);
        return json({ tx: b64(tx) });
      }

      if (url.pathname === "/api/sponsor" && req.method === "POST") {
        if (!(await allowed(env.SPONSOR_LIMIT, ipOf(req)))) return tooMany();
        if (Number(req.headers.get("content-length") ?? 0) > 8_192) return json({ error: "Request too large." }, 413);
        const { tx: raw } = (await req.json()) as { tx: string };
        const tx = Transaction.from(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
        const problem = vet(tx, sponsor.publicKey);
        if (problem) return json({ error: problem }, 400);
        // With the private RPC, simulate before signing: a transaction that would fail never costs the sponsor.
        if (env.QUICKNODE_URL) {
          const sim = await simulate(env.QUICKNODE_URL, tx);
          if (sim) return json({ error: sim.message, logs: sim.logs }, 400);
        }
        tx.partialSign(sponsor);
        if (!tx.verifySignatures()) return json({ error: "Missing signatures." }, 400);
        return json({ tx: b64(tx) });
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      const err = e as { message?: string; logs?: string[] };
      const logs = err.logs ?? [];
      const msg = logs.find((l) => l.includes("Error Message:"))?.split("Error Message: ")[1];
      // Never echo raw exception text (it could quote configuration); program errors are safe to name.
      console.error("api error", err.message);
      return json({ error: msg ?? "Bad request.", logs }, 400);
    }
  },
};

export default worker;

const b64 = (tx: Transaction) => btoa(String.fromCharCode(...tx.serialize()));

/** Only sponsors calls to our program, and the sponsor may only appear as the rent payer. */
function vet(tx: Transaction, sponsor: PublicKey): string | null {
  if (!tx.feePayer?.equals(sponsor)) return "Fee payer must be the sponsor.";
  if (tx.instructions.length === 0 || tx.instructions.length > 9) return "Unexpected transaction.";
  // Every sponsored transaction sets its own compute limit (else Solana bills 200k CU per instruction) and
  // does something in Kept: no fee-only transactions.
  const limits = tx.instructions.filter((ix) => ix.programId.equals(COMPUTE_BUDGET) && ix.data[0] === 2);
  if (limits.length !== 1) return "Set one compute limit.";
  if (!tx.instructions.some((ix) => ix.programId.equals(PROGRAM_ID))) return "Only Kept instructions can be sponsored.";
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
    const d = Array.from(ix.data.subarray(0, 8)).join(",");
    if (!APP_IXS.has(d)) return "Only Kept instructions can be sponsored.";
    if (d === KAMINO_SUPPLY && (ix.data.length !== 16 || ix.data.subarray(8).some((b) => b !== 0))) return "Only whole-pot moves can be sponsored.";
    for (const [i, k] of ix.keys.entries()) {
      if (k.pubkey.equals(sponsor) && !(i === 0 && PAYER_IXS.has(d))) return "The sponsor can only pay rent.";
    }
  }
  return null;
}

/** Simulates on the private RPC without signatures; returns the program error, or null if it would succeed. */
async function simulate(rpc: string, tx: Transaction): Promise<{ message: string; logs: string[] } | null> {
  const wire = btoa(String.fromCharCode(...tx.serialize({ requireAllSignatures: false, verifySignatures: false })));
  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "simulateTransaction", params: [wire, { encoding: "base64", sigVerify: false, commitment: "confirmed" }] }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    const out = (await r.json()) as { result?: { value?: { err: unknown; logs?: string[] } } };
    const v = out.result?.value;
    if (!v || v.err === null || v.err === undefined) return null; // no answer: do not block the app on the RPC
    const logs = v.logs ?? [];
    const message = logs.find((l) => l.includes("Error Message:"))?.split("Error Message: ")[1] ?? "That would fail, so it was not sent.";
    return { message, logs };
  } catch {
    return null;
  }
}
