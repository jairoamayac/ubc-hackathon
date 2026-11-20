# QuickNode Stream for Kept: setup and test plan

What this does: a participant opens a dispute in the app → the program `9iBNS61W…` logs
`KEPT:DisputeOpened challenge=… member=… disputer=… reason=N dispute=…` and emits a `DisputeOpened` event →
a QuickNode Stream (Solana **devnet**) filters for that line → POSTs to our Worker → the Worker verifies the
signature, stores the dispute in KV (`DISPUTES`), and makes sure a Grok council case exists (links to the app's
appeal, or starts the judge itself). The app and the demo can read it back with `GET /api/disputes?challenge=<pact>`.

Worker URL (does not change): `https://house-money-ubc.jairoamayac.workers.dev`
**Destination webhook:** `https://house-money-ubc.jairoamayac.workers.dev/api/streams/quicknode`

## 0. Order of operations (important)

1. Jairo merges the PR and deploys the Worker (`npm run build && npx wrangler deploy`). The route answers `503` until the secret exists.
2. Jairo upgrades the program on devnet (see "Deploy" below). Needs Jairo's upgrade-authority key.
3. Josué creates the Stream (section 1) and copies the **Security token**.
4. Jairo sets it: `npx wrangler secret put QUICKNODE_STREAM_SECRET` (paste the token; never put it in git or chat logs).
5. Start / resume the Stream. If it paused itself because the Worker answered 503 before the secret existed, press Resume (QuickNode pauses a Stream after the configured number of failed retries, default 3).

## 0b. Program upgrade on devnet (Jairo; needs the upgrade-authority key, not done by us)

