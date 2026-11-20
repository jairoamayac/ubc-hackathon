// Crossmint onramp (Apple Pay or a card) for Kept. Docs: docs/ONRAMP.md.
//   POST /api/onramp/order   { owner, email, amount }  -> { orderId, clientSecret }
//   POST /api/onramp/credit  { orderId, blockhash }     -> { tx } | { credited: true }   (409 while still processing)
// Crossmint delivers devnet USDC to the person's own account. Pacts run on hmUSD (the test dollar the program and the
// Kamino devnet reserve use), so once Crossmint says the order is complete the Worker returns a sponsor-signed
// transfer of the same amount of hmUSD (same as /api/topup). The app submits it, like every other transaction.
// One credit per order: the KV key onramp:credit:<orderId> remembers the transaction it issued.
// Secrets: CROSSMINT_SERVER_KEY (sk_staging_...). Vars: CROSSMINT_ENV ("staging", default).
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export interface OnrampKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface OnrampEnv {
  CROSSMINT_SERVER_KEY?: string;
  CROSSMINT_ENV?: string;
}

export const MAX_ONRAMP_USD = 500; // below Crossmint's $1,000 threshold, so no wallet-ownership signature is needed
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
/** A blockhash lives ~60-90 s; after this an issued but unsent credit can no longer land, so it may be reissued. */
export const REISSUE_AFTER_MS = 120_000;
const CREDIT_TTL = 60 * 60 * 24 * 90; // keep the record 90 days
const TIMEOUT_MS = 10_000;

export const CROSSMINT = {
  staging: { base: "https://staging.crossmint.com", usdc: "solana:4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" },
  production: { base: "https://www.crossmint.com", usdc: "solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
} as const;
export const crossmintEnv = (env: OnrampEnv) => (env.CROSSMINT_ENV === "production" ? "production" : "staging");

const EMAIL = /^[^\s@"<>]{1,64}@[^\s@"<>]{1,190}\.[A-Za-z]{2,24}$/;

/** The sponsor-signed transfer of test dollars, shared by /api/topup and the onramp credit. */
/** `prefix`: the priority-fee instructions (hm.priorityIxs()), passed in so this file has no app imports. */
export function topupTx(sponsor: { publicKey: PublicKey; secretKey: Uint8Array }, mint: PublicKey, to: PublicKey,
  usd: number, blockhash: string, memo?: string, prefix: TransactionInstruction[] = []) {
  const from = getAssociatedTokenAddressSync(mint, sponsor.publicKey);
  const toAta = getAssociatedTokenAddressSync(mint, to);
  const tx = new Transaction().add(
    ...prefix,
    createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, toAta, to, mint),
    createTransferCheckedInstruction(from, mint, toAta, sponsor.publicKey, BigInt(Math.round(usd * 1e6)), 6),
  );
  if (memo) tx.add(new TransactionInstruction({ programId: MEMO, keys: [], data: new TextEncoder().encode(memo) as Buffer }));
  tx.recentBlockhash = blockhash;
  tx.feePayer = sponsor.publicKey;
  return tx;
}

// ------------------------------------------------------------------ pure checks (unit-tested)

interface CmToken { locator?: string; contractAddress?: string; quantity?: string; decimals?: number }
interface CmLineItem {
  executionParams?: { amount?: string };
  delivery?: { status?: string; recipient?: { walletAddress?: string }; tokens?: CmToken[] };
}
export interface CmOrder { orderId?: string; phase?: string; lineItems?: CmLineItem[]; payment?: { status?: string } }

/**
 * What a completed order entitles `owner` to, in dollars, or why it does not (yet).
 * `pending` means "ask again shortly"; anything else in `error` is final.
 */
