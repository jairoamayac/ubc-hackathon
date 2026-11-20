// Grok Bot appeals council ("Kept Judge"): the three routes the Worker adds for it.
//   POST /api/appeal             builds the case, stores it as "pending" in KV and starts the Grok Bot routine (webhook)
//   POST /api/grok/callback      (alias /api/grok/verdict) the routine calls this back with the council's verdict (one-time Bearer token)
//   GET  /api/disputes/:id       status, verdict and council, for the app to poll
//   GET  /api/disputes/:id/image the proof screenshot, so the Bot can open it by link
//   POST /api/streams/quicknode  a QuickNode Stream posts DisputeOpened events here (needs the program to emit the log)
// The council only proposes. Nothing here signs a transaction or moves money.
// Secrets (never in the repo): GROK_WEBHOOK_URL, GROK_WEBHOOK_KEY, QUICKNODE_STREAM_SECRET (optional).
import { isVerdict, VERDICTS, type DisputeView, type Juror, type Tally, type VerdictKind } from "../src/lib/grok";

interface KV {
  get(key: string): Promise<string | null>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  put(key: string, value: string | ArrayBuffer, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface GrokEnv {
  DISPUTES?: KV;
  GROK_WEBHOOK_URL?: string;
  GROK_WEBHOOK_KEY?: string;
  QUICKNODE_STREAM_SECRET?: string;
  /** Optional: public base URL the Bot should call back, if it is not this request's own origin. */
  CALLBACK_BASE?: string;
}

interface Record_ extends DisputeView {
  tokenHash?: string;
  imageType?: string;
  input: { challenge: string; member: string; goal: string };
}

const TTL = 60 * 60 * 24 * 7;
const MAX_BODY = 900_000;
const MAX_IMAGE = 700_000;
const RATE_LIMIT = 5; // appeals per IP per 10 minutes
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });

