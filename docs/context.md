# Why House Money exists: problem, evidence, prior art

Last updated: 20 Nov 2026. Figures carry their source; where sources disagree or a claim is unverified, it says so.

## 1. The problem

Young people in the US don't lack a place to save. They lack a reason to.

| Signal | Figure | Source |
|---|---|---|
| Saving is at a low | US personal saving rate 3.8% (Sep 2026), the lowest since 2022 | BEA via KPMG |
| Living paycheck to paycheck | 42% of Gen Z | Bank of America, Better Money Habits (May 2026) |
| Speculating to "catch up" | 32% of Gen Z bet or use prediction markets; 80% of them because they feel behind | Northwestern Mutual via CNBC (May 2026) |
| And losing it | 90% of Solana wallets that bought through Fomo were at a loss after fees | Bitquery (17 Oct 2026) |
| Prediction markets are the consumer app of the moment | Kalshi ~81% of Oct 2026 volume across 8 US exchanges; Phantom integrated Kalshi for US users on 28 Oct 2026 | DeFi Rate; Crypto Economy (volume figures vary widely by methodology) |

The honest reframe: "saving is slow" is true but it doesn't explain why anyone would use us instead of a piggy bank or a high-yield savings account. **Savings doesn't compete with the piggy bank. It competes with the bet.** The excitement, the group chat and the "my team won" feeling live in betting apps, and those take your money.

## 2. What the culture already does (TikTok, fall 2026)

- **Accountability in public:** #TheGreatLockIn, loud budgeting (42% of Gen Z practice it; 60% talk about money with friends, Bank of America May 2026), "save with me" challenges.
- **Challenges with episodes travel best:** "Save $25,000 with me" reached ~2M views; "a challenge has episodes" and "replaces instruction with participation" (Draper analysis of 10k–500k follower creators, May 2026).
- **Friend-group predictions are a format:** social prediction apps keep appearing at hackathons (see §4).

So the behaviour exists. The product turns it into money that moves between friends, with the savings layer underneath.

## 3. Evidence on the mechanics we use

**Prize-linked / no-loss savings works at scale.**
- UK Premium Bonds: 22M+ holders; ~£497M in prizes in the Sep 2026 draw; nobody loses principal; running since 1956 (NS&I press releases, 2026).
- Prize-linked savings attracts people with low savings in particular (Cole, Iverson & Tufano, NBER). Causal evidence on lasting new savings is weaker (Burke 2019; MaPS evidence review).

**Where it failed, and what we take from it.**

| Product | What happened | Lesson |
|---|---|---|
| Long Game (US, prize-linked savings) | Acquired by Truist in 2022, removed from app stores in late 2023, later relaunched | A prize alone doesn't retain |
| Yotta (US, prize-linked savings) | Its BaaS provider Synapse collapsed in 2024: ~$112M of ~85,000 customers' funds missing; California fined Yotta $1M | Custody is the weak point. Funds held by a program, not an intermediary, is a real reason to use a chain |
| PoolTogether (crypto no-loss) | TVL from $236M (May 2021) to ~$7M (Nov 2026), per DefiLlama | Without a social layer and a live moment, people leave |
| Pact / GymPact (commitment contracts) | FTC settlement in 2017 for charging users who did comply and not paying rewards | People have to trust the operator to pay. Here the program pays, by the crew's vote |

**Competition and leaderboards motivate, with a cost.** In Kahoot studies, 75% of students reported live competition as motivating and 24% found the leaderboard stressful (CDHA study). We show your crew's standing, not a public shame list.

## 4. Prior art and how we differ