export function creditFor(order: CmOrder, usdcLocator: string): { usd: number; owner: string } | { error: string; pending?: true } {
  const items = order.lineItems ?? [];
  if (items.length !== 1) return { error: "This order cannot be added." };
  const it = items[0];
  const owner = it.delivery?.recipient?.walletAddress ?? "";
  if (order.phase !== "completed" || it.delivery?.status !== "completed") {
    if (it.delivery?.status === "failed" || order.payment?.status === "failed") return { error: "The payment did not go through." };
    return { error: "The payment is still processing.", pending: true };
  }
  const mint = usdcLocator.split(":")[1];
  const tok = (it.delivery?.tokens ?? []).find((t) => t.contractAddress === mint || t.locator?.startsWith(usdcLocator));
  let usd = NaN;
  if (tok?.quantity !== undefined) {
    // Base units ("49870000" with 6 decimals) or, if Crossmint ever sends one, a decimal string ("49.87").
    usd = /^\d+$/.test(tok.quantity) && tok.decimals ? Number(tok.quantity) / 10 ** tok.decimals : Number(tok.quantity);
  }
  if (!(usd > 0)) usd = Number(it.executionParams?.amount);
  usd = Math.floor(usd * 100) / 100;
  if (!(usd >= 0.01) || usd > MAX_ONRAMP_USD) return { error: "This order cannot be added." };
  try {
    new PublicKey(owner);
  } catch {
    return { error: "This order cannot be added." };
  }
  return { usd, owner };
}

export interface CreditRecord { orderId: string; owner: string; usd: number; signature: string; issuedAt: number; confirmed?: boolean }

/** Whether to issue (again) a credit, given what was issued before and whether that transaction landed. */
export function nextStep(prev: CreditRecord | null, landed: boolean | null, now: number): "issue" | "done" | "wait" {
  if (!prev) return "issue";
  if (prev.confirmed || landed === true) return "done";
  // Only reissue once the old transaction provably did not land and can no longer land (expired blockhash).
  if (landed === false && now - prev.issuedAt > REISSUE_AFTER_MS) return "issue";
  return "wait";
}

// ------------------------------------------------------------------ Crossmint calls

