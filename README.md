# House Money

> Save with your crew. Watch it grow. Play only what it earned.

House Money is a group savings app. You add money with Apple Pay and send it to a **crew**: your roommates, your team, your group chat. Every crew's pot earns every second, and every crew is ranked live, so you can see who's growing and jump in. Feeling tryhard? Play only what your crew earned on a SOL up/down call. Worst case, you lose those earnings. Never your savings.

People never see a wallet, a seed phrase, SOL or a fee. Under the hood it runs on Solana.

Built for the UBC Hackathon 2026 (Consumer Apps track, Solana).

- **Live demo (Solana devnet):** https://house-money-ubc.jairoamayac.workers.dev
- Architecture and flows: [`docs/architecture.md`](docs/architecture.md) · Brand: [`docs/brand.md`](docs/brand.md)

## On devnet

| What | Address |
|---|---|
| Program `house_money` | [`9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht`](https://explorer.solana.com/address/9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht?cluster=devnet) |
| Test dollar (hmUSD, 6 decimals) | [`FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn`](https://explorer.solana.com/address/FBQJKyDd5vSekrT4jVMVZRiXsrfCTW6nNBf5x5siKPWn?cluster=devnet) |
| Price feed (Pyth SOL/USD, PriceUpdateV2) | [`7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE`](https://explorer.solana.com/address/7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE?cluster=devnet) |
| Sponsor (fee payer, upgrade authority) | `HAEaSXy5L6fQinymFH3JZZvCgwGmVVNCbWUrMH9bd9zY` |

Demo settings: 5% a year, sped up 5,000x so earnings visibly tick; tryhard calls last 60 s; boost up to 5x; wins capped at 2x the stake.

## How it works

```
Apple Pay (simulated) ─► your cash (hmUSD) ─► crew pot (program vault, shares)
                                                   │  earns from the yield reserve every second
                                                   ▼
                              tryhard call: stake ≤ what you earned, settled with Pyth
```

- **`programs/house_money`** (Anchor 1.2): crews, members, share accounting with a virtual offset (no inflation attack), yield paid from a reserve, calls settled from the Pyth `PriceUpdateV2` account. Invariants are listed at the top of `lib.rs`; every token movement is signed by a PDA.
- **`worker/index.ts`** (Cloudflare Worker): serves the app and only **signs**. `/api/topup` returns a sponsor-signed hmUSD transfer; `/api/sponsor` vets a transaction (only our program, the sponsor may only pay rent) and co-signs it as fee payer. The app submits to the RPC.
- **`src/lib/house-money/solana`**: dependency-light client (instruction encoding, PDAs, decoders) and `LiveClient` used by the screens. The account key is created on the device (Privy embedded wallets in production).

## Verified

- `cargo test`: settlement, interest, share math and Pyth parsing (4 unit tests).
- Solana MCP `program_autofixer` (security lint): 0 issues.
- `scripts/e2e.mts`: 15 on-chain checks, all passing on a local validator and on devnet. Among them: staking savings is rejected (`PrincipalIsProtected`), strangers can't withdraw, no withdrawals while a call is open, no early settlement, principal intact after a call, a member leaves with at least what they put in.

## Run it

```bash
npm install
cargo build-sbf --manifest-path programs/house_money/Cargo.toml   # needs the Agave CLI
RPC_URL=http://127.0.0.1:8899 node scripts/e2e.mts                  # against solana-test-validator
npm run build && npx wrangler deploy                                # app + edge API
```

Keys live in `keys/` (git-ignored). The Worker needs `SPONSOR_KEY` as a secret: `npx wrangler secret put SPONSOR_KEY`.

## Honest limits (devnet demo)

- Dollars are a test token and Apple Pay is simulated. Production would use an on-ramp (Coinbase Onramp or MoonPay with Apple Pay) into USDC.
- Devnet has no real yield; the reserve pays a fixed rate. Production would earn from USDC lending.
- The devnet Pyth feed updates every few minutes to hours, so a 60 s call usually settles at the same price. Production would post a fresh price update with each settlement.