* Upgrade authority: `HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY` (the fee sponsor; its key is `keys/sponsor.json` on Jairo's machine, also stored as the Worker secret `SPONSOR_KEY`). No copy of it exists in the repo, its history or on the box.
* Build: `cargo build-sbf --manifest-path programs/house_money/Cargo.toml` → `target/deploy/house_money.so` (647,696 bytes; the deployed ProgramData is 636,976 bytes, so it must grow by ≥ 10,720 bytes).
* Cost: buffer rent ≈ **3.29 SOL** (refunded when the upgrade completes) + extending ProgramData ≈ **0.06 SOL** + fees < 0.01 SOL. Peak need ≈ **3.4 SOL**, net cost ≈ 0.06 SOL. The sponsor holds **1.87 SOL** on devnet today, so it is ≈ 1.6 SOL short for the peak: airdrop at <https://faucet.solana.com>, or pay the buffer from another funded wallet (second option below). Keep a few tenths of SOL afterwards: the sponsor also pays every user's fees.
* Command (the CLI extends ProgramData automatically; this was verified on a local validator with CLI 4.4.1):

```bash
solana program deploy target/deploy/house_money.so --program-id 9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht \
  --upgrade-authority keys/sponsor.json -k keys/sponsor.json -u devnet
```
* Or, when the sponsor lacks SOL, a funded wallet pays for the buffer and the sponsor only signs the upgrade:

```bash
solana program extend 9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht 16384 -k <funded.json> -u devnet
solana program write-buffer target/deploy/house_money.so -k <funded.json> -u devnet          # prints BUFFER
solana program set-buffer-authority BUFFER --new-buffer-authority HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY -k <funded.json> -u devnet
solana program deploy --buffer BUFFER --program-id 9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht \
  --upgrade-authority keys/sponsor.json -k keys/sponsor.json -u devnet
```
* Existing accounts are safe: no existing account struct changed (the dispute lives in its own PDA), the new instruction and error were only appended. Verified: a pact with stakes was created under the OLD program on a local validator, the program was upgraded in place, then dispute, votes, fee and payouts all ran on those old accounts.

## 1. Create the Stream (Josué, in his QuickNode account: Dashboard → Streams → Create Stream)

| Field | Value |
|---|---|
| Network | **Solana → Devnet** (Solana Devnet is listed as supported for Streams) |
| Dataset | **Programs + Logs** (Solana). Fallback: **Block** (the filter below handles both shapes) |
| Stream start | latest block / real time (no backfill needed) |
| Batch size / distance from tip | defaults (1 / 0) |
| Filter | **Modify the stream payload**, language **JavaScript**, paste the whole file `scripts/quicknode-filter.js` (below) |
| Destination | **Webhook** |
| URL | `https://house-money-ubc.jairoamayac.workers.dev/api/streams/quicknode` |
| Payload compression | **None** (the Worker also accepts gzip, but None is the safest for the demo) |
| Timeout / retry | defaults (30 s / retry every 1 s / pause after 3 failures) |
| Custom headers | none needed |
| **Security token** | shown in the webhook destination settings (field "Security token", with a **Rotate** button) and in the Stream's **Settings** tab. Copy it and give it to Jairo for `wrangler secret put QUICKNODE_STREAM_SECRET`. If you rotate it, set the secret again. |

Use the editor's **Run test** with `scripts/fixtures/quicknode-sample.json` as input; the output should be a JSON with one item in `disputes`.

### Filter (JavaScript) — `scripts/quicknode-filter.js`

It keeps only `Program log: KEPT:DisputeOpened …` lines that were printed by our program id (it follows the invoke/success stack, so a lookalike program that prints the same text is ignored), skips failed transactions, and returns `null` for batches with no dispute so the webhook only fires on real events.

```js
// QuickNode Streams filter (JavaScript) for Kept. Paste the whole file into the Stream's "Modify the stream
// payload" editor. Runs on QuickNode: keeps only dispute lines written by OUR program, drops everything else.
// Works with the Solana "Programs + Logs" dataset (data: [[{ signature, slot, blockTime, logs, success }]])
// and, as a fallback, the "Block" dataset (transactions[].meta.logMessages).
// Returns null when a batch has no dispute, so the webhook only fires for real events.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function main(stream) {
  const PROGRAM = "9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht";
  const LINE = /^Program log: KEPT:DisputeOpened challenge=([1-9A-HJ-NP-Za-km-z]{32,44}) member=([1-9A-HJ-NP-Za-km-z]{32,44}) disputer=([1-9A-HJ-NP-Za-km-z]{32,44}) reason=(\d{1,3})(?: dispute=([1-9A-HJ-NP-Za-km-z]{32,44}))?$/;
  const disputes = [];

  function scan(logs, meta) {
    // Follow the invoke/success stack so only lines printed by our program count (a lookalike program can't fake one).
    const stack = [];
    for (const line of logs) {
      let m = /^Program (\S+) invoke \[\d+\]$/.exec(line);
      if (m) { stack.push(m[1]); continue; }
      if (/^Program (\S+) (success|failed.*)$/.test(line)) { stack.pop(); continue; }
      if (stack[stack.length - 1] !== PROGRAM) continue;
      m = LINE.exec(line);
      if (m) disputes.push({ challenge: m[1], member: m[2], disputer: m[3], reason: Number(m[4]), dispute: m[5] || null, signature: meta.signature, slot: meta.slot, blockTime: meta.blockTime });
    }
  }

  function visit(node, blockTime) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const n of node) visit(n, blockTime); return; }
    // Programs + Logs shape
    if (Array.isArray(node.logs)) {
      if (node.success !== false) scan(node.logs, { signature: node.signature, slot: node.slot, blockTime: node.blockTime });
      return;
    }
    // Block shape
    if (Array.isArray(node.transactions)) {
      for (const tx of node.transactions) {
        const logs = tx && tx.meta && tx.meta.logMessages;
        if (logs && !tx.meta.err) scan(logs, { signature: tx.transaction && tx.transaction.signatures && tx.transaction.signatures[0], slot: node.parentSlot != null ? node.parentSlot + 1 : null, blockTime: node.blockTime });
      }
    }
  }

  visit(stream.data, null);
  return disputes.length ? { disputes: disputes, network: stream.metadata && stream.metadata.network } : null;
}
```

Output delivered to the webhook:
`{ "disputes": [{ "challenge", "member", "disputer", "reason", "dispute", "signature", "slot", "blockTime" }], "network": "solana-devnet" }`

## 2. How the Worker authenticates the Stream

QuickNode signs each delivery with the Stream's security token. Headers `X-QN-Nonce`, `X-QN-Timestamp`, `X-QN-Signature`;
`X-QN-Signature = hex(HMAC-SHA256(key = security token, message = X-QN-Nonce + X-QN-Timestamp + body))`, no separators, over the
decompressed body as received. Sources: QuickNode docs, Streams → Webhook destination → Security → HMAC Verification
(<https://www.quicknode.com/docs/streams/destinations/webhooks>) and QuickNode's reference implementation
(<https://github.com/quiknode-labs/streams-webhook-validate-signature>). The docs do not state a maximum age for
`X-QN-Timestamp`, so the Worker does not guess one; replays are harmless because every dispute event is stored once
(keyed by transaction signature + challenge + member + disputer).

Worker secret name: **`QUICKNODE_STREAM_SECRET`** (already used by `wrangler.jsonc` comments and `worker/grok.ts` on the council branches).

## 3. Test plan

### A. Local, no QuickNode, no devnet (done on the box, all green)

```bash
npm ci && npm run build
npx wrangler dev --port 8787 --var QUICKNODE_STREAM_SECRET:local-test-security-token \
  --var GROK_WEBHOOK_URL:http://127.0.0.1:9999/hook --var GROK_WEBHOOK_KEY:k --var SPONSOR_KEY:"[]"
node scripts/quicknode-local-test.mts            # QN_GZIP=1 to send gzip
```
It runs the real filter on a payload built from real local-validator logs, signs it like QuickNode, and checks:
wrong token / tampered body / missing headers → 401; valid → 200 stored; replay → duplicate; raw dataset parses to the same event;
a log line without our program's invoke frame is ignored; `GET /api/disputes?challenge=…` returns it.

### B. On devnet, after the program upgrade and with the Stream running

1. Tail the Worker: `npx wrangler tail house-money-ubc --format pretty` (look for `POST /api/streams/quicknode 200`).
2. In the app (devnet), finish a pact, and with a participant press **Disagree with this result** → **Send to the Grok council**. That sends the case, then calls `open_dispute` (sponsored by the Worker).
   Or from a script: `RPC_URL=https://api.devnet.solana.com node scripts/dispute-e2e.mts` (needs `keys/sponsor.json` funded and `keys/devnet.json`; creates a test crew/pact and opens disputes).
3. Check the transaction on the explorer: logs contain `Program log: KEPT:DisputeOpened …`.
4. Within a few seconds QuickNode's Stream dashboard shows a delivery; the Worker answers `{"ok":true,"matched":1,"stored":1}`.
5. Read it back: `curl 'https://house-money-ubc.jairoamayac.workers.dev/api/disputes?challenge=<PACT_ADDRESS>'` → `council: "linked"` (came from the app's appeal) or `"started"` (opened without the app).
6. `GET /api/disputes/<dispute_id>` shows `onchain: { signature, slot, blockTime, reason }` next to the council verdict.

If nothing arrives: Stream dashboard → Logs (filter output), confirm network = devnet and dataset, confirm the token matches the secret (401 in `wrangler tail` means mismatch).
