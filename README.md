# Kept

> Promises that keep themselves.

Kept is a commitment app for friend groups. You lock money on your own goal, your friends are the witnesses, and when time is up the people who put money in confirm who kept their word. Keep it and your money comes back, plus a share of what others left; walk away and you lose it: 95% goes to the friends who kept theirs, 5% to Kept. Money is held onchain until the group confirms, so nobody has to trust anybody. Built at UBC Hackathon 2026 (Consumer Applications, Best use of Solana).

Front end changes are logged in [`docs/frontend-log.md`](docs/frontend-log.md); the brand rules for agents are in [`docs/branding-kit-agentes.md`](docs/branding-kit-agentes.md).

- **Live demo:** https://house-money-ubc.jairoamayac.workers.dev
- **Demo group** (open about 12 hours): https://house-money-ubc.jairoamayac.workers.dev/?crew=WUnPRfgz8KsUdFcJBYzPYQM6UpFTKxryKnFQj4NEu8a
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
| Not built yet | Appeal with proof reviewed by AI; a default outcome if nobody confirms; email login (Privy); automatic proof (Strava, Screen Time, Apple Health); real Apple Pay through an on-ramp |

## How it uses Solana

| What | Address |
|---|---|
| Program (Anchor 1.2) | [`9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht`](https://explorer.solana.com/address/9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht?cluster=devnet) |
| Test dollar (SPL token, 6 decimals) | [`FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn`](https://explorer.solana.com/address/FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn?cluster=devnet) |
| Fee sponsor | `HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY` |

- **Money is held by the program, not by us.** Each group has a vault owned by a program address; people hold shares of it. Every transfer is signed by the program; nobody can move someone else's money.
- **Pacts are accounts.** A pact stores the deadline and minimum; each person's stake and goal are their own accounts; one vote per person is enforced by a vote account.
- **Payouts are code.** Strict majority of the other participants decides; the 5% moves once to a treasury; winners collect stake plus a pro-rata share of the rest; if nobody kept their word, everyone is refunded.
- **Crypto stays invisible.** A Cloudflare Worker co-signs every transaction as fee payer (only this program's instructions, capped fees) and credits test dollars for the simulated Apple Pay. The app creates the user's key on the device.

Code: `programs/house_money/src` (on-chain program; the folder keeps its original name because the deployed program ID depends on it), `src/lib/house-money/solana` (client), `src/components` (screens), `worker/index.ts` (fee sponsor).

## Verified

| Check | Result |
|---|---|
| `scripts/kept-e2e.mts` on devnet | 9/9: own goal and stake, minimum enforced, only participants confirm, nobody confirms themselves, platform gets exactly 5% once, winners split 95% (Maria $20 → $32.67), no double claim, everyone can withdraw |
| `scripts/e2e.mts` on devnet | 15/15: group pots, shares, deposits and withdrawals |
| `scripts/social-e2e.mts` on devnet | 14/14 (also covers yes/no bets, still in the program but not in the app) |
| `scripts/worker-security.mts` on the live API | 14/14 attacks rejected |
| `cargo test` | 9 unit tests |
| Solana MCP `program_autofixer` | 0 issues |

## Run it

```bash
npm install
cargo build-sbf --manifest-path programs/house_money/Cargo.toml     # needs the Agave CLI
RPC_URL=http://127.0.0.1:8899 node scripts/e2e.mts                    # mint + config on solana-test-validator
RPC_URL=http://127.0.0.1:8899 node scripts/kept-e2e.mts
npm run build && npx wrangler deploy                                  # app + fee sponsor
```

Keys live in `keys/` (git-ignored). The Worker needs `SPONSOR_KEY` as a secret: `npx wrangler secret put SPONSOR_KEY`.

## Honest limits

- Devnet demo with test dollars. Apple Pay is simulated.
- Friends can collude: those who confirm also gain when someone walks away. Only people with money in confirm and nobody confirms themselves; appeals and automatic proof come next.
- Commitment contracts with real money are regulated (consumer protection, money transmission). Not a product on sale.

Earlier iterations of this repo are kept in [`archive/`](archive/) for history.
