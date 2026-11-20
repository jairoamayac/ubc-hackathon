# Integrations: what works, what doesn't, what's missing

Checked against the live app (`kept.jairoamayac.workers.dev`) and devnet on 20 Nov 2026.

| Integration | What it does in Kept | Status | What's missing |
|---|---|---|---|
| **Solana program** (Anchor 1.2, devnet `7nqWXrf9…`) | Group pots, shares, pacts with your own goal and stake, votes, 95/5 split, 5% fee once, refunds, disputes | **Works.** e2e 10/10 (pact) and 10/10 (disputes) on devnet; 12 unit tests | Invite-only joining (see audit, contract H1); mainnet deploy with a multisig upgrade authority |
| **Kamino Lend** (klend CPI) | Locked pots are lent and earn real interest; every money action brings the pot home, acts at the exact price, re-lends | **Works** on devnet (team's own market + a real borrower): e2e 7/7, app e2e 6/6 | Mainnet: Kamino's main USDC market; partial redeems so a fully borrowed reserve can't block actions |
| **QuickNode** (private RPC) | All app reads and sends go through the Worker's `/api/rpc` to our endpoint; public RPC as fallback; sponsor simulates before signing | **Works** live | Dashboard method/rate limits; rotate the token after the hackathon. The Priority Fee API add-on only supports mainnet endpoints, so on devnet the app uses the fixed fee (no congestion there); on mainnet it switches to live fees with no code change |
| **QuickNode Streams** | Turns the on-chain `KEPT:DisputeOpened` log into a call to the Worker, which starts the Grok review | **Code ready**: program emits the log (dispute e2e 10/10 on devnet), Worker parser and signed webhook built | Create the Stream in the QuickNode dashboard and set `QUICKNODE_STREAM_SECRET` (`docs/quicknode-stream.md`) |
| **Cloudflare Worker** (fee sponsor) | People never hold SOL: the Worker co-signs as fee payer, only for the app's own instructions, after a passing simulation; rate-limited | **Works.** 32/32 attacks rejected on the live URL | Turnstile on top-ups and appeals before real money |
| **Privy** (email sign-in) | Email one-time code; Privy creates and holds the person's Solana account and signs every action | **Deployed.** Tested by the team locally (sign-in, account, first sponsored tx) | Try it on the live domain with a real email |
| **Grok council** (worker/grok.ts) | Goal coach, "Verify with Grok" for public goals (X followers), group check-in, appeals with a screenshot | **Code deployed, not active**: the routes answer "Grok is not configured" | `npx wrangler secret put GROK_WEBHOOK_URL` and `GROK_WEBHOOK_KEY` (from the Grok Bot team) |
| **Apple Pay** | Add money | **Simulated** (`/api/topup` sends test dollars) | Crossmint Onramp (`docs/apple-pay-plan.md`): staging keys, a USDC-devnet instance of the program, checkout in the app |
| **Pyth** | USDC/USD price feed for the Kamino reserve | **Works** (through Kamino) | — |
| **Offline demo** (`/demo`) | The whole story in 75 s with no network | **Works**; same welcome as the app | — |

## Secrets in production (Cloudflare Worker)

| Secret | Set |
|---|---|
| `SPONSOR_KEY` | yes |
| `QUICKNODE_URL` | yes |
| `GROK_WEBHOOK_URL`, `GROK_WEBHOOK_KEY` | **no** |
| `QUICKNODE_STREAM_SECRET` | **no** |
| `CROSSMINT_SERVER_KEY` (planned) | **no** |

Public build values live in `.env.production` (`NEXT_PUBLIC_PRIVY_APP_ID`). Nothing secret is in the repo; see `.dev.vars.example`.
