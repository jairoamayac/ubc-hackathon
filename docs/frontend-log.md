# Frontend log

Every change made to the app's front end by Claude in Martin's session goes here: date (UTC), what, where, how it was checked. Newest last. Branch: `feat/kept-frontend`. Nothing was pushed to `main`.

## 2026-11-20 (Claude, Martin's session)

### Starting point
The branch was cut from `main` at `04d59c5` ("Burn the Boats end to end"). That commit had already rebuilt the screens on the branding kit v0.1 (Forest palette, Inter, the dot, the Locked pill), removed the bets, and added own goals, participants-only confirmation and the 95/5 split. So this log covers only what was still missing.

### Brief received from Martin
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
