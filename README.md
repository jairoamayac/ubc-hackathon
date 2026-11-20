# Burn the Boats

> Put money on your goal. Your friends are the witnesses. Quit, and you lose it.

*Working name. The live app still shows the earlier name, "house money".*

We set goals and drop them because quitting costs nothing. Burn the Boats flips it: you put money on the line, your friends join with their own goals, and when the deadline comes you verify each other. Do it, and you get your money back plus a share of what the quitters left. Don't, and you lose it.

It's a commitment to yourself, not a bet. You sign in, add money with Apple Pay and invite friends with a link. No wallet, no seed phrase, no fees. While your money is on the line, it keeps earning.

Built for the UBC Hackathon 2026 (Consumer Applications track, Best use of Solana).

- **Live demo:** https://house-money-ubc.jairoamayac.workers.dev
- **Docs:** [why it exists](docs/context.md) · [architecture (built vs. to build)](docs/architecture-v2.md) · [decisions](docs/decisions.md) · [demo and pitch script](docs/demo.md) · [brand](docs/brand.md)

## Try it

1. Open the demo group: https://house-money-ubc.jairoamayac.workers.dev/?crew=3diKfFoUCuuStkNvsZvwxYumshkZJ4k8SUTTKHYMrUw1 (Leo, Maya and Josh are already in, with a live commitment).
2. Pick a name, tap **Join and add money**, pay with **Apple Pay** (simulated, test dollars).
3. **Challenges**: join "Gym 3 times this week", or start your own with a short deadline.
4. When time is up, verify each friend: **Did it / Didn't**. Then **Collect**.

## Status

| | |
|---|---|
| Built and live on devnet | Groups with invite links and names; Apple Pay top-up (simulated); money that earns every second; commitments with a stake; friends' verification by strict majority; automatic payouts; sponsored fees; no wallet in sight |
| Being built for the chosen idea | Each person's own goal and stake; only people who put money in can vote; forfeits split 40% platform / 60% friends who did it; appeal with a screenshot reviewed by AI and recorded on-chain (AI simulated in the demo) |
| Next | Email login (Privy); automatic proof from Strava, Screen Time and Apple Health |

The full list, with what changes in the program and in the app, is in [`docs/architecture-v2.md` §5](docs/architecture-v2.md).

## How it uses Solana

The user never sees it, but every money movement is a Solana transaction on devnet.

| What | Address |
|---|---|
| Program `house_money` (Anchor 1.2) | [`9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht`](https://explorer.solana.com/address/9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht?cluster=devnet) |
| Test dollar (SPL token, 6 decimals) | [`FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn`](https://explorer.solana.com/address/FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn?cluster=devnet) |
| Fee sponsor | `HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY` |

- **Deposits live in the program, not in our bank account.** Each group has a vault owned by a program-derived address; members hold shares of it. Nobody (friends, us) can move someone else's money; every transfer is signed by the program.
- **Stakes keep earning.** A stake is a set of pot shares locked in a commitment account; the pot earns from a reserve (5% a year, sped up 5,000x for the demo), so locked money grows too.
- **Verification and payouts are code.** One vote per person (enforced by a vote account per voter), the person can't vote on themselves, a strict majority is final, and claims pay exactly the formula: stake plus a pro-rata share of the forfeits, or a refund if nobody completed.
- **Invisible crypto.** A Cloudflare Worker sponsors every fee (it vets each transaction and caps priority fees) and credits test dollars for the simulated Apple Pay; the app creates the user's key on the device (Privy in production).

Code: `programs/house_money/src/lib.rs` (pots, shares, yield) and `social.rs` (profiles, commitments, entries, votes; also yes/no bets, hidden from the app). Client: `src/lib/house-money/solana`. Edge API: `worker/index.ts`.

## Verified

- `cargo test`: 8 unit tests (interest, share math, majority, pro-rata payouts never create shares, refunds when nobody completes).
- Solana MCP `program_autofixer` (security lint): 0 issues.
- `scripts/social-e2e.mts`: 14 on-chain checks on devnet (one vote per person, nobody votes on themselves, majority decides, whoever fails pays, payouts match and conserve shares, no double claims, everyone can withdraw).
- `scripts/e2e.mts`: 15 on-chain checks of pots and yield on devnet.
- `scripts/worker-security.mts`: 14 attacks on the live fee sponsor, all rejected (it found and we fixed a priority-fee drain).
- `scripts/yield-check.mts`: the pot grows by exactly what the reserve pays.

## Run it

```bash
npm install
cargo build-sbf --manifest-path programs/house_money/Cargo.toml     # needs the Agave CLI
RPC_URL=http://127.0.0.1:8899 node scripts/e2e.mts                    # mint + config on solana-test-validator
RPC_URL=http://127.0.0.1:8899 node scripts/social-e2e.mts
npm run build && npx wrangler deploy                                  # app + edge API
```

Keys live in `keys/` (git-ignored). The Worker needs `SPONSOR_KEY` as a secret: `npx wrangler secret put SPONSOR_KEY`.

## Honest limits (devnet demo)

- Test dollars; Apple Pay is simulated. Production: an on-ramp (Coinbase Onramp or MoonPay with Apple Pay) into USDC.
- Devnet has no real yield; a reserve pays a fixed, sped-up rate. Production: USDC lending.
- Friends can collude. Only people with money in will vote, and the appeal goes to an AI review; automatic proof sources come next.
- Commitment contracts with forfeits are regulated (consumer protection, money transmission). This is a demo with test dollars, not a product on sale.
