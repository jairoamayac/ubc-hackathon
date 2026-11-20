# Kept: decision log

Format: date, decision, rationale and status. Times in America/Chicago (CST).

## 2026-11-19
- **D-001. Product: commitment app with money on the line.** Based on loss aversion (Kahneman and Tversky). It's a commitment, never a bet. *Status: decided.*
- **D-002. Chain: Solana** (Best use of Solana chain award). *Status: decided.*
- **D-003. Verification by friends, with an appeal to an AI judge.** *Status: decided.*
- **D-004. Crypto invisible:** email login, embedded wallet, balances in dollars. *Status: decided.*
- **D-005. Name: Kept** (working names were "Burn the Boats" and "House Money"). "Burn the boats" stays as a tagline. *Status: decided.*

## 2026-11-20 (early)
- **D-006. Grok Bot in 4 roles:** appeals judge (core), goal coach, group chat agent, public-data verification. *Status: decided.*
- **D-007. Dispute architecture:** `DisputeOpened` event → QuickNode Stream → Next.js API → Grok Bot routine webhook → proposed verdict → the group confirms → the backend signs resolve → settle. Grok proposes; the backend moves funds. *Status: decided.*
- **D-008. Brand:** forest green with mint, no orange. *Status: decided.*

## 2026-11-20 (Martin's 12 product decisions)
- **D-009. Split when you miss: 95% to the members who kept their goals, 5% to the platform.** This replaces the earlier 60/40 and "100% to keepers" proposals. *Status: decided.*
- **D-010. Yield share: the platform keeps e.g. 35% of the yield on locked stakes.** The number isn't final. *Status: decided in principle.* Rationale: "I always win"; the platform earns even when everyone keeps their goal; it's a volume business (5 friends × $50 = $250 per group, thousands of groups). Reference: Solana USDC lending was ~3.6–4.1% APY on Nov 20, 2026 (DefiLlama).
- **D-011. Nobody keeps their goal: the platform keeps the pot.** Alternative left open: charity or rollover. *Status: decided, with the alternative optional.*
- **D-012. Stakes must hurt: no fixed $10/$20/$50 chips.** A "How much would it hurt to lose?" input, with Grok suggesting an amount proportional to the goal. *Status: decided. Minimum $50: suggested.*
- **D-013. Goals are individual within a group; shared challenges are also supported.** *Status: decided. Minimum group size of 3: suggested.*
- **D-014. Quitting early is allowed but costly:** you lose a significant part of your stake, which goes into the pot. *Status: decided. 50%: suggested.*
- **D-015. Goals must be quantifiable;** the Grok coach rejects or rewrites non-measurable ones ("be happy" is a life objective, not a goal). *Status: decided.*
- **D-016. Non-voters are blocked** from progressing on their own goal until they vote. *Status: decided. A 24 h vote deadline: suggested.*
- **D-017. Collusion:** appeal to Grok Bot, which asks for evidence; the second instance is a Grok council inspired by Kleros (Schelling point, majority and reasons on-chain). *Status: Grok appeal decided; council on the roadmap.*
- **D-018. First users:** university students for testing; open to anyone. *Status: decided.*
- **D-019. On-ramp:** Apple Pay and banks converting to USDC in production; devnet test USDC for the demo. *Status: decided.*
- **D-020. Legal position:** a stake on your own conduct, with no chance involved, is a commitment contract. A US legal review is needed before real-money launch (no legal advice). *Status: position stated; review pending.*
- **D-021. Hackathon bar:** the smart contract and core flows must really work on devnet; yield, on-ramp and integrations can be simulated. This matches the official rules (working prototype; core on-chain functionality on Solana; devnet OK; deploying new programs optional). *Status: decided.*

## 2026-11-20 (morning, after the repo diagnosis)
- **D-022. Grok judge = a Kleros-style council.** The "Kept Judge" routine in Grok Bot (triggered by a webhook) convenes 3 blind AI jurors with different lenses: (1) criterion and deadline, (2) fraud, (3) fairness to both parties. Each one votes for what it expects the other honest jurors to vote (Schelling point). The majority wins; a three-way split returns `NEEDS_MORE_EVIDENCE`. Jurors are marked coherent or incoherent (in production, coherent jurors would earn the stake of incoherent ones). It only proposes; our backend signs `resolve`. The callback only goes to `*.jairoamayac.workers.dev`. The verdict JSON includes `council` and `tally`. *Status: live as a Grok Bot routine; app wiring pending.* This replaces the "Grok council as roadmap" part of D-017.
- **D-023. Grok Bot: one routine ("Kept Grok", same id and webhook as the earlier "Kept Judge"), 4 roles chosen by the `task` field, all async with a callback.**
  - `judge` (the default when `task` is missing): the Kleros-style council of D-022.
  - `coach`: a SMART goal plus a stake that hurts (minimum $50). Because of latency (minutes), the app keeps the **instant mock as the default** and shows Grok's real result as a suggestion card when it arrives.
  - `group`: daily reminders and nudges in the group chat (Cron Trigger plus an "Ask Grok" button).
  - `verify`: a public-data check (e.g., an X follower count, read by Grok's own X read tools) → `KEPT` / `MISSED` / `CANNOT_VERIFY`.
  - Every request carries `callback_url` (only `*.jairoamayac.workers.dev`) and a one-time `callback_token`; every callback carries `task` and goes to `POST /api/grok/callback` (with `/api/grok/verdict` as an alias). The Worker stores the pending job in KV and the app polls.
  - **Minimal path for the bounty:** the routine + test runs + the chat export (`docs/grok-bot-chat-export.md`) + the README section. No code is strictly required; wiring it into the app is a bonus (priority: judge → verify → coach → group). *Status: decided; routine live, app wiring pending.*
- **D-024. Brand: stay on `main` (forest green with mint, no orange) and don't merge `feat/kept-ui-lila`** ("Lila y mandarina", with orange CTAs). *Status: proposed, pending team confirmation.*
- **D-025. If nobody keeps their goal, everyone is refunded**, as the program already does (`platform_fee` = 0). This replaces D-011 (the platform keeps the pot) for the hackathon; it avoids touching the program and it's easier to defend ("we never profit from everyone failing"). *Status: proposed, pending.*

## Open questions
- Final yield share (35%?) and who receives the users' part of the yield (keepers only, or all members?).
- Exact minimum stake, early-quit penalty and vote deadline.
- The proportionality cap rule for stakes.
- Which on-ramp provider and which yield protocol (Kamino, Jupiter Lend or another: to verify).
