# Kept

> Promises that keep themselves.

Kept is a commitment app for friend groups. You lock money on your own goal, your friends are the witnesses, and when time is up the people who put money in confirm who kept their word. Keep it and your money comes back, plus a share of what others left; walk away and you lose it: 95% goes to the friends who kept theirs, 5% to Kept. Money is held onchain until the group confirms, so nobody has to trust anybody. Built at UBC Hackathon 2026 (Consumer Applications, Best use of Solana).

Front end changes are logged in [`docs/frontend-log.md`](docs/frontend-log.md); the brand rules for agents are in [`docs/branding-kit-agentes.md`](docs/branding-kit-agentes.md).

- **Live demo:** https://house-money-ubc.jairoamayac.workers.dev
- **Live stack:** program `7nqW…` with Kamino yield, RPC through QuickNode (`/api/rpc`), sign-in with Privy, Grok council routes. `scripts/app-e2e.mts` passes 6/6 against the live URL.
- **Devnet proof:** [every escrow, pact and payout with explorer links](docs/devnet-proof.md)
- **Docs:** [why it exists](docs/context.md) · [architecture](docs/architecture.md) · [decisions](docs/decisions.md) · [demo and pitch](docs/demo.md)

## Try the demo

Open `/demo` for the whole story in 75 seconds, offline and simulated: five friends, $50 each, a disputed proof, a Grok Bot proposal, and a payout. Press **D** for the next step, or **Demo controls > Play all**.

## Try it

1. Open the demo group link, enter your first name.
2. Tap **Join with money** and pay with **Apple Pay** (simulated, test dollars, no card charged).
3. On the open pact, tap **Lock money on my goal**, write your goal and pick an amount.
4. Or start your own pact with a 2-minute deadline and invite a friend.
5. When time is up, confirm each friend: **Kept it** or **Didn't**. Then **Collect**.

No wallet, no seed phrase, no fees: the app covers them.

## Status

| | |
|---|---|
| Built and live on devnet | Groups with invite links and names; Apple Pay top-up (simulated); pacts where each person locks money on their own goal; only people who put money in confirm, never themselves, by strict majority; 95% of what's left behind to those who kept their word, 5% to the platform, taken once; automatic payouts; sponsored fees |
| Not built yet | Appeal with proof reviewed by AI; a default outcome if nobody confirms; automatic proof (Strava, Screen Time, Apple Health); real Apple Pay through an on-ramp |

## How it uses Solana

