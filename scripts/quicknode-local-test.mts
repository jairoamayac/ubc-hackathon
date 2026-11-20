// Posts a QuickNode-style signed delivery to the Worker and checks what it stores.
//   wrangler dev --port 8787 --var QUICKNODE_STREAM_SECRET:local-test-security-token [--var GROK_WEBHOOK_URL:...]
//   node scripts/quicknode-local-test.mts sample.json        (a "Programs + Logs" payload; scripts/dispute-e2e.mts writes one with WRITE_SAMPLE=file)
// Env: WORKER_URL (default http://127.0.0.1:8787), QN_SECRET (default local-test-security-token), QN_GZIP=1 to send gzip.
import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import vm from "node:vm";

const URL_ = (process.env.WORKER_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const SECRET = process.env.QN_SECRET ?? "local-test-security-token";
const sample = JSON.parse(fs.readFileSync(process.argv[2] ?? "scripts/fixtures/quicknode-sample.json", "utf8"));

// 1. Run the REAL Stream filter (scripts/quicknode-filter.js) on the sample, like QuickNode does.
const sandbox: Record<string, unknown> = {};
vm.runInNewContext(fs.readFileSync(new URL("./quicknode-filter.js", import.meta.url), "utf8"), sandbox);
const filtered = (sandbox.main as (s: unknown) => unknown)(sample) as { disputes: { challenge: string; member: string }[] } | null;
console.log("filter output:", JSON.stringify(filtered));
if (!filtered) { console.error("filter returned null"); process.exit(1); }
const skipped = (sandbox.main as (s: unknown) => unknown)({ data: [[{ signature: "x", logs: ["Program Fake1111111111111111111111111111111111111 invoke [1]", "Program log: KEPT:DisputeOpened challenge=" + filtered.disputes[0].challenge + " member=" + filtered.disputes[0].member + " disputer=" + filtered.disputes[0].member + " reason=1", "Program Fake1111111111111111111111111111111111111 success"], success: true }]], metadata: {} });
console.log("lookalike program is ignored by the filter:", skipped === null);

// 2. Sign like QuickNode: HMAC-SHA256(token, nonce + timestamp + body) as hex.
async function post(body: string, opts: { secret?: string; tamper?: boolean } = {}) {
  const nonce = randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", opts.secret ?? SECRET).update(nonce + timestamp + body).digest("hex");
  const raw = process.env.QN_GZIP ? gzipSync(body) : Buffer.from(body);
  const res = await fetch(`${URL_}/api/streams/quicknode`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-qn-nonce": nonce, "x-qn-timestamp": timestamp, "x-qn-signature": signature, ...(process.env.QN_GZIP ? { "content-encoding": "gzip" } : {}) },
    body: opts.tamper ? (process.env.QN_GZIP ? gzipSync(body + " ") : Buffer.from(body + " ")) : raw,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const check = (cond: unknown, msg: string) => { if (!cond) { console.error("  ✗", msg); process.exit(1); } console.log("  ✓", msg); };

const body = JSON.stringify(filtered);
let r = await post(body, { secret: "wrong-token" });
check(r.status === 401, `wrong security token -> ${r.status} Unauthorized`);
r = await post(body, { tamper: true });
check(r.status === 401, `body changed after signing -> ${r.status} Unauthorized`);
r = await fetch(`${URL_}/api/streams/quicknode`, { method: "POST", body }).then(async (x) => ({ status: x.status, body: await x.json() }));
check(r.status === 401, `no QuickNode headers -> ${r.status} Unauthorized`);
r = await post(body);
check(r.status === 200 && r.body.ok && r.body.stored + r.body.duplicates === 1, `valid delivery (stored=1 on a fresh KV, duplicates=1 when re-run) -> ${r.status} ${JSON.stringify(r.body)}`);
r = await post(body);
check(r.status === 200 && r.body.stored === 0 && r.body.duplicates === 1, `same delivery again is ignored -> ${JSON.stringify(r.body)}`);
r = await post(JSON.stringify(sample)); // raw dataset (no filter) works too: the Worker re-checks the invoke stack itself
check(r.status === 200 && r.body.stored === 0 && r.body.duplicates === 1, `raw "Programs + Logs" payload parses to the same event -> ${JSON.stringify(r.body)}`);
r = await post(JSON.stringify({ data: [[{ signature: "s", logs: ["Program log: KEPT:DisputeOpened challenge=" + filtered.disputes[0].challenge + " member=" + filtered.disputes[0].member + " disputer=" + filtered.disputes[0].member + " reason=1"], success: true }]] }));
check(r.status === 200 && r.body.matched === 0, `a log line without our program's invoke frame is ignored -> ${JSON.stringify(r.body)}`);

const list = await fetch(`${URL_}/api/disputes?challenge=${filtered.disputes[0].challenge}`).then((x) => x.json());
console.log("GET /api/disputes?challenge=…:", JSON.stringify(list, null, 2));
check(list.disputes.length === 1 && list.disputes[0].member === filtered.disputes[0].member, "the app can read the dispute back");
console.log("\nAll checks passed.");
