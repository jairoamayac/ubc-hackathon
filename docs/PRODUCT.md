# Kept: product rules (source of truth)

Last updated: 2026-11-20 (v3, Grok council and 4 roles). This file is for the repo and for AI coding assistants. If code and this file disagree, this file wins; open an issue or update it in the same PR. Values marked *(suggested)* are proposals that aren't final: keep them in one config file.

## 1. What Kept is
Kept is a commitment app, not a betting app. A user sets a quantifiable goal with a deadline, locks an amount of USDC that would hurt to lose, and shares it with a group of friends. Friends verify each other's proofs. Disputes go to Grok Bot, which proposes a verdict with reasons, and the group confirms it. A Solana program holds the money and settles. Users only ever see dollars: never "wallet", "token", "seed phrase" or "gas".

Never call it a bet, a wager or gambling in the UI or the copy. Use "stake", "commitment" and "on the line".

## 2. Goals
- Goals must be **quantifiable**: a metric, a target and a deadline ("Run 21 km by Sunday", "Read 300 pages by Dec 15", "Under 1 h/day of Instagram for 14 days").
- The **Grok coach** rejects or rewrites non-measurable goals. "Be happy" is a life objective, not a goal; the coach proposes measurable steps instead.
- Each goal has a **proof method**: a photo or screenshot, friends' vote, or a future integration (Strava, Screen Time or Apple Health, shown as "coming soon").
- **Deadlines** are flexible: day 7, 45, 100 or any date the user picks.

## 3. Groups
- **Minimum group size: 3 members** *(suggested)*. A group with fewer committed members can't start.
- **Individual goals are the default**: each member has their own goal and stake.
- **Shared challenges** are also supported: every member has the same goal and deadline.
- Only members who staked can vote.