| Project | What it does | Where we differ |
|---|---|---|
| **JuryDuty** (ETHGlobal New York 2026; won Blink's "Best consumer app" prize) | Social prediction market on real-life moments among friends; points first, then crypto-backed markets; ENS identities, Walrus records, Privy wallets | Stakes come from savings that keep earning while locked; crews with a strict-majority vote where the subject can't vote; Apple Pay entry |
| **Goals** (ETHGlobal Brussels; won Celo and Web3Auth prizes) | Stake on a habit; an image model checks photo proof; winners get their stake back plus a share of the forfeits | Same payout logic, but judged by your crew and staked from a pot that earns |
| **Forfeit** (app, US) | Habit contracts: miss the deadline and your card is charged; verified by Apple Health, GPS, Screen Time or AI/human review; **Forfeit keeps the forfeited money** (sending it to friends or savings is "planned"); $10.99/month | Forfeits go to the friends who did it and stay in the group's savings; no subscription |
| **Pact** (Devpost) | Commitment contract (page blocked our fetch, details not verified) | — |
| **Lotty**, **No Loss Lottery** (Stellar hackathons; the latter won) | No-loss wagering on yield | We add real-life bets and challenges among friends; the chain settles by the crew's vote |
| **SureFly** (Proffer hackathon winner) | P2P insurance for missed flights | Same "friends cover each other" idea; we generalise it to any bet or challenge |
| Social prediction on ETHGlobal (Haki, Vybe, StakeSocial, TweetBet, SocialPredMarket, ChainBet) | Crowded category | We are savings first; betting is the reason to come back |
| Tanda (US startup), MyMAF, savings-circle builds (Chancha+, PULSO Tanda, KipuFi, Sharibo) | Group savings / ROSCAs | No ROSCA rotation; a shared pot that earns, plus stakes |
| Acorns, Bitstack, Fold, OnePay | Round-ups into investments or bitcoin | Solo saving; no social layer |
| Kalshi, Polymarket, DraftKings | Real-money predictions and betting | You can lose all of it; we keep everything inside the friend group's savings |

Pattern from the biggest hackathons (Bolt World's Largest Hackathon, NASA Space Apps, TreeHacks, Gemini API competition, Chainlink, Base Batches, Sui Overflow, ETHGlobal): web2 winners show a clear human impact and a live "wow"; web3 winners hide the crypto (seedless, gasless wallets) and move money between people. House Money aims at both: invisible chain, money between friends, a reveal moment.

## 5. Honest limits and risks

- **Demo money:** dollars are a devnet test token; Apple Pay is simulated. Production: an on-ramp (Coinbase Onramp or MoonPay with Apple Pay) into USDC.
- **Demo yield:** devnet has no real yield; a reserve pays 5% a year, sped up 5,000x. Production: USDC lending.
- **Who decides:** the crew's strict majority. A crew can collude; that is the social contract of a friends' bet. Production: verifiable data where it exists (flight status, scores), and a dispute window.
- **Regulation:** real-money bets are gambling or event contracts (CFTC); prize-linked savings in the US is allowed for banks and credit unions (American Savings Promotion Act, 2014), and fintechs usually go through sweepstakes rules; commitment contracts with forfeits have consumer-protection exposure (see Pact/FTC). This is a devnet demo.
- **Small numbers:** a crew's yield alone is tiny (6 people × $100 at 5% ≈ $0.58/week). The stakes between friends are what make it exciting; pooling yield across many crews (the Premium Bonds model) is the path to big prizes.
- **Retention:** PoolTogether's decline says a mechanic isn't enough; the weekly "who bailed?" moment has to become a habit.

## 6. Open questions

- Should bets about a person require that person's consent before going live?
- Minimum crew size for a fair vote (today a 2-person crew can deadlock on challenges)?
- A timeout or creator-resolve path when the crew never reaches a majority.
- Pooling yield across crews into a weekly prize (Premium Bonds model) as a third mode.

## Sources

- BEA via KPMG; Bank of America Better Money Habits (May 2026); Northwestern Mutual via CNBC (May 2026); Bitquery (Oct 2026); DeFi Rate (Oct 2026); Draper creator analysis (May 2026).
- NS&I: [Nov 2026 draw](https://www.nsandi.com/about-us/press-releases/2026/november-premium-bonds-two-millionaires-outer-london-and-shropshire), [2026 rates](https://www.nsandi.com/about-us/press-releases/2026/boost-for-premium-bonds-including-around-308k-extra-tax-free-prizes-plus-improved-rates-four-other-nsi-savings-products)
- Prize-linked savings: [Cole, Iverson & Tufano (NBER)](https://conference.nber.org/confer/2014/HFDCf14/summaryCole.pdf), [MaPS evidence review](https://evidence-hub.maps.org.uk/en/research-library/review/how-effective-are-reward-based-and-prize-linked-savings-schemes)
- Yotta: [Banking Dive](https://www.bankingdive.com/news/yotta-ceo-85k-customers-lose-access-to-funds-due-to-synapse-evolve-tussle/718101/), [California fine](https://www.bankingdive.com/news/california-fines-yotta-1M-customers-still-out-millions/820764/)
- Long Game: [eMarketer](https://www.emarketer.com/content/gamified-app-long-game-younger-demographic-truist-craves-goldman)
- [PoolTogether on DefiLlama](https://defillama.com/protocol/pooltogether)
- Kahoot: [CDHA study](https://files.cdha.ca/profession/journal/2841.pdf)
- Prior art: [JuryDuty](https://ethglobal.com/showcase/juryduty-zos15), [Pact](https://devpost.com/software/pact-s4akuo), [Goals](https://ethglobal.com/showcase/goals-m5kr7), [Forfeit](https://www.forfeit.app/), [Lotty](https://dorahacks.io/buidl/36787), [No Loss Lottery](https://dorahacks.io/buidl/36214), [SureFly](https://github.com/sidb03/surefly), [Haki](https://ethglobal.com/showcase/haki-czu3q), [Vybe](https://ethglobal.com/showcase/vybe-n6s9o)
- Hackathon winners: [Bolt](https://bolt.new/blog/2025-bolt-hackathon-winners), [NASA Space Apps 2025](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/), [TreeHacks 2026](https://stanforddaily.com/2026/02/15/12th-annual-treehacks/), [Gemini API competition](https://developers.googleblog.com/en/announcing-the-winners-of-the-gemini-api-developer-competition/), [Chainlink Constellation](https://chain.link/blog/constellation-hackathon-winners), [Base Batches](https://devfolio.co/blog/base-batches-2025-recap/), [Sui Overflow 2025](https://blog.sui.io/2025-sui-overflow-hackathon-winners/)