| What | Address |
|---|---|
| Program (Anchor 1.2, with Kamino yield) | [`7nqWXrf9A6WwNxDJ3x1qH6UnCJs1o7iEHtRix7mnDQt1`](https://explorer.solana.com/address/7nqWXrf9A6WwNxDJ3x1qH6UnCJs1o7iEHtRix7mnDQt1?cluster=devnet) |
| Kamino Lend market / hmUSD reserve (devnet) | `G5m4WrATTWncPShWDRkagCM934FYezTRYd2C69sTWkJQ` / `JBiEdktmtJsrrzhmHsfFSZqt2x6SLBjTwm9grDmupGZ6` |
| Earlier program (first live demo) | `9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht` |
| Test dollar (SPL token, 6 decimals) | [`FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn`](https://explorer.solana.com/address/FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn?cluster=devnet) |
| Fee sponsor | `HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY` |

- **Money is held by the program, not by us.** Each group has a vault owned by a program address; people hold shares of it. Every transfer is signed by the program; nobody can move someone else's money.
- **Pacts are accounts.** A pact stores the deadline and minimum; each person's stake and goal are their own accounts; one vote per person is enforced by a vote account.
- **Payouts are code.** Strict majority of the other participants decides; the 5% moves once to a treasury; winners collect stake plus a pro-rata share of the rest; if nobody kept their word, everyone is refunded.
- **Crypto stays invisible.** A Cloudflare Worker co-signs every transaction as fee payer (only this program's instructions, capped fees) and credits test dollars for the simulated Apple Pay. People sign in with their email (one-time code) through Privy, which creates their account (see [`docs/privy-setup.md`](docs/privy-setup.md)); without a Privy app id the app falls back to a demo key on the device.

Code: `programs/house_money/src` (on-chain program; the folder keeps its original name because the deployed program ID depends on it), `src/lib/house-money/solana` (client), `src/components` (screens), `worker/index.ts` (fee sponsor).

## Verified

| Check | Result |
|---|---|
| `scripts/kept-e2e.mts` on devnet (via QuickNode) | 10/10: own goal and stake, minimum enforced, only participants confirm, nobody confirms themselves, platform gets exactly 5% once, winners split 95% (Maria $20 → $32.67), no double claim, everyone can withdraw, refund when nobody votes |
| `scripts/kamino-e2e.mts` on devnet (via QuickNode) | 7/7: the pot is lent on Kamino Lend, shares are only priced with the pot home, a late joiner pays the exact price, any member can bring the pot home, real interest paid out |
| `scripts/app-e2e.mts` on devnet (via QuickNode) | 6/6: three people with no SOL run a whole pact through the app's own client and the Worker |
| `scripts/worker-security.mts` | 22/22 attacks rejected (sponsor co-signing, top-ups, the RPC proxy) |
| `cargo test` | 12 unit tests |
| Solana MCP `program_autofixer` | 0 issues |

### Grok Bot's role: a Kleros-style appeals court

Grok Bot is Kept's appeals court. When a friend disputes a proof, the app (and, on-chain, a QuickNode Stream watching our program's `DisputeOpened` event) sends the case to a Grok Bot routine through its webhook. The routine convenes a council of three independent AI jurors with different lenses (does the proof meet the criterion, is it fraudulent, what do both parties say). They vote blind using the Schelling-point game theory behind Kleros: each juror votes for the verdict it expects the other honest jurors to reach, the majority wins, and coherent jurors are marked as such. The verdict and each juror's reasons come back to our Worker, the group sees them, and only then does our backend sign the on-chain `resolve`. Grok Bot proposes, the contract settles, and no one's money moves on a single opinion. The chat export is in `docs/grok-bot-chat-export.md`.

The same Grok Bot routine also coaches users into measurable goals with a stake that hurts, keeps the group chat honest with reminders and nudges, and auto-verifies public goals (like an X follower count) by reading the data itself.

Wiring (Worker only, no keys in the repo): `POST /api/appeal` stores the dispute in KV and calls the webhook, `POST /api/grok/callback` receives the verdict with a one-time token, `GET /api/disputes/:id` is what the app polls. The same webhook also serves the `verify` role: `POST /api/verify` and `GET /api/verifications/:id` power "Verify with Grok", where Grok reads a public X follower count itself. The `coach` role (`POST /api/coach`, shown as a suggestion card next to the instant coach) and the `group` role (`POST /api/group/ask`, the "Grok check-in" card in a group) use the same flow and `GET /api/jobs/:id`. Setup: `npx wrangler secret put GROK_WEBHOOK_URL` and `npx wrangler secret put GROK_WEBHOOK_KEY`; the `DISPUTES` KV namespace is created on first deploy. The "Instant demo judge" in the appeal sheet is an offline fallback, clearly labelled.

## Run it

Everything runs from a clean clone with no secrets in the repo. Keys are generated into `keys/` and
`.dev.vars`, both git-ignored. Needs Node 20+, Rust and the Agave CLI (`solana`, `cargo build-sbf`).

**1. Local, everything real (validator + the real Kamino program cloned from mainnet):**

```bash
npm install
scripts/kamino-local.sh                                   # builds the program, starts a validator on :8999
KLEND_SDK=/path/to/klend-sdk scripts/kamino-local-market.sh   # Kamino market, reserves, a real borrower
RPC_URL=http://127.0.0.1:8999 KAMINO_FILE=kamino-local.json NEED_INTEREST=0 npx jiti scripts/kamino-e2e.mts
npm run build && scripts/worker-local.sh                   # app + API on http://localhost:8788
APP_URL=http://localhost:8788 npx jiti scripts/app-e2e.mts # three friends, a whole pact, through the app
API=http://localhost:8788 npx jiti scripts/worker-security.mts
```

`klend-sdk` is [Kamino-Finance/klend-sdk](https://github.com/Kamino-Finance/klend-sdk), cloned with its dependencies installed.

**2. Devnet:** the program is deployed at the address in `programs/house_money/src/lib.rs`. Its config,
mint and Kamino market are run by the team's sponsor key, so to operate your own copy deploy the program
under your own ID (`declare_id!` + `HM_PROGRAM_ID`) and run `scripts/e2e.mts` to create mint and config.

**Configuration** (see [`.dev.vars.example`](.dev.vars.example)):

| Name | Where | What |
|---|---|---|
| `SPONSOR_KEY` | Worker secret / `.dev.vars` | sponsor keypair that pays fees |
| `QUICKNODE_URL` | Worker secret / `.dev.vars` | optional private RPC, see [docs/quicknode.md](docs/quicknode.md) |
| `RPC_URL`, `MINT`, `KAMINO_*` | `wrangler.jsonc` vars | cluster, test dollar, Kamino market (public values) |

Deploy: `npm run build && npx wrangler deploy`, after `npx wrangler secret put SPONSOR_KEY` (and `QUICKNODE_URL`).

## Honest limits

- Devnet demo with test dollars. Apple Pay is simulated.
- Friends can collude: those who confirm also gain when someone walks away. Only people with money in confirm and nobody confirms themselves; appeals and automatic proof come next.
- Commitment contracts with real money are regulated (consumer protection, money transmission). Not a product on sale.

Earlier iterations of this repo are kept in [`archive/`](archive/) for history.
