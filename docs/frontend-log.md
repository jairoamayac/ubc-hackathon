# Frontend log

Every change made to the app's front end by Claude in Martin's session goes here: date (UTC), what, where, how it was checked. Newest last. Branch: `feat/kept-frontend`. Nothing was pushed to `main`.

## 2026-11-20 (Claude, Martin's session)

### Starting point
The branch was cut from `main` at `04d59c5` ("Burn the Boats end to end"). That commit had already rebuilt the screens on the branding kit v0.1 (Forest palette, Inter, the dot, the Locked pill), removed the bets, and added own goals, participants-only confirmation and the 95/5 split. So this log covers only what was still missing.

### Brief received from Martin
> Update, second pass (see "Second pass" at the end): the chips of item 2 were replaced by a free amount with a Grok suggestion, following the product decisions of 20 Nov (spec section 13).

1. Rebrand to **Kept**, drop crypto jargon, remove the bets tab.
2. Join with own goal and own stake: chips of $10, $20 and $50, and a summary of the consequence before confirming.
3. Voting only for people who put money in, and a results screen that shows who kept their word, how much each one collects and how much goes to the platform.
4. Appeal with a screenshot, simulated, labeled "Reviewed by Grok", showing the reasons and not only accepted or rejected.

### What changed
| Area | Change | Files |
|---|---|---|
| Name | Product name is now **Kept** (single constant). Page title, onboarding, invite text and result texts follow it. | `src/lib/brand.ts` |
| Split | `FEE_PERCENT` (5) and `KEEPERS_PERCENT` (95) live in one place and feed every text that mentioned the split. | `src/lib/brand.ts`, `src/components/Onboarding.tsx`, `src/components/CrewsApp.tsx`, `src/components/CrewRoom.tsx` |
| Jargon | Removed "wallet" from two user facing lines ("No password to remember", "No fees to think about"). | `Onboarding.tsx`, `CrewsApp.tsx` |
| Join with a goal | Stake chips are now $10, $20 and $50 (`STAKE_CHIPS`), still filtered by the pact minimum; default is $20 if affordable. The static paragraph became a live summary: what happens if you keep your word, what happens if you walk away (with your amount), and that it stays locked until the people who put money in confirm. | `src/components/CrewRoom.tsx` (`GoalForm`) |
| Result | New `ResultBreakdown`: one line per person with outcome, money in and money out, plus the platform fee line. Your own line uses the exact payout from the program; other lines apply the same rule (stake back plus pro rata share of the forfeits after the fee). | `src/components/CrewRoom.tsx` |
| Appeal | New `AppealSheet`: choose a screenshot, optional note, "Reviewed by Grok" verdict with three reasons and a Demo tag. A visible demo control picks accepted or not accepted. | `src/components/AppealSheet.tsx`, wiring in `CrewRoom.tsx` |
| Docs | README heading and name note; this log. | `README.md`, `docs/frontend-log.md` |

Already done by the earlier commit, so not touched: Forest palette, no bets in the crew room, participants-only confirmation buttons ("Only people who put money in can confirm").

### Things to know
* **Split mismatch.** Martin's brief said 60/40. The program and the docs on `main` implement **95/5** (`take_fee`, commit `04d59c5`), so the screens say 95/5. Changing the number is one edit in `src/lib/brand.ts` plus the program's `fee_bps`; the two must match.
* **The appeal is a demo.** Nothing is uploaded, the verdict is chosen with the demo control, and it does not change the result or anyone's money. The screen says so. Wiring it to the real Grok Bot routine and recording the decision on chain is the next step (`docs/architecture-v2.md` §5, row 4).
* **Chips and small stakes.** Chips are $10, $20 and $50 as requested. If you need $5 stakes for quick tests, add 5 to `STAKE_CHIPS`.
* **Legacy screens left in place.** `HouseMoneyApp.tsx`, `HomeScreen.tsx`, `DepositScreen.tsx`, `CallItScreen.tsx`, `LivePlayScreen.tsx`, `LeagueScreen.tsx` and `ResultScreen.tsx` are not used by `src/app/page.tsx` (it renders `CrewsApp`). They still say "House money". Not deleted, because the team rule is to never delete.
* **Names in the code.** The `house-money` folder, the `HouseMoneyClient` types and the Worker URL keep their old names. Only what people see was renamed.
* **Logo.** Provisional: the green dot plus the name. `src/components/Logo.tsx` is the old House Money symbol and is only used by the legacy screens.

### How it was checked
* `npx eslint src`: clean.
* `npm run build`: compiles and passes TypeScript. In this sandbox the build cannot download Google Fonts, so it was run on a temporary copy with the two `next/font/google` calls stubbed out; the repo's `layout.tsx` is unchanged. On a machine with internet the normal `npm run build` works.
* Not checked: the screens were not opened in a browser and nothing was run against devnet. Please click through: start a pact, join with a goal, confirm, settle, open "Disagree with this result".


## Second pass (20 Nov): offline demo, stake without chips, coach

Source: "Kept: spec técnica, backlog y milestones", sections 13.1 to 13.6 (product decisions of 20 Nov), which replace the earlier chips and 60/40 split.

