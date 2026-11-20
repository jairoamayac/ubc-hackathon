# Kept

> Promises that keep themselves.

**Kept is a commitment app for friend groups.** You set a goal, put real money on it, and your friends are the
witnesses. When time is up, the people who also put money in vote on who kept their word. Keep it and your money
comes back, plus a share of what others left behind. Walk away and you lose it: 95% goes to the friends who kept
theirs, 5% to Kept. While the pact runs, the pot earns real interest. Nobody has to trust anybody: the money is
held by a Solana program, not by us and not by your friends.

Built at UBC Hackathon 2026 (Consumer Applications, Best use of Solana).

- **Live app:** https://kept.jairoamayac.workers.dev (Get started = your account; Try the demo = the
  75-second walkthrough). The first address, `house-money-ubc.jairoamayac.workers.dev`, redirects here.
- **Devnet proof:** [every escrow, pact and payout with explorer links](docs/devnet-proof.md)
- **What works today:** [integrations status](docs/integrations.md) · **Audit:** [findings and fixes](docs/audit-2026-11-20.md)

## Why it exists

Losing hurts about twice as much as winning feels good, yet habit apps try to motivate us with streaks and
rewards. Commitment contracts work, but nobody wants to send money to a stranger or a company to hold. Kept puts
the stake in your own friend group and the custody in code. More in [`docs/context.md`](docs/context.md).

## How it works

1. **Sign in with your email** (Privy creates your account; no wallet, no seed phrase).
2. **Add money** with Apple Pay or a card through **Crossmint** (staging; simulated test dollars when the Crossmint key is not set).
3. **Make a promise**: your own goal, your own stake, a deadline. Friends join the pact with theirs.
4. **While it runs**, the group's pot is lent on **Kamino Lend** and earns interest; the group screen shows *Earning on Kamino* with what it has earned so far.
5. **When time is up**, each participant votes on the others: *Kept it* or *Didn't*. A strict majority of the
   others decides; nobody loses money without that majority.
6. **Collect**: winners get their stake plus a share of 95% of what was left behind; Kept takes 5%, once. If
   nobody kept their word, everyone is refunded.
7. **Disagree?** Open a dispute: it is recorded on-chain and reviewed by the **Grok council**.

No fees, ever: the app pays every network fee.

## Integrations

| | What it does | Status |
|---|---|---|
| **Solana program** (Anchor) | Pots, shares, pacts, votes, 95/5 split, disputes | Live on devnet |
| **Kamino Lend** | Real yield on locked pots, exact share pricing | Live on devnet |
| **QuickNode** | Private RPC behind the Worker; pre-sign simulation; Streams for disputes | Live (RPC and Stream) |
| **Privy** | Email sign-in, embedded Solana account that signs | Live |
| **Cloudflare Workers** | Fee sponsor, RPC proxy, Grok routes, rate limits | Live |
| **Grok Bot** | Goal coach, "Verify with Grok", group check-in, appeals council | Live ([chat export](docs/grok-bot-chat-export.md)) |
| **Crossmint** | Apple Pay or card → dollars in the app | Built, staging, on behind a flag ([setup](docs/ONRAMP.md)) |

Details, what's missing and the secrets each one needs: [`docs/integrations.md`](docs/integrations.md).

## How it uses Solana

