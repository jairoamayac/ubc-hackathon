// QuickNode Streams receiver helpers (pure functions, no I/O, easy to test).
//
// Signature scheme (QuickNode Streams, webhook destination "Security token"):
//   X-QN-Signature = hex( HMAC-SHA256( key = security token, message = X-QN-Nonce + X-QN-Timestamp + body ) )
//   with no separators, the body being the decompressed JSON exactly as received.
//   Docs: https://www.quicknode.com/docs/streams/destinations/webhooks (Security / HMAC Verification)
//   Reference implementation: https://github.com/quiknode-labs/streams-webhook-validate-signature
const enc = new TextEncoder();
const toHex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

/** Constant-time string compare. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** True when the three X-QN-* headers match the body under the stream's security token. */
export async function verifyQuickNodeSignature(headers: Headers, body: string, secret: string): Promise<boolean> {
  const nonce = headers.get("x-qn-nonce") ?? "";
  const timestamp = headers.get("x-qn-timestamp") ?? "";
  const given = (headers.get("x-qn-signature") ?? "").toLowerCase();
  if (!secret || !nonce || !timestamp || !/^[0-9a-f]{64}$/.test(given)) return false;
  return same(await hmacHex(secret, nonce + timestamp + body), given);
}

/** Reads the body as the payload that was signed: gunzips when the Stream compresses its deliveries. */
export async function readStreamBody(req: Request, maxBytes: number): Promise<string | null> {
  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.byteLength > maxBytes) return null;
  if ((req.headers.get("content-encoding") ?? "").toLowerCase() !== "gzip") return new TextDecoder().decode(raw);
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  return out.byteLength > maxBytes * 4 ? null : new TextDecoder().decode(out);
}

export interface ChainDispute {
  challenge: string;
  member: string;
  disputer: string;
  reason: number;
  /** The Dispute account created by the instruction. */
  dispute?: string;
  signature?: string;
  slot?: number;
  blockTime?: number;
}

const B58 = "[1-9A-HJ-NP-Za-km-z]{32,44}";
/** The line the program writes: `KEPT:DisputeOpened challenge=.. member=.. disputer=.. reason=N dispute=..` */
export const DISPUTE_LINE = new RegExp(`KEPT:DisputeOpened\\s+challenge=(${B58})\\s+member=(${B58})\\s+disputer=(${B58})\\s+reason=(\\d{1,3})(?:\\s+dispute=(${B58}))?`);
const INVOKE = /^Program (\S+) invoke \[\d+\]$/;
const DONE = /^Program (\S+) (?:success|failed.*)$/;
const LOG = /^Program log: (.*)$/;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Dispute lines written by OUR program (tracked through the invoke/success stack, so a lookalike program can't spoof one). */
export function disputesFromLogs(logs: string[], programId: string): Omit<ChainDispute, "signature" | "slot" | "blockTime">[] {
  const stack: string[] = [];
  const found: Omit<ChainDispute, "signature" | "slot" | "blockTime">[] = [];
  for (const line of logs) {
    const inv = INVOKE.exec(line);
    if (inv) { stack.push(inv[1]); continue; }
    if (DONE.test(line)) { stack.pop(); continue; }
    const log = LOG.exec(line);
    if (log && stack[stack.length - 1] === programId) {
      const m = DISPUTE_LINE.exec(log[1]);
      if (m) found.push({ challenge: m[1], member: m[2], disputer: m[3], reason: Number(m[4]), dispute: m[5] });
    }
  }
  return found;
}

/** Legacy: dispute lines found anywhere in a plain-text body (no invoke-stack check, so only for senders that hold the shared secret). */
export function disputesFromText(text: string): ChainDispute[] {
  const g = new RegExp(DISPUTE_LINE.source, "g");
  return [...text.matchAll(g)].map((m) => ({ challenge: m[1], member: m[2], disputer: m[3], reason: Number(m[4]), dispute: m[5] }));
}

const isStr = (v: unknown, re: RegExp): v is string => typeof v === "string" && re.test(v);
const B58_RE = new RegExp(`^${B58}$`);

/**
 * Pulls dispute events out of whatever the Stream delivered:
 *  - our filter's output: `{ disputes: [{ challenge, member, disputer, reason, signature, slot, blockTime }] }`
 *  - the raw "Programs + Logs" dataset (objects with `logs`) or the raw "Block" dataset (`meta.logMessages`).
 * Failed transactions (`success: false` / `meta.err`) are ignored.
 */
export function parseDisputeEvents(payload: unknown, programId: string): ChainDispute[] {
  const out: ChainDispute[] = [];
  const seen = new Set<string>();
  const push = (d: ChainDispute) => {
    const k = `${d.signature ?? ""}:${d.challenge}:${d.member}:${d.disputer}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(d);
  };
  let budget = 200_000; // nodes visited: a hostile body can't make us spin
  const walk = (node: unknown, depth: number) => {
    if (budget-- <= 0 || depth > 12 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
    const o = node as Record<string, unknown>;

    if (Array.isArray(o.disputes)) {
      for (const raw of o.disputes) {
        const d = (raw ?? {}) as Record<string, unknown>;
        const reason = num(d.reason);
        if (isStr(d.challenge, B58_RE) && isStr(d.member, B58_RE) && isStr(d.disputer, B58_RE) && reason !== undefined && reason >= 0 && reason <= 255) {
          push({
            challenge: d.challenge, member: d.member, disputer: d.disputer, reason,
            dispute: isStr(d.dispute, B58_RE) ? d.dispute : undefined,
            signature: str(d.signature), slot: num(d.slot), blockTime: num(d.blockTime),
          });
        }
      }
    }

    const meta = (o.meta ?? null) as Record<string, unknown> | null;
    const logs = Array.isArray(o.logs) ? o.logs : meta && Array.isArray(meta.logMessages) ? meta.logMessages : null;
    if (logs && o.success !== false && !(meta && meta.err)) {
      const tx = (o.transaction ?? null) as Record<string, unknown> | null;
      const sig = str(o.signature) ?? (tx && Array.isArray(tx.signatures) ? str(tx.signatures[0]) : undefined);
      for (const d of disputesFromLogs(logs.filter((l): l is string => typeof l === "string"), programId)) {
        push({ ...d, signature: sig, slot: num(o.slot), blockTime: num(o.blockTime) });
      }
    }

    for (const v of Object.values(o)) walk(v, depth + 1);
  };
  walk(payload, 0);
  return out;
}
