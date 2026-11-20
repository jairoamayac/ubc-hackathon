# Decisions log

Short records of the choices that shaped the build, with the reason and what we gave up. Newest last.

### D1. Solana devnet, Consumer Apps track
Chosen for the hackathon track; everything runs on devnet with test dollars.

### D2. Our own Anchor program instead of a perps protocol (17–18 Nov)
The first concept settled weekly up/down calls on SOL. Drift, the natural venue, was hacked in April 2026 (now operating as Velocity) and its SDK failed on devnet. We wrote our own program and read prices from the Pyth `PriceUpdateV2` account (SOL/USD, `7UVimffx…`) without the SDK.
*Trade-off:* we own the settlement code and its audit surface.

### D3. Shares, not balances, for crew pots
A member owns shares of the crew vault: value = shares × vault / total_shares, with a virtual offset (1,000 shares / 1 asset) so the first depositor can't inflate the price. Yield just raises the vault, so every member's value grows without touching accounts.
*Consequence:* stakes in bets and challenges are shares too (D9), so they keep earning.

### D4. Yield from a funded reserve, time-warped for the demo
Devnet has no real yield. A reserve pays simple interest on the crew's principal (5% a year) and the config multiplies time (5,000x) so earnings visibly tick. `accrue` is permissionless and runs inside every money instruction.
*Production:* replace the reserve with USDC lending.

### D5. Fees are sponsored; people never hold SOL
A Cloudflare Worker co-signs every transaction as fee payer and pays rent for new accounts. It vets each transaction: only our program (plus compute budget), the sponsor may appear only as the rent payer (account #0 of specific instructions), never as an owner.

### D6. The Worker only signs; the device submits (19 Nov)
The public devnet RPC answers 403 to Cloudflare IPs, so the Worker can't send transactions. It now returns signed transactions and the app submits them. Side benefit: the Worker has no RPC dependency at all.

### D7. Confirmation by polling, not websockets
`confirmTransaction` hung inside the Worker and was flaky behind proxies. `hm.confirm` polls `getSignatureStatuses` and checks block height for expiry.

### D8. Cap sponsored priority fees (security fix, 19 Nov)
`scripts/worker-security.mts` showed the Worker would co-sign any compute-unit price, so one request could drain the sponsor's SOL. Now: ≤ 400,000 CU and ≤ 1,000,000 µlamports/CU (~0.0004 SOL per transaction). 14/14 attacks rejected on the live API.

### D9. Pivot to a social layer (19–20 Nov)
After researching prize-linked savings, social prediction apps and commitment apps (see `context.md`), the team chose: bets on real-life moments (JuryDuty-style) and challenges where whoever fails pays the rest (Pact/Forfeit/Goals-style), on top of the earning pot.
- Stakes are crew shares moved from a member to a bet/challenge account and back to winners: no tokens move, shares are conserved, locked stakes keep earning.
- Outcomes: strict majority of eligible crew members. The subject of a bet can't vote; nobody judges their own challenge entry. One vote per person enforced by a Vote PDA.
- Payouts: winners get their stake plus a pro-rata share of the losers'; if nobody won, everyone is refunded.
- The SOL up/down "tryhard" mode stays in the program (it still passes its tests) but left the app: individual, 60 seconds, and about a price most people don't care about.
*Trade-off:* the crew can collude. That's the social contract of a friends' bet; production would add data sources and a dispute window.

### D10. Hand-written TypeScript client instead of an IDL
`src/lib/house-money/solana/hm.ts` encodes instructions, derives PDAs and decodes accounts by hand (Borsh, Anchor discriminators). The same file runs in the browser, in the Worker and in Node scripts (type stripping), with no build step for the scripts.

### D11. Never delete; hide instead
Crews can't be deleted on-chain and the team rule is not to delete anything. Duplicates from interrupted seed runs are hidden in the app by address; e2e crews are named `[test] …` and filtered out.

### D12. Program upgrade in place (20 Nov)
The social layer grew the binary from 377 KB to 565 KB. The program account was extended and upgraded at the same address, so existing crews and savings kept working (the 15 original e2e checks pass after the upgrade).

### D13. The idea: Burn the Boats (team decision, 19 Nov)
The team chose commitment with money on the line: each person stakes on their own goal, friends verify, whoever fails loses the stake; 40% of forfeits to the platform and 60% to the friends who did it; appeals with proof reviewed by AI and recorded on-chain. Framing: a commitment to yourself, not a bet.
*Consequences:* yes/no bets on other people (D9) leave the product and the pitch; they stay in the program but the app hides them. The commitment ("challenge") code becomes the core and needs the changes listed in `architecture-v2.md` §5: personal goal and stake per person, participants-only voting, the 40/60 split, and the appeal flow.

### D15. 5% platform, 95% to those who kept their word; built and branded (20 Nov)
The team set the forfeit split at 5/95 (earlier 40/60). Built on-chain: `join_with_goal` (own goal + stake, minimum enforced), participants-only confirmation (`vote_entry` takes the voter's own Entry), `take_fee` (5% once to the treasury) and the 95% payout. Bets left the app. The UI follows the team's branding kit v0.1 ("Forest" palette, Inter, the dot and the "Locked" pill, no emoji or gradients); the name stays a single constant (`src/lib/brand.ts`) until the team picks one.

### D14. Crypto stays invisible (hackathon guide, Consumer track)
The guide asks for consumer apps "where the crypto is invisible": no bridging, gas or seed phrases. User-facing copy talks about dollars, goals and friends; Solana details (program ID, how the chain is used) live in the README's technical section, which the Best use of Solana award requires.
