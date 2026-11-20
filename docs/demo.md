# Demo guide

## For judges (2 minutes, on your phone)

1. Open the demo crew: https://house-money-ubc.jairoamayac.workers.dev/?crew=3diKfFoUCuuStkNvsZvwxYumshkZJ4k8SUTTKHYMrUw1
   Leo, Maya and Josh are already in, with a live bet and a live challenge.
2. Pick a name, tap **Join and add money**, pay with **Apple Pay** (simulated, test dollars), send it to the crew.
3. **Bets**: back Yes or No on "Will Leo kiss the girl in red tonight?". Or create your own bet that closes in 1 minute.
4. **Challenges**: tap **I'm in** on "Gym 3 times this week", or start your own.
5. When time is up, vote **It happened / It didn't** (or judge each person **Did it / Didn't**). Winners tap **Collect**.

No wallet, no seed phrase, no SOL. Every action is a real devnet transaction, sponsored by the app.

## Video script (2–3 min)

| Time | Show | Say |
|---|---|---|
| 0:00 | Group chat screenshot: "Leo's not kissing anyone tonight" | Every friend group already bets on each other. And 1 in 3 of us bets for real, mostly because we feel behind. |
| 0:15 | Home: Apple Pay → $50 | House Money is a savings club for your crew. Add money with Apple Pay. No wallet, no crypto words. |
| 0:30 | Crew room: pot growing | Your crew's pot earns every second. |
| 0:45 | New bet, 1 minute, about Leo | Put money on what happens tonight. Leo can bet, he can't vote. |
| 1:10 | Challenge: "Gym 3x this week, $10 each" | Or make a pact: whoever bails pays the rest. |
| 1:30 | Vote → reveal with confetti → Collect | The crew decides. Winners split the losers' stakes. While it was locked, it kept earning. |
| 1:50 | Explorer: program + transactions | Under the hood: Solana. The program enforces one vote per person, majority rules, no double claims. 14/14 on-chain checks on devnet. |
| 2:10 | Close | Save with your crew. Bet on your night. Whoever bails, pays. |

## Running a crew alone (for testing or recording)

```bash
# friends Leo, Maya and Josh, a live bet and challenge; prints the invite link
CREW="Saturday Squad" MINUTES=10 APP_URL=https://house-money-ubc.jairoamayac.workers.dev \
  RPC_URL=https://api.devnet.solana.com node scripts/demo-seed.mts

# after the deadline: friends vote (VOTE=yes|no), judge (FAIL=<names>), and collect
VOTE=no FAIL=Josh RPC_URL=https://api.devnet.solana.com node scripts/demo-act.mts <crewAddress>
```

The friends' keys are saved in `keys/demo-devnet.json` (git-ignored).
