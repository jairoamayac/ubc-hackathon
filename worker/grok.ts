// Grok Bot appeals council ("Kept Judge"): the three routes the Worker adds for it.
//   POST /api/appeal             builds the case, stores it as "pending" in KV and starts the Grok Bot routine (webhook)
//   POST /api/grok/callback      (alias /api/grok/verdict) the routine calls this back with the council's verdict (one-time Bearer token)
//   GET  /api/disputes/:id       status, verdict and council, for the app to poll
//   GET  /api/disputes/:id/image the proof screenshot, so the Bot can open it by link
//   POST /api/verify             task "verify": Grok checks public data itself (e.g. an X follower count)
//   GET  /api/verifications/:id  status and result of a verification, for the app to poll
//   POST /api/coach              task "coach": Grok turns a wish into a measurable goal with a stake that hurts
//   POST /api/group/ask          task "group": Grok writes reminders and nudges for the group
//   GET  /api/jobs/:id           status and result of a coach or group job, for the app to poll
//   POST /api/streams/quicknode  a QuickNode Stream posts the program's `KEPT:DisputeOpened` log here (HMAC-signed with X-QN-*, or the legacy x-kept-stream-secret header; see worker/quicknode.ts)
//   GET  /api/disputes?challenge=<pubkey>  the disputes the Stream saw on-chain for one pact (and the council case, if any)
// The council only proposes. Nothing here signs a transaction or moves money.
// Secrets (never in the repo): GROK_WEBHOOK_URL, GROK_WEBHOOK_KEY, QUICKNODE_STREAM_SECRET (the Stream's security token).
import { PROGRAM_ID } from "../src/lib/house-money/solana/hm";
import { disputesFromText, parseDisputeEvents, readStreamBody, verifyQuickNodeSignature, type ChainDispute } from "./quicknode";
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