const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer), (x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
/** Constant-time compare of two hex strings of the same length. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const bearer = (req: Request) => /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim() ?? "";

async function readJson(req: Request, max: number): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; res: Response }> {
  const text = await req.text();
  if (text.length > max) return { ok: false, res: json({ error: "Request too large." }, 413) };
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    return { ok: true, data: data as Record<string, unknown> };
  } catch {
    return { ok: false, res: json({ error: "Invalid JSON." }, 400) };
  }
}

const baseUrl = (env: GrokEnv, url: URL) => (env.CALLBACK_BASE || url.origin).replace(/\/+$/, "");

type Created = { status: number; body: Record<string, unknown> };

/** Stores the dispute as "pending" and starts the Grok Bot routine. Used by /api/appeal and by the Stream route. */
async function createDispute(
  env: GrokEnv,
  base: string,
  d: Record<string, unknown>,
  image?: { bytes: ArrayBuffer; type: string },
): Promise<Created> {
  if (!env.GROK_WEBHOOK_URL || !env.GROK_WEBHOOK_KEY) return { status: 503, body: { error: "The Grok council is not configured on this server." } };
  if (!env.DISPUTES) return { status: 503, body: { error: "Dispute storage is not configured on this server." } };

  const id = crypto.randomUUID();
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const proof = (d.proof ?? {}) as { description?: unknown };
  const record: Record_ = {
    dispute_id: id,
    status: "pending",
    created_at: Date.now(),
    tokenHash: await sha256(token),
    imageType: image?.type,
    input: { challenge: clip(d.challenge, 64), member: clip(d.member, 60), goal: clip(d.goal, 200) },
  };
  await env.DISPUTES.put(`d:${id}`, JSON.stringify(record), { expirationTtl: TTL });
  if (image) await env.DISPUTES.put(`img:${id}`, image.bytes, { expirationTtl: TTL });

  const payload = {
    dispute_id: id,
    challenge: clip(d.challenge, 64),
    member: clip(d.member, 60),
    disputer: clip(d.disputer, 60) || "a friend in the group",
    goal: clip(d.goal, 200),
    criterion: clip(d.criterion, 300),
    deadline: clip(d.deadline, 40),
    proof: { description: clip(proof.description, 600), image_url: image ? `${base}/api/disputes/${id}/image` : null },
    dispute_reason: clip(d.dispute_reason, 400),
    member_reply: clip(d.member_reply, 600),
    chat_excerpt: clip(d.chat_excerpt, 1500),
    callback_url: `${base}/api/grok/callback`,
    callback_token: token,
  };

  try {
    const res = await fetch(env.GROK_WEBHOOK_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.GROK_WEBHOOK_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    // 200 only means the run started. The verdict arrives later on /api/grok/verdict.
    if (!res.ok) throw new Error(`Grok Bot did not start the run (HTTP ${res.status}).`);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Could not reach Grok Bot.";
    const failed: Record_ = { ...record, status: "failed", error, tokenHash: undefined };
    await env.DISPUTES.put(`d:${id}`, JSON.stringify(failed), { expirationTtl: TTL });
    return { status: 502, body: { error, dispute_id: id, status: "failed" } };
  }
  return { status: 202, body: { dispute_id: id, status: "pending" } };
}

const asTally = (council: Juror[]): Tally => {
  const t: Tally = { KEPT: 0, MISSED: 0, NEEDS_MORE_EVIDENCE: 0 };
  for (const j of council) t[j.vote]++;
  return t;
};

/** Validates the callback body. Returns null when it does not look like a verdict. */
function parseVerdict(b: Record<string, unknown>) {
  if (!isVerdict(b.verdict)) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const council: Juror[] = (Array.isArray(b.council) ? b.council : []).slice(0, 3).flatMap((raw) => {
    const j = (raw ?? {}) as Record<string, unknown>;
    if (!isVerdict(j.vote)) return [];
    return [{ juror: clip(j.juror, 8) || "?", lens: clip(j.lens, 24), vote: j.vote as VerdictKind, confidence: num(j.confidence), reason: clip(j.reason, 500), coherent: j.coherent === true }];
  });
  const reasons = (Array.isArray(b.reasons) ? b.reasons : []).slice(0, 6).map((r) => clip(r, 500)).filter(Boolean);
  const evidence = clip(b.evidence_requested, 500);
  // The tally is recomputed from the jurors we accepted, so it can never disagree with what the app shows.
  return { verdict: b.verdict, confidence: num(b.confidence), reasons, evidence_requested: evidence || null, council, tally: asTally(council) };
}

const publicView = (r: Record_): DisputeView => {
  const { tokenHash: _t, imageType: _i, input: _in, ...view } = r;
  void _t; void _i; void _in;
  return view;
};

/** Returns a Response when the path belongs to the council, otherwise null. */
export async function handleGrok(req: Request, url: URL, env: GrokEnv): Promise<Response | null> {
  const path = url.pathname;

  if (path === "/api/appeal" && req.method === "POST") {
    const body = await readJson(req, MAX_BODY);
    if (!body.ok) return body.res;
    const d = body.data;
    if (!BASE58.test(clip(d.challenge, 64))) return json({ error: "Missing or invalid challenge." }, 400);
    if (!clip(d.goal, 200) || !clip(d.member, 60)) return json({ error: "Goal and member are required." }, 400);

    let image: { bytes: ArrayBuffer; type: string } | undefined;
    if (typeof d.image_data_url === "string" && d.image_data_url) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(d.image_data_url);
      if (!m) return json({ error: "The screenshot must be a jpeg, png or webp image." }, 400);
      const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      if (bin.byteLength > MAX_IMAGE) return json({ error: "The screenshot is too large." }, 413);
      image = { bytes: bin.buffer as ArrayBuffer, type: m[1] };
    }

    // Best effort per-IP limit so the public endpoint cannot burn the Bot's hourly runs.
    if (env.DISPUTES) {
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      const key = `rl:${ip}:${Math.floor(Date.now() / 600_000)}`;
      const n = Number((await env.DISPUTES.get(key)) ?? 0);
      if (n >= RATE_LIMIT) return json({ error: "Too many appeals. Try again in a few minutes." }, 429);
      await env.DISPUTES.put(key, String(n + 1), { expirationTtl: 700 });
    }

    const out = await createDispute(env, baseUrl(env, url), d, image);
    return json(out.body, out.status);
  }

  if ((path === "/api/grok/verdict" || path === "/api/grok/callback") && req.method === "POST") {
    const token = bearer(req);
    const body = await readJson(req, 40_000);
    if (!token || !body.ok || !env.DISPUTES) return json({ error: "Unauthorized" }, 401);
    const id = clip(body.data.dispute_id, 40);
    if (!UUID.test(id)) return json({ error: "Unauthorized" }, 401);
    const raw = await env.DISPUTES.get(`d:${id}`);
    const rec = raw ? (JSON.parse(raw) as Record_) : null;
    // One time token: it only works while the dispute is pending, and it is erased once the verdict is stored.
    if (!rec || rec.status !== "pending" || !rec.tokenHash || !same(rec.tokenHash, await sha256(token))) return json({ error: "Unauthorized" }, 401);
    const verdict = parseVerdict(body.data);
    if (!verdict) return json({ error: `verdict must be one of ${VERDICTS.join(", ")}.` }, 400);
    const decided: Record_ = { ...rec, ...verdict, status: "decided", decided_at: Date.now(), tokenHash: undefined };
    await env.DISPUTES.put(`d:${id}`, JSON.stringify(decided), { expirationTtl: TTL });
    return json({ ok: true });
  }

  const m = /^\/api\/disputes\/([^/]+)(\/image)?$/.exec(path);
  if (m && req.method === "GET") {
    if (!UUID.test(m[1]) || !env.DISPUTES) return json({ error: "Not found" }, 404);
    const raw = await env.DISPUTES.get(`d:${m[1]}`);
    if (!raw) return json({ error: "Not found" }, 404);
    const rec = JSON.parse(raw) as Record_;
    if (!m[2]) return json(publicView(rec));
    const bytes = await env.DISPUTES.get(`img:${m[1]}`, "arrayBuffer");
    if (!bytes || !rec.imageType) return json({ error: "Not found" }, 404);
    return new Response(bytes, { headers: { "content-type": rec.imageType, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  }

  if (path === "/api/streams/quicknode" && req.method === "POST") {
    // Ready for the day the program emits "KEPT:DisputeOpened challenge=.. member=.. disputer=..".
    const secret = env.QUICKNODE_STREAM_SECRET;
    const given = req.headers.get("x-kept-stream-secret") ?? "";
    if (!secret || !given || !same(await sha256(given), await sha256(secret))) return json({ error: "Unauthorized" }, 401);
    const text = await req.text();
    if (text.length > 2_000_000) return json({ error: "Request too large." }, 413);
    const found = [...text.matchAll(/KEPT:DisputeOpened\s+challenge=([1-9A-HJ-NP-Za-km-z]{32,44})\s+member=([1-9A-HJ-NP-Za-km-z]{32,44})(?:\s+disputer=([1-9A-HJ-NP-Za-km-z]{32,44}))?/g)];
    const started: string[] = [];
    for (const [, challenge, member, disputer] of found.slice(0, 5)) {
      const dedupe = `qn:${challenge}:${member}:${disputer ?? ""}`;
      if (env.DISPUTES && (await env.DISPUTES.get(dedupe))) continue; // Streams can deliver the same block twice.
      if (env.DISPUTES) await env.DISPUTES.put(dedupe, "1", { expirationTtl: 3600 });
      const out = await createDispute(env, baseUrl(env, url), {
        challenge, member, disputer,
        goal: "Opened on-chain: read the goal from the pact.",
        dispute_reason: "A DisputeOpened event was detected on-chain by QuickNode Streams.",
      });
      if (typeof out.body.dispute_id === "string") started.push(out.body.dispute_id);
    }
    return json({ ok: true, matched: found.length, started });
  }

  return null;
}
