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
"Forest" palette, Inter 400/500, the dot and the "Locked" pill, no emoji, gradients or shadows, short sentence-case copy, no promises of returns. Name in one constant (`src/lib/brand.ts`).

### D9. Never delete; archive
Earlier iterations live in `archive/`. On-chain accounts can't be deleted; test groups are prefixed `[test]` and hidden.

### Not decided yet
- Appeal with proof reviewed by AI, and who signs its result.
- Default outcome when nobody confirms before a timeout.
- Whether yield on locked money is platform revenue (team plan) or stays with users (current code).
