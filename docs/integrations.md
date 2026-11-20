# Integrations: what works, what doesn't, what's missing

Checked against the live app (`kept.jairoamayac.workers.dev`) and devnet on 20 Nov 2026.

| Integration | What it does in Kept | Status | What's missing |
|---|---|---|---|
| **Solana program** (Anchor 1.2, devnet `7nqWXrf9…`) | Group pots, shares, pacts with your own goal and stake, votes, 95/5 split, 5% fee once, refunds, disputes | **Works.** e2e 10/10 (pact) and 10/10 (disputes) on devnet; 12 unit tests | Invite-only joining (see audit, contract H1); mainnet deploy with a multisig upgrade authority |
| **Kamino Lend** (klend CPI) | Locked pots are lent and earn real interest; every money action brings the pot home, acts at the exact price, re-lends | **Works** on devnet (team's own market + a real borrower): e2e 7/7, app e2e 6/6 | Mainnet: Kamino's main USDC market; partial redeems so a fully borrowed reserve can't block actions |
| **QuickNode** (private RPC) | All app reads and sends go through the Worker's `/api/rpc` to our endpoint; public RPC as fallback; sponsor simulates before signing | **Works** live | Dashboard method/rate limits; rotate the token after the hackathon. The Priority Fee API add-on only supports mainnet endpoints, so on devnet the app uses the fixed fee (no congestion there); on mainnet it switches to live fees with no code change |
| **QuickNode Streams** | Turns the on-chain `KEPT:DisputeOpened` log into a call to the Worker, which starts the Grok review | **Works** end to end, live (20 Nov): `dispute-e2e` opened 2 disputes on devnet; the Stream delivered both (signed), the Worker stored them and started a Grok council case for each, and both came back decided by 3 jurors (`GET /api/disputes?challenge=sNGWrvLK…`) | — |
| **Cloudflare Worker** (fee sponsor) | People never hold SOL: the Worker co-signs as fee payer, only for the app's own instructions, after a passing simulation; rate-limited | **Works.** 32/32 attacks rejected on the live URL | Turnstile on top-ups and appeals before real money |
| **Privy** (email sign-in) | Email one-time code; Privy creates and holds the person's Solana account and signs every action | **Works** on the live domain: the sign-in opens Privy's email login; tested by the team (sign-in, account, sponsored transactions) | — |
| **Grok Bot** (routine "Kept Grok", worker/grok.ts) | Goal coach on the new-goal screen, "Verify with Grok" for public goals (X followers), group check-in, appeals council of 3 blind jurors | **Works** live (20 Nov): the coach turned "Correr los sábados" into a measurable goal with proof and a $50 stake in ~20 s; Verify read @solana on X (4,218,194 followers) and returned `KEPT`; an appeal with a proof dated in the future came back `NEEDS_MORE_EVIDENCE` (0.85) with the jurors' reasons | Advisory by design: the group's vote moves money, never Grok |
| **Crossmint** (Apple Pay or card) | Add money | **Built** (PR #16, `worker/onramp.ts`, `AddFundsCrossmint`, staging, behind a flag): turns on when the Worker has `CROSSMINT_SERVER_KEY`; until then Add funds uses the simulated Apple Pay (`/api/topup`, test dollars) | Set `CROSSMINT_SERVER_KEY` (staging) on the Worker; see `docs/ONRAMP.md` |
| **Pyth** | USDC/USD price feed for the Kamino reserve | **Works** (through Kamino) | — |
| **Offline demo** (`/demo`) | The whole story in 75 s with no network | **Works**; same welcome as the app | — |

## Secrets in production (Cloudflare Worker)

| Secret | Set |
|---|---|
| `SPONSOR_KEY` | yes |
| `QUICKNODE_URL` | yes |
| `GROK_WEBHOOK_URL`, `GROK_WEBHOOK_KEY` | yes |
| `QUICKNODE_STREAM_SECRET` | yes |
| `CROSSMINT_SERVER_KEY` | **no** (Crossmint stays off until it is set) |

Public build values live in `.env.production` (`NEXT_PUBLIC_PRIVY_APP_ID`). Nothing secret is in the repo; see `.dev.vars.example`.