| What | Address (devnet) |
|---|---|
| Kept program (Anchor 1.2) | [`7nqWXrf9A6WwNxDJ3x1qH6UnCJs1o7iEHtRix7mnDQt1`](https://explorer.solana.com/address/7nqWXrf9A6WwNxDJ3x1qH6UnCJs1o7iEHtRix7mnDQt1?cluster=devnet) |
| Kamino Lend market / hmUSD reserve | `G5m4WrATTWncPShWDRkagCM934FYezTRYd2C69sTWkJQ` / `JBiEdktmtJsrrzhmHsfFSZqt2x6SLBjTwm9grDmupGZ6` |
| Test dollar (SPL token, 6 decimals) | [`FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn`](https://explorer.solana.com/address/FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn?cluster=devnet) |
| Fee sponsor | `HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY` |
| First program (earlier demo) | `9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht` |

- **Money is held by the program, not by us.** Each group has a vault owned by a program address; people hold
  shares of it. Every transfer is signed by the program.
- **Yield without trust games.** The pot is lent on Kamino through CPI; shares are only priced with the pot back
  home, so a late joiner never takes interest earned by others.
- **Payouts are code.** Votes, the 5% fee (once), payouts and refunds are enforced on-chain.
- **Crypto stays invisible.** Privy signs for the person; a Cloudflare Worker pays fees only for Kept's own
  instructions, after simulating them on QuickNode.

Architecture and trust model: [`docs/architecture.md`](docs/architecture.md).

### Grok Bot: the appeals council

When a friend disputes a result, `open_dispute` records it on-chain and logs `KEPT:DisputeOpened`. A QuickNode
Stream forwards that log to our Worker, which sends the case to a Grok Bot routine: a council of three
independent AI jurors (does the proof meet the goal, is it fraudulent, what do both sides say) that vote blind,
Kleros-style. The verdict and each juror's reasons come back to the group. **The verdict is advisory: it never
moves money by itself**; the group's vote does. The same routine coaches vague goals into measurable ones,
nudges the group chat, and verifies public goals (like an X follower count) by reading the data itself.
Setup: [`docs/quicknode-stream.md`](docs/quicknode-stream.md); rules: [`docs/PRODUCT.md`](docs/PRODUCT.md); every run from the live app: [`docs/grok-bot-chat-export.md`](docs/grok-bot-chat-export.md) (8 runs: 3 judge, 4 coach, 1 verify).

## Verified

| Check | Result |
|---|---|
| `scripts/kept-e2e.mts` on devnet | 10/10: own goal and stake, minimum enforced, only participants vote, nobody votes on themselves, 5% fee once, winners split 95% (Maria $20 → $32.67), no double claim, refund when nobody votes |
| `scripts/kamino-e2e.mts` on devnet | 7/7: pot lent on Kamino, exact pricing, late joiner pays the exact price, anyone can bring the pot home, real interest paid out |
| `scripts/dispute-e2e.mts` on devnet | 10/10: who can dispute and when, once per entry, the on-chain log the Stream reads, settlement unaffected |
| `scripts/app-e2e.mts` on the live URL | 6/6: three people with no SOL run a whole pact through the app's own client and the Worker |
| `scripts/worker-security.mts` on the live URL | 32/32 attacks rejected |
| `cargo test` · Solana MCP `program_autofixer` | 12 unit tests · 0 issues |

## Run it

Everything runs from a clean clone with no secrets in the repo. Keys are generated into `keys/` and
`.dev.vars`, both git-ignored. Needs Node 20+, Rust and the Agave CLI (`solana`, `cargo build-sbf`).

**Local, everything real** (a validator with the real Kamino program cloned from mainnet):

```bash
npm install
scripts/kamino-local.sh                                        # builds the program, starts a validator on :8999
KLEND_SDK=/path/to/klend-sdk scripts/kamino-local-market.sh    # Kamino market, reserves, a real borrower
RPC_URL=http://127.0.0.1:8999 KAMINO_FILE=kamino-local.json NEED_INTEREST=0 npx jiti scripts/kamino-e2e.mts
RPC_URL=http://127.0.0.1:8999 npx jiti scripts/kept-e2e.mts
RPC_URL=http://127.0.0.1:8999 npx jiti scripts/dispute-e2e.mts
npm run build && scripts/worker-local.sh                       # app + API on http://localhost:8788
APP_URL=http://localhost:8788 npx jiti scripts/app-e2e.mts
API=http://localhost:8788 npx jiti scripts/worker-security.mts
```

`klend-sdk` is [Kamino-Finance/klend-sdk](https://github.com/Kamino-Finance/klend-sdk), cloned with its
dependencies installed. `npm run dev` runs the front end alone; `/demo` needs no network at all.

**Devnet:** the deployed program's config, mint and Kamino market are run by the team's sponsor key. To operate
your own copy, deploy the program under your own ID (`declare_id!` and `HM_PROGRAM_ID`).

**Configuration** (see [`.dev.vars.example`](.dev.vars.example)):

| Name | Where | What |
|---|---|---|
| `SPONSOR_KEY` | Worker secret / `.dev.vars` | sponsor keypair that pays fees |
| `QUICKNODE_URL` | Worker secret / `.dev.vars` | private RPC ([docs/quicknode.md](docs/quicknode.md)) |
| `GROK_WEBHOOK_URL`, `GROK_WEBHOOK_KEY` | Worker secrets | Grok council |
| `QUICKNODE_STREAM_SECRET` | Worker secret | signed dispute Stream |
| `NEXT_PUBLIC_PRIVY_APP_ID` | `.env.production` (public) | Privy sign-in ([docs/privy-setup.md](docs/privy-setup.md)) |
| `RPC_URL`, `MINT`, `KAMINO_*` | `wrangler.jsonc` vars (public) | cluster, test dollar, Kamino market |

Deploy: `npm run build && npx wrangler deploy`.

## Repository

| Path | What |
|---|---|
| `programs/house_money/src` | On-chain program (the folder keeps its first name: the program ID depends on it) |
| `src/lib/house-money/solana` | Client: instruction builders, `LiveClient`, polite RPC fetch, Privy signer |
| `src/components` | Live app (v5 screens), `/demo`, sign-in, Grok sheets |
| `worker/` | Cloudflare Worker `kept`: sponsor, RPC proxy, Grok council, QuickNode Stream; `worker/redirect` keeps the old address forwarding |
| `scripts/` | End-to-end tests, local Kamino setup, demo seeding |
| `docs/` | [Index](docs/README.md): context, product rules, architecture, decisions, integrations, audit, setup guides |
| `design/`, `docs/brand/` | v5 mockups and the "Lila y mandarina" brand kit |
| `archive/` | Earlier iterations, kept for history |

## Honest limits

- Devnet with test dollars. Crossmint runs in staging (no real card is charged); without its server key, Add funds uses simulated Apple Pay.
- Friends can collude, and anyone with an invite link can join a group: enough fake members could form a
  majority. Invite-only groups are the next program change ([audit](docs/audit-2026-11-20.md)).
- On devnet, pots are lent on the team's own Kamino market; mainnet would use Kamino's main market.
- Commitment contracts with real money are regulated (consumer protection, money transmission). Not a product
  on sale.
