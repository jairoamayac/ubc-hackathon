# Burn the Boats: why it exists

Working name. Last updated: 20 Nov 2026. Figures carry their source; where sources disagree or something is unverified, it says so.

## 1. The idea in one line

**Put money on your own goal, let your friends be the witnesses, and lose it if you quit.** Hit it and you get your money back plus a share of what the people who quit left behind.

It's a commitment to yourself, not a bet: there's no chance involved, you stake on your own behaviour.

## 2. The problem

We set goals (run a half marathon, reach 10k followers, study every day) and drop them, because quitting costs nothing. Habit apps, reminders and streaks all try to motivate with rewards, and rewards are the weaker lever.

**Why losses work better than rewards.** People weigh a loss roughly twice as much as an equal gain: Tversky & Kahneman estimated a loss-aversion coefficient of 2.25 (cumulative prospect theory, 1992). Later meta-analyses find it smaller but real: an average of ~1.96 across 607 estimates (Brown et al., 2024) and ~1.31 in another (Walasek, Mullett & Stewart, 2024). We pitch "about twice" and know the range.

**Commitment contracts have field evidence.**
- Smoking (CARES, Giné, Karlan & Zinman): smokers who deposited their own money, refunded only if they quit in 6 months, did better than a control group with free nicotine patches; the effect held in later urine tests.
- Exercise (Royer, Stehr & Sydnor): employees who took a commitment contract kept going to the gym more 12–18 months later. **But only ~12% of those offered the contract took it.** Adoption is the risk, so the friend group and the invite link have to do the selling.

## 3. Who it's for

College students and young people in the US who already do challenges in groups (gym, study, less screen time). Early adopters: friend groups of 3 to 8.

The culture is already there: #TheGreatLockIn, loud budgeting (42% of Gen Z practice it, 60% talk about money with friends; Bank of America, May 2026) and "do it with me" challenges that travel because "a challenge has episodes" (Draper creator analysis, May 2026).

## 4. How it works for the user

1. Sign in with email. No wallet, no seed phrase, no fees to think about.
2. Add money with Apple Pay.
3. Set a goal ("Run 21 km by Sunday") and put money on the line ($20). Invite friends with a link; they join with their own goals and their own money.
4. When the deadline comes, the friends who also put money in verify each other.
5. If a friend says you didn't do it, you appeal with a screenshot or proof; an AI checks it (distance, date, route) and its decision is recorded.
6. The money pays out automatically: those who did it get their stake back plus a share of the forfeits.

## 5. Business model

- **Forfeits:** 5% of every lost stake goes to the platform; the other 95% goes to the friends who kept their word (team decision, 20 Nov; earlier drafts said 40/60). Forfeits never go to a charity or anyone outside the group.
- **Yield on locked deposits:** per the team's plan, what locked money earns is platform revenue (in the devnet demo it still accrues to the group pot; changing that is a follow-up). We never promise users a return.
- **Later:** challenges sponsored by brands.
- **Costs:** network fees (near zero on Solana), development, verification.
- **Metrics:** goals created, completion rate compared with habit apps, friends invited per goal.

How we answer "why does the platform take money?": our incentive is growth, not failure. We earn more when more people join and complete.

## 6. Why it needs a smart contract (and why the user never sees it)

The deposit lives in a program on Solana, not in our bank account. Nobody can run off with it: not your friends, not us. The rules are code, and payouts are instant and cost almost nothing.

That is exactly where the closest competitor is weak: **Forfeit keeps the money you lose** (sending it to friends or savings is "planned") and charges $10.99/month. Pact/GymPact settled with the FTC in 2017 for charging people who did comply and not paying rewards. Yotta lost access to ~$112M of customer funds when its banking middleman (Synapse) collapsed in 2024. Custody and trust are the problem a contract solves.

The user sees none of it: email login, Apple Pay, dollars.

## 7. Competition

| Product | What it does | Difference |
|---|---|---|
| **Forfeit** (US app) | Habit contracts; miss and your card is charged; verified by Apple Health, GPS, Screen Time or AI/human review; keeps the forfeits; $10.99/month | Forfeits go mostly to your friends who did it; money held by code, not by us; no subscription |
| **Goals** (ETHGlobal Brussels; won Celo and Web3Auth prizes) | Stake on a habit; an image model checks photo proof; winners share forfeits | Friends as witnesses plus AI only on appeal; group goals with invites |
| **JuryDuty** (ETHGlobal New York 2026; won Blink's "Best consumer app") | Social prediction market on real-life moments | We aren't a market on other people; you stake on yourself |
| **Facedown** (iPhone) | Block apps; friends are notified when you bypass | Social pressure only, no money |
| **Pact** (Devpost) | Commitment contract (page blocked our fetch; not verified) | — |
| stickK, Beeminder | Long-standing commitment-contract services | Not group-first, not instant payouts |

## 8. Framing and regulation

- We present it as a commitment to yourself, not betting: no element of chance, and you control the outcome.
- That framing is our position, not legal advice. Commitment contracts with forfeits touch consumer protection (see Pact and the FTC), and money transmission rules apply to holding deposits. This is a devnet demo with test dollars.

## 9. Risks we know about

- **Adoption:** ~12% take-up in the gym study. The group invite is the hook; we measure friends invited per goal.
- **Collusion:** friends could lie for each other. Only people who put money in can vote, and the appeal with proof goes to the AI.
- **Verification cost:** automatic proof (Strava, Screen Time, Apple Health) is the next step; not in the hackathon build.
- **Small stakes:** a $20 stake has to hurt enough to matter; we let each person pick.

## 10. Earlier research that still applies

Before choosing this idea we explored no-loss savings (UK Premium Bonds: 22M+ holders; PoolTogether's TVL fell from $236M to ~$7M without a social layer) and social prediction among friends (JuryDuty and many ETHGlobal projects). Two lessons carried over: money only motivates when it's tied to a group moment, and custody has to be trustless.

## Sources

- Loss aversion: [summary of estimates and meta-analyses](https://healthcare-economist.com/2024/06/26/empirical-estimates-of-loss-aversion) (Tversky & Kahneman 1992; Brown et al. 2024; Walasek, Mullett & Stewart 2024)
- Commitment contracts: [AEA research highlight](https://www.aeaweb.org/research/how-can-financial-incentives-healthy-habits), [Royer et al. (NBER w26161)](https://www.nber.org/system/files/working_papers/w26161/revisions/w26161.rev1.pdf), [Scientific American](https://www.scientificamerican.com/article/can-cash-incentives-keep-people-healthy/)
- Competitors: [Forfeit](https://www.forfeit.app/), [Goals](https://ethglobal.com/showcase/goals-m5kr7), [JuryDuty](https://ethglobal.com/showcase/juryduty-zos15), [Facedown](https://facedown.app), [Pact](https://devpost.com/software/pact-s4akuo)
- Trust failures: Yotta ([Banking Dive](https://www.bankingdive.com/news/yotta-ceo-85k-customers-lose-access-to-funds-due-to-synapse-evolve-tussle/718101/)); Pact/GymPact FTC settlement (2017)
- Culture: Bank of America Better Money Habits (May 2026); Draper creator analysis (May 2026)
- Earlier research: [NS&I Premium Bonds](https://www.nsandi.com/about-us/press-releases/2026/november-premium-bonds-two-millionaires-outer-london-and-shropshire), [PoolTogether on DefiLlama](https://defillama.com/protocol/pooltogether)