### What changed
| Area | Change | Files |
|---|---|---|
| Stake | Chips of $10, $20 and $50 are gone. The screen asks "How much would it hurt to lose?" with a free amount, plus and minus buttons, a "Grok suggests" button, a nudge below the suggested minimum ($50) and an extra confirmation above 3 times the suggestion. | `src/components/StakePicker.tsx`, `src/components/CrewRoom.tsx` (`GoalForm`), `src/lib/brand.ts` |
| Coach | "Make it measurable with Grok": rejects life goals ("be happier"), rewrites loose goals into measurable ones, says what is counted and what proof is needed, suggests an amount. Deterministic rules, no network. Marked Demo. | `src/lib/coach.ts` |
| Settlement | The reparto (95/5, keepers share by stake, refund when nobody missed or nobody kept) lives in one pure module with a self check. | `src/lib/settlement.ts`, `scripts/check-settlement.mts` |
| Demo | New route `/demo`: the whole 75 second story with no backend and no network. Ten screens: login, home, goal wizard (3 steps, lock animation), group, goal detail (progress ring, countdown, upload proof, timeline, friends and votes), feed with proofs and Grok Bot messages, vote, dispute and appeal, results, profile. Five people, $50 each, pot $250. Martin and Ana keep their word. Ben disputes Martin's proof, Martin appeals, Grok Bot proposes "Approved (92%)", Ana, Cara and Dani confirm (3 of 4), Martin collects $121.25. Press D for the next step, "Play all" for the whole story, "Reset" to start again. | `src/app/demo/page.tsx`, `src/components/demo/*`, `src/lib/demo/store.ts` |
| Appeal (live app) | The appeal sheet now shows the same states as the real flow (Dispute opened, Detected on-chain, Grok Bot is reviewing with ticking checks, proposal). Still simulated and labeled Demo. | `src/components/AppealSheet.tsx` |
| Small | "Your goal is at risk" banner under 24 hours on a pact you are in. Onboarding links to `/demo`. Leaving early (50% of the stake, suggested) is explained in the demo goal screen only. | `CrewRoom.tsx`, `Onboarding.tsx` |

### Numbers in the demo (spec 13.2)
Pot $250, forfeited $150, platform 5% = $7.50, keepers $142.50, so Martin and Ana get $121.25 each. Check: $121.25 + $121.25 + $7.50 = $250. Simulated yield: about $0.14 over 5 days at 4% a year, platform share 35% is about $0.05. Both are shown as simulated.

### What is real and what is simulated here
* Real: nothing in `/demo` touches a network. The live app (`/`) is unchanged in how it talks to devnet.
* Simulated in `/demo`: sign in, funds, votes of the friends, the Grok Bot review and the on-chain steps, the receipt, the yield, "leave early".
* Not wired yet: the live appeal to the real Grok Bot routine and the QuickNode Stream (milestone M7).

### Things to know
* The live app still lets a pact set its own minimum (`minStake`); the picker enforces it as the hard floor and treats $50 as the suggested minimum only.
* Leaving early, the yield split and the voting block are suggestions in the spec, not closed. The demo shows them as such.
* `/demo` and the live app are separate on purpose: the demo cannot break the real flow.

### How it was checked
* `npx eslint src`: clean. `npm run build` on a copy with the Google Fonts calls stubbed: compiles and prerenders `/` and `/demo`.
* `node scripts/check-settlement.mts`: passes (demo numbers, refund cases, uneven stakes, yield).
* Walked `/demo` in headless Chrome from login to "Collect $121.25": no console errors, and none of the words wallet, seed, token or 0x on screen.
* Not checked: the live app against devnet from a browser, on a real phone, or with a screen reader.

## Grok council (branch feat/grok-council)
- Worker: /api/appeal, /api/grok/callback (alias /api/grok/verdict), /api/disputes/:id, /api/streams/quicknode (inert until the program emits the log). Secrets GROK_WEBHOOK_URL and GROK_WEBHOOK_KEY via wrangler, never committed. KV binding DISPUTES.
- App: AppealSheet sends to the council, polls every 5 s, shows 3 juror cards, tally and verdict. "Instant demo judge" stays as an offline fallback.
- Worker handlers tested with a fake KV and fake webhook: 202, bearer, callback_url on the Worker host, wrong token 401, bad verdict 400, replay 401, decided view without token leak, webhook failure 502.
- Not done: on-chain open_dispute and the real QuickNode Stream; roles verify, coach and group (the webhook supports them via "task").
- Verify role: POST /api/verify (task "verify", X handle checked, same one-time token and callback), GET /api/verifications/:id, and a "Verify with Grok" sheet on open pacts (VerifySheet). Result KEPT, MISSED or CANNOT_VERIFY with what Grok saw. It is a public data check, not a payout.
- Docs added in uppercase from Drive: docs/PRODUCT.md and docs/DECISIONS.md (docs/decisions.md still exists; they differ only by case, which collides on macOS and Windows checkouts).
- Worker tests: 21 checks with fake KV and webhook, including verify (400 bad handle, 202, task and source in payload, 401 wrong or replayed token, 400 bad verdict, view without token).
