# Decisions

Short records of the choices behind Kept, with the reason and the trade-off.

### D1. Solana devnet, Consumer Applications track
Crypto must be invisible to users (hackathon guide); Solana details live in the README for the Best use of Solana award.

### D2. The idea: commitment with money on the line (19–20 Nov)
Each person locks money on their own goal; friends who also put money in confirm who kept their word. Walk away and you lose it: 95% to those who kept theirs, 5% to the platform. Never to a charity or anyone outside the group. Framing: a promise to yourself, not a bet. Name: Kept.

### D3. Our own Anchor program
Written for this hackathon (Anchor 1.2). Every token movement is signed by a program address; no admin can move member funds.

### D4. Shares, not balances
People hold shares of their group's vault: value = shares × vault / total shares, with a virtual offset so the first depositor can't inflate the price. Locked stakes are shares moved into the pact's accounts, so nothing leaves the vault until payout.

### D5. Rules enforced on-chain
- Own goal and stake (`join_with_goal`), at least the pact's minimum.
- Only participants confirm (`vote_entry` takes the voter's own entry); nobody confirms themselves; one vote per person (vote account).
- Strict majority of the other participants decides.
- `take_fee` moves exactly 5% of what was left behind to the treasury, once, only if someone kept their word.
- Winners collect stake plus a pro-rata share of 95%; if nobody kept their word, everyone is refunded.

### D6. Fees are sponsored; the Worker only signs
A Cloudflare Worker co-signs as fee payer and returns the signed transaction; the device submits it (public devnet RPCs block datacenter IPs). It signs only this program's instructions, never as an owner, with a capped priority fee: an attack test found an uncapped fee could drain the sponsor, now fixed (14/14 attacks rejected).

### D7. Simulated Apple Pay
The top-up sends test dollars. Real Apple Pay needs an on-ramp; Coinbase's own docs say its Apple Pay guest checkout was deprecated on 30 Jun 2026, so the production path needs checking.

### D8. Brand: the team's kit
"Lila y mandarina" (docs/brand/kept-lila): lilac and mandarin, Inter 400–800, 3D icons, the pinky-promise logo, short sentence-case copy, no crypto jargon, no promises of returns. Name in one constant (`src/lib/brand.ts`). (The first kit, "Forest", is superseded.)

### D9. Never delete; archive
Earlier iterations live in `archive/`. On-chain accounts can't be deleted; test groups are prefixed `[test]` and hidden.

### D10. Real yield through Kamino Lend (20 Nov)
Locked pots are lent on Kamino Lend through CPI and earn real interest instead of a simulated rate. Shares are only priced with the pot home: every money action redeems, acts at the exact price and re-lends in one transaction, so a late joiner never gets interest earned by others (audit H3 of the first review). Anyone can bring a pot home; only the operator lends it.

### D11. QuickNode as the private RPC, behind the Worker (20 Nov)
The app talks to `/api/rpc`; the Worker forwards an allowlist of methods to QuickNode with timeouts and the public RPC as fallback. The token never reaches the browser. QuickNode also simulates every sponsored transaction before the sponsor signs.

### D12. Sign-in with Privy, email only (20 Nov)
Privy creates and holds each person's Solana account and signs for them; the sponsor still pays fees. If Privy can't start, the app says so instead of falling back to a hidden device key (audit).

### D13. Bets and tryhard calls off (20 Nov)
They were not in the app and opened attacks (stakes locked forever, a free option paid from the fee treasury). `create_bet` and `open_call` now return `Disabled`.

### D14. Nobody loses money without a majority (20 Nov)
After the voting window, an undecided entry is kept if it has more yes than no votes, otherwise refunded. A lone "no" can't take a stake (audit, contract H1).

### D15. One entry for the app and the demo (20 Nov)
One welcome screen: "Get started" signs in to your real account, "Try the demo" opens the offline walkthrough on Home. Both share the v5 design.

### D16. Disputes are recorded on-chain and advisory (20 Nov)
`open_dispute` (PR #14) records who disputed which entry and why, and emits `KEPT:DisputeOpened`, which a QuickNode Stream forwards to the Grok council. A verdict never moves money by itself.

### Not decided yet
- Invite-only joining (the creator signs, or an invite code), so fake members can't form a majority.
- Which on-ramp goes to production (plan: Crossmint, `apple-pay-plan.md`) and the move from hmUSD to USDC.
- Whether yield on locked money is platform revenue or stays with users (today it stays in the pot).
- Kamino's main market on mainnet, with partial redeems.

---

The Grok council and product decisions from 2026-11-19 on (dated log) are in [grok-decisions.md](grok-decisions.md).
