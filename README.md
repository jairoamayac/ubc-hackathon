# House Money

> Save with your crew. Bet on your night. Whoever bails, pays.

House Money turns your group chat into a savings club with stakes. You add money with Apple Pay and put it in a **crew** pot with your friends. The pot earns every second. Then the fun part:

- **Bets on real life.** "Will Leo kiss the girl in red tonight?" Everyone puts money on yes or no before the deadline. The next day the crew votes on what happened (Leo can bet, but can't vote on his own bet), and the winners split the losers' stakes.
- **Challenges where whoever fails pays the rest.** "Gym 3 times this week, $10 each." When the week ends the crew votes on each person. Whoever didn't do it loses their $10, split among the ones who did.

Stakes come out of your part of the pot and **keep earning yield while they're locked**. People never see a wallet, a seed phrase, SOL or a fee. Under the hood it runs on Solana.

Built for the UBC Hackathon 2026 (Consumer Apps track, Solana). Inspired by social prediction apps (JuryDuty), commitment apps (Pact, Forfeit, Goals) and no-loss savings (Lotty, Premium Bonds).

- **Live demo (Solana devnet):** https://house-money-ubc.jairoamayac.workers.dev
- Architecture and flows: [`docs/architecture.md`](docs/architecture.md) · Brand: [`docs/brand.md`](docs/brand.md)

## Try it in 2 minutes

1. Open the app, pick a name, tap **Add money with Apple Pay** (test dollars).
2. Start a crew or open an invite link (`/?crew=<address>`), and add money to it.
3. **Bets → New bet**: write the question, pick who it's about, close it in 1 minute. Put money on yes or no.
4. When time is up, vote **It happened / It didn't**. A strict majority of the crew (minus the subject) decides; the winners tap **Collect**.
5. **Challenges → New challenge**: set the stake and deadline, friends tap **I'm in**. When it ends, judge each person **Did it / Didn't**, then collect.

To play a full crew alone: `scripts/demo-seed.mts` creates friends (Leo, Maya, Josh) with a live bet and challenge and prints an invite link; `scripts/demo-act.mts <crew>` makes them vote and collect.

## On devnet

| What | Address |
|---|---|
| Program `house_money` | [`9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht`](https://explorer.solana.com/address/9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht?cluster=devnet) |
| Test dollar (hmUSD, 6 decimals) | [`FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn`](https://explorer.solana.com/address/FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn?cluster=devnet) |
| Price feed (Pyth SOL/USD, PriceUpdateV2) | [`7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE`](https://explorer.solana.com/address/7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE?cluster=devnet) |
| Sponsor (fee payer, upgrade authority) | `HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY` |

Demo settings: 5% a year, sped up 5,000x so earnings visibly tick.

## How it works

```
Apple Pay (simulated) ─► your cash (hmUSD) ─► crew pot (program vault, shares) ── earns every second
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                    Bet (yes/no)                                   Challenge (stake each)
            shares locked on a side                         shares locked per participant
            crew votes after the deadline                   crew judges each person
            winners split losers' shares                    those who did it split the forfeits
```

- **`programs/house_money`** (Anchor 1.2):
  - `lib.rs`: crews, members, share accounting with a virtual offset (no inflation attack), yield paid from a reserve. Every token movement is signed by a PDA.
  - `social.rs`: profiles, bets, positions, challenges, entries and one-per-person votes. No tokens move: shares go from a member to the bet/challenge and back to the winners inside the same vault, so locked stakes keep earning. Invariants S1–S5 are listed at the top of the file.
- **`worker/index.ts`** (Cloudflare Worker): serves the app and only **signs**. `/api/topup` returns a sponsor-signed hmUSD transfer; `/api/sponsor` vets a transaction (only our program, the sponsor may only pay rent, capped priority fee) and co-signs it as fee payer. The app submits to the RPC.
- **`src/lib/house-money/solana`**: dependency-light client (instruction encoding, PDAs, decoders) and `LiveClient`. The account key is created on the device (Privy embedded wallets in production).

## Verified

- `cargo test`: 8 unit tests (interest, share math, settlement, Pyth parsing, majority, pro-rata payouts never create shares, refunds when nobody wins).
- Solana MCP `program_autofixer` (security lint) on `lib.rs` + `social.rs`: 0 issues.
- `scripts/social-e2e.mts`: 14 on-chain checks of bets and challenges: one position and one vote per person, no votes before the deadline, the subject can't vote on themselves, majority decides, payouts match the formula and conserve shares, no double claims, no joining after the deadline, whoever fails pays the rest, everyone can still withdraw.
- `scripts/e2e.mts`: 15 on-chain checks of savings and yield (strangers can't withdraw, principal protections, a member leaves with at least what they put in).
- `scripts/worker-security.mts`: 14 attacks on the live edge API (drain SOL or dollars from the sponsor, sponsor as owner, foreign instructions, oversized priority fees, bad top-ups). All rejected; legit requests signed.
- `scripts/yield-check.mts`: proves accrual on devnet (pot grows by exactly what the reserve pays).

## Run it

```bash
npm install
cargo build-sbf --manifest-path programs/house_money/Cargo.toml     # needs the Agave CLI
RPC_URL=http://127.0.0.1:8899 node scripts/e2e.mts                    # sets up mint + config on solana-test-validator
RPC_URL=http://127.0.0.1:8899 node scripts/social-e2e.mts
npm run build && npx wrangler deploy                                  # app + edge API
```

Keys live in `keys/` (git-ignored). The Worker needs `SPONSOR_KEY` as a secret: `npx wrangler secret put SPONSOR_KEY`.

## Honest limits (devnet demo)

- Dollars are a test token and Apple Pay is simulated. Production would use an on-ramp (Coinbase Onramp or MoonPay with Apple Pay) into USDC.
- Devnet has no real yield; the reserve pays a fixed rate. Production would earn from USDC lending.
- Outcomes are decided by the crew's vote. A crew can collude; that's the social contract of a friends' bet. Production would add verifiable data sources where they exist (flight status, scores) and a dispute window.
- Bets and challenges with money are regulated (gambling, sweepstakes, commitment contracts). This is a devnet demo with test dollars.
- An older "tryhard" mode (SOL up/down with Pyth) is still in the program but no longer in the app.