async function cm(env: OnrampEnv, path: string, init: RequestInit = {}) {
  const res = await fetch(`${CROSSMINT[crossmintEnv(env)].base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-api-key": env.CROSSMINT_SERVER_KEY ?? "", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON answer */
  }
  return { status: res.status, ok: res.ok, body: body as Record<string, unknown> | null };
}

/** Did this signature land? null when the RPC cannot tell us. */
async function landed(rpc: string | undefined, signature: string): Promise<boolean | null> {
  if (!rpc) return null;
  try {
    const r = await fetch(rpc, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignatureStatuses", params: [[signature], { searchTransactionHistory: true }] }),
    });
    const out = (await r.json()) as { result?: { value?: ({ err: unknown; confirmationStatus?: string } | null)[] } };
    if (!out.result?.value) return null;
    const s = out.result.value[0];
    if (!s) return false;
    return s.err === null && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") ? true : s.err ? false : null;
  } catch {
    return null;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleOnramp(req: Request, url: URL, env: OnrampEnv, ctx: {
  kv?: OnrampKV;
  sponsor: { publicKey: PublicKey; secretKey: Uint8Array; sign?: unknown };
  signTx: (tx: Transaction) => void;
  mint: PublicKey;
  prefix: TransactionInstruction[];
  rpc?: string;
  allow: (key: string) => Promise<boolean>;
  ip: string;
}): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/onramp/")) return null;
  if (req.method !== "POST") return json({ error: "Not found" }, 404);
  if (!env.CROSSMINT_SERVER_KEY) return json({ error: "Card payments are not set up yet." }, 503);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return json({ error: "Not allowed from this site." }, 403);
  if (!(await ctx.allow(`onramp-ip:${ctx.ip}`))) return json({ error: "Too many requests. Try again in a minute." }, 429);
  if (Number(req.headers.get("content-length") ?? 0) > 4_096) return json({ error: "Request too large." }, 413);
  let input: Record<string, unknown>;
  try {
    input = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const net = CROSSMINT[crossmintEnv(env)];

  if (url.pathname === "/api/onramp/order") {
    const email = String(input.email ?? "").trim().toLowerCase();
    const usd = Number(input.amount);
    let owner: PublicKey;
    try {
      owner = new PublicKey(String(input.owner ?? ""));
    } catch {
      return json({ error: "Sign in again, then try once more." }, 400);
    }
    if (!EMAIL.test(email)) return json({ error: "We need the email you signed in with." }, 400);
    if (!(usd >= 1 && usd <= MAX_ONRAMP_USD) || Math.round(usd * 100) !== usd * 100) return json({ error: `Add between $1 and $${MAX_ONRAMP_USD}.` }, 400);
    if (!(await ctx.allow(`onramp-owner:${owner.toBase58()}`))) return json({ error: "Too many requests. Try again in a minute." }, 429);

    // Crossmint must know the account is this person's (an "external wallet" to them). Already linked is fine.
    const link = await cm(env, `/api/2025-06-09/users/${encodeURIComponent(`email:${email}`)}/linked-wallets/${owner.toBase58()}`, {
      method: "PUT", body: JSON.stringify({ chain: "solana" }),
    });
    if (!link.ok && link.status !== 409) console.log("onramp: link wallet answered", link.status);

    const res = await cm(env, "/api/2022-06-09/orders", {
      method: "POST",
      body: JSON.stringify({
        lineItems: [{ tokenLocator: net.usdc, executionParameters: { mode: "exact-in", amount: usd.toFixed(2) } }],
        payment: { method: "card", receiptEmail: email },
        recipient: { walletAddress: owner.toBase58() },
      }),
    });
    const order = (res.body?.order ?? {}) as { orderId?: string; payment?: { status?: string } };
    const clientSecret = res.body?.clientSecret as string | undefined;
    if (!res.ok || !order.orderId || !clientSecret) {
      console.log("onramp: create order answered", res.status, JSON.stringify(res.body ?? {}).slice(0, 300));
      return json({ error: "We couldn't start the payment. Please try again." }, 502);
    }
    if (order.payment?.status === "requires-recipient-verification") {
      return json({ error: `Add up to $${MAX_ONRAMP_USD} at a time.` }, 400);
    }
    return json({ orderId: order.orderId, clientSecret });
  }

  if (url.pathname === "/api/onramp/credit") {
    const orderId = String(input.orderId ?? "");
    const blockhash = String(input.blockhash ?? "");
    if (!/^[A-Za-z0-9-]{8,64}$/.test(orderId)) return json({ error: "Unknown payment." }, 400);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(blockhash)) return json({ error: "Please try again." }, 400);
    if (crossmintEnv(env) !== "staging") return json({ error: "Not available yet." }, 400); // test dollars only
    if (!ctx.kv) return json({ error: "Card payments are not set up yet." }, 503);
    if (!(await ctx.allow(`onramp-order:${orderId}`))) return json({ error: "Too many requests. Try again in a minute." }, 429);

    const got = await cm(env, `/api/2022-06-09/orders/${encodeURIComponent(orderId)}`);
    if (got.status === 404) return json({ error: "Unknown payment." }, 404);
    if (!got.ok || !got.body) return json({ error: "We couldn't check the payment. Please try again." }, 502);
    const credit = creditFor(got.body as CmOrder, net.usdc);
    if ("error" in credit) return json({ error: credit.error, pending: credit.pending ?? false }, credit.pending ? 409 : 400);
    if (input.owner && String(input.owner) !== credit.owner) return json({ error: "This payment belongs to another account." }, 403);

    const key = `onramp:credit:${orderId}`;
    const raw = await ctx.kv.get(key);
    const prev = raw ? (JSON.parse(raw) as CreditRecord) : null;
    const step = nextStep(prev, prev && !prev.confirmed ? await landed(ctx.rpc, prev.signature) : null, Date.now());
    if (step === "done") {
      if (prev && !prev.confirmed) await ctx.kv.put(key, JSON.stringify({ ...prev, confirmed: true }), { expirationTtl: CREDIT_TTL });
      return json({ credited: true, usd: credit.usd });
    }
    if (step === "wait") return json({ error: "Adding your money. One moment.", pending: true }, 409);

    const tx = topupTx(ctx.sponsor, ctx.mint, new PublicKey(credit.owner), credit.usd, blockhash, `kept-onramp:${orderId}`, ctx.prefix);
    ctx.signTx(tx);
    const signature = tx.signature ? bs58(tx.signature) : "";
    const rec: CreditRecord = { orderId, owner: credit.owner, usd: credit.usd, signature, issuedAt: Date.now() };
    await ctx.kv.put(key, JSON.stringify(rec), { expirationTtl: CREDIT_TTL });
    return json({ tx: btoa(String.fromCharCode(...tx.serialize())), usd: credit.usd });
  }
  return json({ error: "Not found" }, 404);
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function bs58(bytes: Uint8Array) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = "1" + s; }
  return s;
}