interface VerifyRecord {
  verification_id: string;
  status: "pending" | "decided" | "failed";
  created_at: number;
  decided_at?: number;
  error?: string;
  verdict?: "KEPT" | "MISSED" | "CANNOT_VERIFY";
  observed?: string;
  checked_at?: string;
  source?: string;
  reason?: string;
  tokenHash?: string;
}
interface JobRecord {
  job_id: string;
  kind: "coach" | "group";
  status: "pending" | "decided" | "failed";
  created_at: number;
  decided_at?: number;
  error?: string;
  result?: Record<string, unknown>;
  tokenHash?: string;
}
const VERIFY_VERDICTS = ["KEPT", "MISSED", "CANNOT_VERIFY"] as const;
const HANDLE = /^@?[A-Za-z0-9_]{1,15}$/;

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
  // Lets the QuickNode route attach the on-chain event to this case instead of starting a second council.
  const challengeKey = clip(d.challenge, 64);
  const memberKey = clip(d.member_key, 64);
  if (BASE58.test(challengeKey) && BASE58.test(memberKey)) await env.DISPUTES.put(`link:${challengeKey}:${memberKey}`, id, { expirationTtl: TTL });
  if (image) await env.DISPUTES.put(`img:${id}`, image.bytes, { expirationTtl: TTL });

  const payload = {
    task: "judge",
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


/** Coach and group jobs: the callback is matched by its one-time token (jt:<hash> -> job id), so it does not need to echo any id. */
async function createJob(env: GrokEnv, base: string, kind: "coach" | "group", fields: Record<string, unknown>): Promise<Created> {
  if (!env.GROK_WEBHOOK_URL || !env.GROK_WEBHOOK_KEY) return { status: 503, body: { error: "Grok is not configured on this server." } };
  if (!env.DISPUTES) return { status: 503, body: { error: "Storage is not configured on this server." } };
  const id = crypto.randomUUID();
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const record: JobRecord = { job_id: id, kind, status: "pending", created_at: Date.now(), tokenHash };
  await env.DISPUTES.put(`j:${id}`, JSON.stringify(record), { expirationTtl: TTL });
  await env.DISPUTES.put(`jt:${tokenHash}`, id, { expirationTtl: TTL });
  const payload = { task: kind, ...fields, callback_url: `${base}/api/grok/callback`, callback_token: token };
  try {
    const res = await fetch(env.GROK_WEBHOOK_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.GROK_WEBHOOK_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Grok Bot did not start the run (HTTP ${res.status}).`);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Could not reach Grok Bot.";
    await env.DISPUTES.put(`j:${id}`, JSON.stringify({ ...record, status: "failed", error, tokenHash: undefined }), { expirationTtl: TTL });
    return { status: 502, body: { error, job_id: id, status: "failed" } };
  }
  return { status: 202, body: { job_id: id, status: "pending" } };
}

function parseCoach(b: Record<string, unknown>) {
  const goal = clip(b.goal, 200);
  if (!goal) return null;
  const stake = typeof b.suggested_stake_usd === "number" && Number.isFinite(b.suggested_stake_usd) ? Math.min(100_000, Math.max(0, Math.round(b.suggested_stake_usd))) : null;
  return {
    goal, criterion: clip(b.criterion, 300), deadline: clip(b.deadline, 60), proof_method: clip(b.proof_method, 300),
    verifiable_by: b.verifiable_by === "public_data" ? "public_data" : "friends",
    suggested_stake_usd: stake, stake_reason: clip(b.stake_reason, 400),
    tips: (Array.isArray(b.tips) ? b.tips : []).slice(0, 5).map((x) => clip(x, 200)).filter(Boolean),
  };
}

function parseGroup(b: Record<string, unknown>) {
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(0, 8).flatMap((raw) => {
    const m = (raw ?? {}) as Record<string, unknown>;
    const text = clip(m.text, 400);
    return text ? [{ to: clip(m.to, 60) || "all", text }] : [];
  });
  return messages.length ? { messages } : null;
}

/** Best effort per-IP limit so the public endpoints cannot burn the Bot's hourly runs. */
async function rateLimited(req: Request, env: GrokEnv): Promise<Response | null> {
  if (!env.DISPUTES) return null;
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const key = `rl:${ip}:${Math.floor(Date.now() / 600_000)}`;
  const n = Number((await env.DISPUTES.get(key)) ?? 0);
  if (n >= RATE_LIMIT) return json({ error: "Too many requests. Try again in a few minutes." }, 429);
  await env.DISPUTES.put(key, String(n + 1), { expirationTtl: 700 });
  return null;
}

/** Starts a "verify" run: Grok reads public data (e.g. X followers) and calls back with KEPT, MISSED or CANNOT_VERIFY. */
async function createVerification(env: GrokEnv, base: string, d: Record<string, unknown>): Promise<Created> {
  if (!env.GROK_WEBHOOK_URL || !env.GROK_WEBHOOK_KEY) return { status: 503, body: { error: "Grok is not configured on this server." } };
  if (!env.DISPUTES) return { status: 503, body: { error: "Storage is not configured on this server." } };
  const id = crypto.randomUUID();
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const source = "@" + clip(d.source, 20).replace(/^@/, "");
  const record: VerifyRecord = { verification_id: id, status: "pending", created_at: Date.now(), tokenHash: await sha256(token) };
  await env.DISPUTES.put(`v:${id}`, JSON.stringify(record), { expirationTtl: TTL });
  const payload = {
    task: "verify",
    verification_id: id,
    member: clip(d.member, 60),
    goal: clip(d.goal, 200),
    criterion: clip(d.criterion, 300),
    deadline: clip(d.deadline, 40),
    source,
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
    if (!res.ok) throw new Error(`Grok Bot did not start the run (HTTP ${res.status}).`);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Could not reach Grok Bot.";
    await env.DISPUTES.put(`v:${id}`, JSON.stringify({ ...record, status: "failed", error, tokenHash: undefined }), { expirationTtl: TTL });
    return { status: 502, body: { error, verification_id: id, status: "failed" } };
  }
  return { status: 202, body: { verification_id: id, status: "pending" } };
}

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

    const limited = await rateLimited(req, env);
    if (limited) return limited;

    const out = await createDispute(env, baseUrl(env, url), d, image);
    return json(out.body, out.status);
  }

  if ((path === "/api/grok/verdict" || path === "/api/grok/callback") && req.method === "POST") {
    const token = bearer(req);
    const body = await readJson(req, 40_000);
    if (!token || !body.ok || !env.DISPUTES) return json({ error: "Unauthorized" }, 401);
    const vid = clip(body.data.verification_id, 40);
    if (vid) {
      if (!UUID.test(vid)) return json({ error: "Unauthorized" }, 401);
      const rawV = await env.DISPUTES.get(`v:${vid}`);
      const v = rawV ? (JSON.parse(rawV) as VerifyRecord) : null;
      if (!v || v.status !== "pending" || !v.tokenHash || !same(v.tokenHash, await sha256(token))) return json({ error: "Unauthorized" }, 401);
      const verdict = VERIFY_VERDICTS.find((x) => x === body.data.verdict);
      if (!verdict) return json({ error: `verdict must be one of ${VERIFY_VERDICTS.join(", ")}.` }, 400);
      const observed = typeof body.data.observed === "number" ? String(body.data.observed) : clip(body.data.observed, 120);
      const done: VerifyRecord = {
        ...v, status: "decided", decided_at: Date.now(), tokenHash: undefined, verdict, observed,
        checked_at: clip(body.data.checked_at, 40), source: clip(body.data.source, 40), reason: clip(body.data.reason, 600),
      };
      await env.DISPUTES.put(`v:${vid}`, JSON.stringify(done), { expirationTtl: TTL });
      return json({ ok: true });
    }
    if (!clip(body.data.dispute_id, 40)) {
      // coach or group: matched by the one-time token alone
      const jid = await env.DISPUTES.get(`jt:${await sha256(token)}`);
      const rawJ = jid ? await env.DISPUTES.get(`j:${jid}`) : null;
      const job = rawJ ? (JSON.parse(rawJ) as JobRecord) : null;
      if (!job || job.status !== "pending" || !job.tokenHash || !same(job.tokenHash, await sha256(token))) return json({ error: "Unauthorized" }, 401);
      const result = job.kind === "coach" ? parseCoach(body.data) : parseGroup(body.data);
      if (!result) return json({ error: `Invalid ${job.kind} result.` }, 400);
      await env.DISPUTES.put(`j:${job.job_id}`, JSON.stringify({ ...job, status: "decided", decided_at: Date.now(), tokenHash: undefined, result }), { expirationTtl: TTL });
      return json({ ok: true });
    }
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

  if (path === "/api/verify" && req.method === "POST") {
    const body = await readJson(req, 20_000);
    if (!body.ok) return body.res;
    const d = body.data;
    if (!HANDLE.test(clip(d.source, 20))) return json({ error: "Enter a valid X handle, like @martin." }, 400);
    if (!clip(d.goal, 200) || !clip(d.criterion, 300)) return json({ error: "Goal and criterion are required." }, 400);
    const limited = await rateLimited(req, env);
    if (limited) return limited;
    const out = await createVerification(env, baseUrl(env, url), d);
    return json(out.body, out.status);
  }

  if (path === "/api/coach" && req.method === "POST") {
    const body = await readJson(req, 10_000);
    if (!body.ok) return body.res;
    const d = body.data;
    if (!clip(d.raw_goal, 200)) return json({ error: "Write your goal first." }, 400);
    const limited = await rateLimited(req, env);
    if (limited) return limited;
    const out = await createJob(env, baseUrl(env, url), "coach", {
      request_id: crypto.randomUUID(), member: clip(d.member, 60), raw_goal: clip(d.raw_goal, 200),
      ...(clip(d.deadline, 40) ? { deadline: clip(d.deadline, 40) } : {}), ...(clip(d.context, 400) ? { context: clip(d.context, 400) } : {}),
    });
    return json(out.body, out.status);
  }

  if (path === "/api/group/ask" && req.method === "POST") {
    const body = await readJson(req, 30_000);
    if (!body.ok) return body.res;
    const d = body.data;
    const members = (Array.isArray(d.members) ? d.members : []).slice(0, 12).map((raw) => {
      const m = (raw ?? {}) as Record<string, unknown>;
      return { name: clip(m.name, 60), goal: clip(m.goal, 200), deadline: clip(m.deadline, 40), status: clip(m.status, 20), last_proof_at: clip(m.last_proof_at, 40) || null };
    }).filter((m) => m.name);
    if (members.length === 0) return json({ error: "The group has no members to talk about yet." }, 400);
    const limited = await rateLimited(req, env);
    if (limited) return limited;
    const out = await createJob(env, baseUrl(env, url), "group", {
      group_id: clip(d.group_id, 64), members, ...(clip(d.recent_chat, 1500) ? { recent_chat: clip(d.recent_chat, 1500) } : {}), now: new Date().toISOString(),
    });
    return json(out.body, out.status);
  }

  const jm = /^\/api\/jobs\/([^/]+)$/.exec(path);
  if (jm && req.method === "GET") {
    if (!UUID.test(jm[1]) || !env.DISPUTES) return json({ error: "Not found" }, 404);
    const raw = await env.DISPUTES.get(`j:${jm[1]}`);
    if (!raw) return json({ error: "Not found" }, 404);
    const { tokenHash: _t, ...view } = JSON.parse(raw) as JobRecord;
    void _t;
    return json(view);
  }

  const vm = /^\/api\/verifications\/([^/]+)$/.exec(path);
  if (vm && req.method === "GET") {
    if (!UUID.test(vm[1]) || !env.DISPUTES) return json({ error: "Not found" }, 404);
    const raw = await env.DISPUTES.get(`v:${vm[1]}`);
    if (!raw) return json({ error: "Not found" }, 404);
    const { tokenHash: _t, ...view } = JSON.parse(raw) as VerifyRecord;
    void _t;
    return json(view);
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

  if (path === "/api/disputes" && req.method === "GET") {
    const challenge = url.searchParams.get("challenge") ?? "";
    if (!BASE58.test(challenge)) return json({ error: "challenge must be a pact address." }, 400);
    if (!env.DISPUTES) return json({ challenge, disputes: [] });
    const raw = await env.DISPUTES.get(`ql:${challenge}`);
    return json({ challenge, disputes: raw ? (JSON.parse(raw) as ChainEvent[]) : [] });
  }

  if (path === "/api/streams/quicknode" && req.method === "POST") return handleStream(req, url, env);

  return null;
}

/** What we keep for each dispute the Stream saw. */
interface ChainEvent extends ChainDispute {
  received_at: number;
  /** Grok council case for this dispute: linked to the app's appeal, started by this event, or why not. */
  council: "linked" | "started" | "unavailable";
  dispute_id?: string;
}

const EVENT_LIMIT = 20; // events handled per delivery
const LIST_LIMIT = 50; // events kept per pact

/** QuickNode Stream webhook: verifies the HMAC, stores each dispute event once, and makes sure a council case exists. */
async function handleStream(req: Request, url: URL, env: GrokEnv): Promise<Response> {
  const secret = env.QUICKNODE_STREAM_SECRET;
  if (!secret) return json({ error: "The QuickNode Stream is not configured on this server." }, 503);
  const text = await readStreamBody(req, 2_000_000).catch(() => undefined);
  if (text === undefined) return json({ error: "Unreadable body." }, 400);
  if (text === null) return json({ error: "Request too large." }, 413);
  // QuickNode's own scheme first (X-QN-Signature/Nonce/Timestamp). Fallback: the legacy custom header
  // `x-kept-stream-secret: <QUICKNODE_STREAM_SECRET>` (a Stream can send it as a custom header).
  const legacy = req.headers.get("x-kept-stream-secret") ?? "";
  const signed = await verifyQuickNodeSignature(req.headers, text, secret);
  if (!signed && !(legacy && same(await sha256(legacy), await sha256(secret)))) {
    // QuickNode's "Check connection" sends an unsigned test request (no X-QN-* headers). Answer it so the
    // dashboard can verify the URL, but process nothing: only signed deliveries are ever read or stored.
    if (!req.headers.get("x-qn-signature") && !legacy) return json({ ok: true, note: "Reachable. Only signed deliveries are processed." });
    return json({ error: "Unauthorized" }, 401);
  }
  if (!env.DISPUTES) return json({ error: "Dispute storage is not configured on this server." }, 503);
  let events: ChainDispute[];
  try {
    events = parseDisputeEvents(JSON.parse(text), PROGRAM_ID.toBase58()).slice(0, EVENT_LIMIT);
  } catch {
    // Legacy senders may post plain text containing the log line.
    if (signed) return json({ error: "Invalid JSON." }, 400);
    events = disputesFromText(text).slice(0, EVENT_LIMIT);
  }
  const stored: string[] = [];
  let duplicates = 0;
  for (const ev of events) {
    // The same block can arrive twice (retries, reorgs): the first copy wins.
    const key = `qe:${ev.signature ?? "nosig"}:${ev.challenge}:${ev.member}:${ev.disputer}`;
    if (await env.DISPUTES.get(key)) { duplicates++; continue; }

    const record: ChainEvent = { ...ev, received_at: Date.now(), council: "unavailable" };
    const linked = await env.DISPUTES.get(`link:${ev.challenge}:${ev.member}`);
    if (linked && UUID.test(linked)) {
      record.council = "linked";
      record.dispute_id = linked;
      const raw = await env.DISPUTES.get(`d:${linked}`);
      if (raw) {
        const rec = JSON.parse(raw) as Record_;
        rec.onchain = { signature: ev.signature, slot: ev.slot, blockTime: ev.blockTime, reason: ev.reason };
        await env.DISPUTES.put(`d:${linked}`, JSON.stringify(rec), { expirationTtl: TTL });
      }
    } else {
      try {
        const out = await createDispute(env, baseUrl(env, url), {
          challenge: ev.challenge, member: ev.member, disputer: ev.disputer,
          goal: "Opened on-chain: read the goal from the pact.",
          dispute_reason: "A dispute was opened on-chain and detected by QuickNode Streams.",
        });
        if (typeof out.body.dispute_id === "string") {
          record.council = "started";
          record.dispute_id = out.body.dispute_id;
          const raw = await env.DISPUTES.get(`d:${out.body.dispute_id}`);
          if (raw) {
            const rec = JSON.parse(raw) as Record_;
            rec.onchain = { signature: ev.signature, slot: ev.slot, blockTime: ev.blockTime, reason: ev.reason };
            await env.DISPUTES.put(`d:${out.body.dispute_id}`, JSON.stringify(rec), { expirationTtl: TTL });
          }
        }
      } catch { /* Grok Bot unreachable: the event is still recorded, and the Stream must not pause on our account. */ }
    }

    await env.DISPUTES.put(key, "1", { expirationTtl: TTL });
    const listKey = `ql:${ev.challenge}`;
    const list = JSON.parse((await env.DISPUTES.get(listKey)) ?? "[]") as ChainEvent[];
    list.push(record);
    await env.DISPUTES.put(listKey, JSON.stringify(list.slice(-LIST_LIMIT)), { expirationTtl: TTL });
    stored.push(ev.signature ?? key);
  }
  return json({ ok: true, matched: events.length, stored: stored.length, duplicates });
}