## 4. Stakes
- **No fixed chips.** The stake screen asks: **"How much would it hurt to lose?"**
- The **Grok coach suggests an amount** based on the goal's difficulty and duration, so it hurts without being reckless (instant mock by default; the real Grok `coach` result arrives async as a suggestion, see 6b).
- **Minimum stake: $50** *(suggested)*.
- **Proportionality guard:** Grok flags stakes far out of proportion to the goal (e.g., $3,000 to run 2 km) and asks the user to confirm or lower them. *(Suggested cap: 3× Grok's suggestion without an extra confirmation.)*
- Before locking, the user always sees a consequence summary: "If you miss it, you lose $X. If you keep it, you get it back plus a share of what others lose."

## 5. Money flow and business model
- **Kept your goal:** you get your stake back, plus your pro rata share of the missed stakes, plus your share of the users' yield (see below).
- **Missed your goal:** you lose your stake. **95% goes to the members who kept their goals** (pro rata by their stake) and **5% goes to the platform**.
- **Nobody kept their goal:** **everyone is refunded**, as the program does today (D-025, proposed, pending). *Earlier option (D-011, on hold): the platform keeps the pot, or it goes to charity or a rollover.*
- **Yield:** while stakes are locked, they earn yield in audited USDC lending on Solana (production only). The **platform keeps a share of the yield, e.g. 35%** *(not final)*. The rest goes to the users *(proposal: to the members who kept their goals, pro rata by stake; to be confirmed)*.
- **Why this is aligned:** even when everyone keeps their goal, the platform earns from the yield, so it never needs users to fail. It's a volume business.
- **Quitting early:** allowed, but you lose a significant part of your stake: **50%** *(suggested)*. That penalty goes into the pot and is settled like a missed stake at the deadline. The rest is refunded.
- **Math:** all amounts are integers in USDC base units (6 decimals). Rounding dust goes to the treasury. `platform_bps = 500` (5%) and `yield_share_bps = 3500` (35%, not final) live in the program's Config.

### Worked example (the demo)
A group of 5 (Martin, Ana, Ben, Cara and Dani) stakes $50 each, so the pot is $250. Martin and Ana keep their goals; Ben, Cara and Dani miss.
- Missed stakes: $150. Platform 5%: $7.50. Keepers 95%: $142.50, split $71.25 each (equal stakes).
- Martin receives $50 + $71.25 = **$121.25**, and so does Ana. Ben, Cara and Dani get $0. Platform: $7.50.
- Check: $121.25 + $121.25 + $7.50 = $250.
- Yield over 5 days at ~4% APY: about $0.14 in total (simulated in the demo), of which the platform's 35% is about $0.05.

### Illustrative scale (assumptions, not projections)
1,000 groups × $250 locked for 90 days, at ~4% APY: about $2,466 of yield, so about $863 to the platform at 35%. If 40% of stakes were missed (assumption), 5% of $100,000 would be $5,000. Reference rates: Solana's main USDC lending markets paid about 3.6–4.1% APY on Nov 20, 2026, with 30-day averages of about 4.4–5.5% (DefiLlama: [Kamino main market](https://defillama.com/yields/pool/d2141a59-c199-4be7-8d4b-c8223954836b), [Jupiter Lend Earn](https://defillama.com/yields/pool/d783c8df-e2ed-44b4-8317-161ccc1b5f06)). Rates change constantly.

## 6. Verification, voting and disputes
1. The goal owner uploads a proof (photo + comment). Its SHA-256 hash goes on-chain with `submit_proof`.
2. Other members vote Approve or Dispute before the **vote deadline: 24 hours after the proof** *(suggested)*.
3. **Non-voters are blocked:** until they vote on pending proofs, they can't check in or submit proof for their own goal. If the vote deadline passes, the proof is decided by the votes that were cast, and the missed vote shows on the non-voter's profile *(suggested)*.
4. With a majority of Approve votes, the goal is Kept. If anyone disputes, the program emits `DisputeOpened`.
5. **Appeal to Grok Bot, the "Kept Judge" council:** the dispute goes to a Grok Bot routine through its webhook (in production, a QuickNode Stream watching `DisputeOpened` triggers it). The routine convenes **3 blind AI jurors**, each with its own lens:
   - **Criterion and deadline:** does the proof meet the measurable goal before the deadline?
   - **Fraud:** signs of editing, an old or reused screenshot, the wrong person or activity.
   - **Fairness to both parties:** what the goal owner and the disputer each say.

   Each juror votes without seeing the others, for the verdict it expects the other honest jurors to reach (a **Schelling point**, as in [Kleros](https://docs.kleros.io/concepts/game-theory)). **The majority wins**; a three-way split returns `NEEDS_MORE_EVIDENCE` and the owner is asked for more proof. Jurors who voted with the majority are marked **coherent** and the rest **incoherent**. In production, coherent jurors would earn the stake of incoherent ones (or a reputation weight).
6. **The verdict comes back** as JSON with the outcome, the reasons, `council` (each juror's lens, vote and reasons) and `tally`, posted only to our Worker (`*.jairoamayac.workers.dev`) with a one-time callback token. The group sees it and confirms (majority of members other than the owner). Then the backend, as oracle, signs `resolve_dispute(kept, verdict_hash)`.
7. **Further appeal (roadmap):** a larger council (e.g., 5 or 7 jurors) with commit-reveal and the votes recorded on-chain, as in Kleros appeals.
8. **Grok proposes; the contract pays.** Grok Bot never holds keys or moves funds.

## 6b. Grok Bot: one routine, 4 roles
A single Grok Bot routine ("Kept Grok") is triggered by one webhook. The `task` field picks the role; all of them are async (minutes) and post a callback to `POST /api/grok/callback` on our Worker (`*.jairoamayac.workers.dev` only, with a one-time token).

| `task` | What it does | Returns | In the app |
|---|---|---|---|
| `judge` (default) | The Kleros-style council of 3 blind jurors (section 6) | verdict, reasons, `council`, `tally` | The appeal sheet; the group confirms, and the backend signs `resolve` |
| `verify` | Checks public data itself (e.g., an X follower count via Grok's X read tools) | `KEPT` / `MISSED` / `CANNOT_VERIFY`, `observed`, `checked_at`, `reason` | "Verify with Grok" on goals with `verifiable_by: public_data`; `KEPT` marks the goal kept with no vote needed |
| `coach` | Turns a wish into a SMART goal and suggests a stake that hurts (min. $50) | goal, criterion, deadline, proof method, `verifiable_by`, suggested stake and reason, tips | The **instant mock stays the default** (latency); Grok's result arrives as a suggestion card |
| `group` | Daily reminders and nudges in the group chat | `messages[]` to all or to one member | Cloudflare Cron once a day per active group, plus an "Ask Grok" button; posted as "Grok" |

Grok never holds keys or moves funds in any role.

## 7. Edge cases
| Case | Rule |
|---|---|
| Fewer than 3 members by the start date | The challenge doesn't start, and stakes are refunded in full. |
| Nobody keeps their goal | Everyone is refunded, as the program does today (D-025, proposed). The earlier option, the pot to the treasury, is on hold. |
| Everybody keeps their goal | Everyone is refunded in full. The platform earns only its yield share. |
| A member quits early | They lose 50% *(suggested)*, which goes into the pot; the rest is refunded. They can't vote after quitting. |
| A member never submits proof | Missed at the deadline. |
| A member never votes | Blocked from progressing on their own goal until they vote; after the vote deadline, the votes cast decide. |
| Grok's confidence < 0.7 | Grok asks for more evidence; if none arrives before the window closes, the original votes decide. |
| Grok Bot or the Stream is down | Fallbacks: a manual "Notify Grok Bot" trigger, RPC polling, and an instant judge via the xAI API (`source: xai_api_fallback`). |
| Disproportionate stake | Grok warns; the user has to confirm explicitly above the cap. |
| Non-measurable goal | Grok rejects it and proposes a measurable rewrite. |

## 8. On-ramp and users
- **First users:** university students, for testing. The product is open to anyone.
- **Production on-ramp:** Apple Pay and bank transfers converted to USDC through an on-ramp provider *(to choose)*. Users see dollars only.
- **Hackathon:** Solana devnet with a test USDC mint. "Add funds" mints test tokens.

## 9. What's real vs mocked (hackathon build)
The official rules require a working prototype that interacts with the blockchain. For Best use of Solana, the core on-chain functionality has to be on Solana, devnet is fine, and deploying new programs is optional (existing ones count). Bounties also require their integrations to be working and technically sound.

| Must be real | Can be mocked |
|---|---|
| The Anchor escrow on devnet: join with stake, submit_proof, vote, open_dispute, resolve_dispute, settle (95/5) | Yield (simulated APY and amounts) |
| `DisputeOpened` → QuickNode Stream (with a filter and a webhook destination) | Apple Pay and bank on-ramp (mint test USDC) |
| The Grok Bot routine proposing a verdict with reasons | Strava, Screen Time and Apple Health ("coming soon") |
| Group confirmation → on-chain resolve | Friends' accounts signed by backend demo keys |
| A working deployed front-end with crypto hidden | A larger appeal council with on-chain votes (roadmap) |

## 10. Legal note
Kept's position is that a stake on your own behavior, which you fully control, is a commitment contract with no element of chance, not gambling. That's a product position, not legal advice. A US legal review is required before launching with real money.
