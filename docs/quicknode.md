# QuickNode (private RPC)

Kept reads the chain and sends transactions through an RPC node. By default that is the public
`api.devnet.solana.com`, which rate limits (HTTP 429) and is not allowed for production apps.
With QuickNode configured, every RPC call from the app goes to our own endpoint.

## How it fits

```
phone (LiveClient) ── /api/rpc ──> Worker ── QUICKNODE_URL (secret) ──> QuickNode ──> Solana
        └── if the proxy fails ──> RPC_URL (public fallback)
```

- **The token never reaches the browser.** `QUICKNODE_URL` is a Worker secret. `/api/config` gives the app
  `https://<app>/api/rpc`, and the Worker forwards the calls.
- **Not an open relay.** `/api/rpc` only forwards an allowlist of read and send methods
  (`worker/index.ts`, `RPC_METHODS`). No airdrops or history scans; `getProgramAccounts` only for the Kept
  program; batches up to 20 calls; bodies up to 64 KB. Covered by `scripts/worker-security.mts`.
- **Automatic fallback.** If QuickNode is down, rate limited, or refuses a method, the app retries that
  call on the public `RPC_URL` (`rpcFetch` in `live.ts`). Users never notice.
- **Dynamic priority fees.** With the Priority Fee API add-on enabled on the endpoint, the app asks
  `qn_estimatePriorityFees` for the live `recommended` fee on Kept's program (cached 30 s), clamped
  between 200,000 and 1,000,000 µlamports per compute unit (the cap the sponsor Worker co-signs). Without
  the add-on it uses the fixed 200,000, as before.
- **Contracts don't change.** QuickNode is infrastructure only.

## Setup

1. On quicknode.com create a **Solana Devnet** endpoint (mainnet later is just a new URL). Optional: enable
   the **Solana Priority Fee API** add-on.
2. Production Worker:
   ```bash
   npx wrangler secret put QUICKNODE_URL
   ```
3. Local: add `QUICKNODE_URL=https://<name>.solana-devnet.quiknode.pro/<token>/` to `.dev.vars` (never committed).
4. Scripts and deploys: pass the same URL as `RPC_URL`, e.g.
   `RPC_URL=$QUICKNODE_URL npx jiti scripts/kamino-e2e.mts`, or `solana program deploy -u $QUICKNODE_URL ...`.

Without `QUICKNODE_URL` everything works exactly as before on the public RPC.

## Verified (local validator standing in for QuickNode)

- `worker-security.mts` through the proxy: 22/22 (14 existing + 8 proxy attacks); without the proxy: 14/14.
- `app-e2e.mts` through `/api/rpc`: 6/6 (top-ups, group, Kamino, votes, 5% fee once, withdrawals).
- QuickNode unreachable: the app falls back to the public RPC, tops up and creates a group.
- In the browser every app call goes to `/api/rpc`, no console errors.

## Verified on devnet with our QuickNode endpoint (2026-11-20)

- Endpoint: Solana Devnet (`*.solana-devnet.quiknode.pro`), Free plan. URL only in `.dev.vars` / Worker secret.
- `worker-security.mts` through `/api/rpc` on devnet: 22/22.
- Real transactions through the app's LiveClient: a $5 top-up confirmed in 1.1 s, a group created in 1.3 s;
  all 15 RPC calls went through QuickNode, none to the public RPC.
- Priority Fee API add-on not enabled yet (`Method not found`): the app keeps the fixed fee. It is a free
  add-on: Endpoint → Add-ons → Solana Priority Fee API.
- QuickNode does not hand out devnet SOL (`requestAirdrop` → "RPC faucet is closed"); use faucet.solana.com.
