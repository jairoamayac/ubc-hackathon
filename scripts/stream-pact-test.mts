// The QuickNode Stream route builds a real case file before it calls Grok.
// Runs the Worker's handler in-process with a fake KV and a fake Grok webhook, and feeds it signed Stream deliveries:
//   1. a DisputeOpened event for a real devnet pact -> the judge job carries the pact's goal, criterion, deadline and votes
//   2. an event for a pact that does not exist      -> no Grok run, the event is stored as "skipped"
//   3. the same delivery again                      -> deduplicated
//   RPC_URL=https://api.devnet.solana.com npx jiti scripts/stream-pact-test.mts
// The pact in (1) defaults to one opened by scripts/dispute-e2e.mts on devnet; override with PACT=challenge,member,disputer.
import { handleGrok } from "../worker/grok.ts";
import { hmacHex } from "../worker/quicknode.ts";
import { PROGRAM_ID } from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const [challenge, member, disputer] = (process.env.PACT ??
  "sNGWrvLKnHkHMEtT76XY2Nhha6UPEhZa5vAKqMJ6QBg,8wieBSEPyVz5PcziK13S7ie8vSUGNBZhh7Jwsd3xmSJe,29hxSUQTDg3YgsiRYXfqXH1aFJEdJsFRTKiNEp8gGYzB").split(",");
const GHOST = "11111111111111111111111111111112"; // no pact lives here

let step = 0;
const ok = (m: string) => console.log(`  ✓ ${++step}. ${m}`);
function assert(c: unknown, m: string): asserts c { if (!c) { console.error(`  ✗ ${m}`); process.exit(1); } }

const kv = new Map<string, string>();
const KV = {
  get: async (k: string, type?: string) => (type === "arrayBuffer" ? null : kv.get(k) ?? null),
  put: async (k: string, v: string) => void kv.set(k, String(v)),
};
const SECRET = "test-stream-secret";
const env = { DISPUTES: KV, QUICKNODE_STREAM_SECRET: SECRET, RPC_URL: RPC, GROK_WEBHOOK_URL: "https://grok.test/webhook", GROK_WEBHOOK_KEY: "test-key" } as never;

// Grok webhook is fake; everything else (the devnet RPC) goes to the network.
const jobs: Record<string, unknown>[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input) === "https://grok.test/webhook") {
    jobs.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;

const line = (ch: string, m: string, d: string) => `Program log: KEPT:DisputeOpened challenge=${ch} member=${m} disputer=${d} reason=1 dispute=${GHOST}`;
async function deliver(sig: string, ch: string, m: string, d: string) {
  const body = JSON.stringify([{ signature: sig, slot: 1, blockTime: 1, logs: [`Program ${PROGRAM_ID.toBase58()} invoke [1]`, line(ch, m, d), `Program ${PROGRAM_ID.toBase58()} success`] }]);
  const nonce = "n" + sig, ts = String(Date.now());
  const req = new Request("https://kept.test/api/streams/quicknode", {
    method: "POST", body,
    headers: { "x-qn-nonce": nonce, "x-qn-timestamp": ts, "x-qn-signature": await hmacHex(SECRET, nonce + ts + body) },
  });
  const res = await handleGrok(req, new URL(req.url), env);
  return (await res!.json()) as { stored: number; duplicates: number };
}

console.log(`Stream -> pact -> Grok on ${RPC}`);
const r1 = await deliver("sigReal", challenge, member, disputer);
assert(r1.stored === 1 && jobs.length === 1, `one judge job for the real pact (stored ${r1.stored}, jobs ${jobs.length})`);
const j = jobs[0] as { task: string; goal: string; criterion: string; deadline: string; dispute_reason: string; chat_excerpt: string; callback_token: string };
assert(j.task === "judge" && j.callback_token, "a judge job with a one-time callback token");
assert(j.goal && !j.goal.startsWith("Opened on-chain"), `goal read from the chain: "${j.goal}"`);
assert(j.criterion.includes("majority") && j.deadline.endsWith("Z"), "criterion and deadline filled from the pact");
assert(/proof|contested|appeal|kept/i.test(j.dispute_reason), "a concrete dispute reason from the reason code");
ok(`real pact: Grok gets goal "${j.goal}", deadline ${j.deadline}, reason "${j.dispute_reason}"`);
ok(`and the context: ${j.chat_excerpt}`);

const r2 = await deliver("sigGhost", GHOST, member, disputer);
const events = JSON.parse(kv.get(`ql:${GHOST}`) ?? "[]") as { council: string }[];
assert(r2.stored === 1 && jobs.length === 1 && events[0]?.council === "skipped", "a pact that can't be read is stored as skipped and never reaches Grok");
ok("unreadable pact: event stored as \"skipped\", no Grok run");

const r3 = await deliver("sigReal", challenge, member, disputer);
assert(r3.duplicates === 1 && jobs.length === 1, "the same delivery twice is handled once");
ok("a repeated delivery is deduplicated");
console.log(`\nAll ${step} Stream checks passed.`);
