# Demo and pitch

## For judges (2 minutes, on your phone)

1. Open the demo group: https://house-money-ubc.jairoamayac.workers.dev/?crew=3diKfFoUCuuStkNvsZvwxYumshkZJ4k8SUTTKHYMrUw1
   Leo, Maya and Josh are already in, with a live commitment ("Gym 3 times this week").
2. Pick a name, tap **Join and add money**, pay with **Apple Pay** (simulated, test dollars).
3. **Challenges**: tap **I'm in**, or start your own commitment with a 1-minute deadline.
4. When time is up, verify each friend: **Did it / Didn't**. Then **Collect**.

No wallet, no seed phrase, no fees. Every action is a real devnet transaction, sponsored by the app.

## Pitch (3 minutes, the team's script)

| | Time | Say | Show |
|---|---|---|---|
| Hook | 20 s | "Raise your hand if you've ever set a goal and quit. Losing hurts about twice as much as winning feels good, yet every habit app tries to motivate us with rewards. We flipped it." | Title slide |
| Problem | 25 s | "Failing a goal costs nothing. No consequences, no commitment. Reminders don't work. Streaks don't work. Losing something that hurts does." | One line on screen |
| Solution | 30 s | "Kept: set a goal with your friends, put real money on the line, your friends verify. Hit it and you get your money back plus a share of the people who quit. Miss it and you lose it. It's not betting on others; it's a commitment to yourself." | App home |
| Demo | 75 s | Sign in, Apple Pay, set "Run 21 km by Sunday", stake $20, friends join with their own goals, deadline, verification, payout. *Appeal with a screenshot reviewed by AI: show only once it's built; until then, say it's next.* | Live app on a phone |
| Why Solana | 20 s | "The stakes live in a program, not in our bank account. Nobody can run off with the money: not your friends, not us. Rules are code; payouts are instant and almost free." | Explorer: program + a payout transaction |
| Business + close | 20 s | "When someone walks away, 95% of their money goes to the friends who kept their word, and we keep 5%. Next: Strava, Screen Time and Apple Health, so proof is automatic. Promises that keep themselves." | Closing slide |

Likely questions:
- *Why does the platform take money?* Our incentive is growth: we earn more when more people join and complete.
- *Is this gambling?* No element of chance: you stake on your own behaviour, which you control.
- *What if friends collude?* Only people who put money in can confirm, nobody confirms themselves, and a strict majority decides. Appeals with proof reviewed by AI come next; we say so openly.
- *Who holds the money?* The program. Not us, not your friends.

## Running a group alone (testing or recording)

```bash
# friends Leo, Maya and Josh with a live commitment; prints the invite link
CREW="Saturday Squad" MINUTES=10 APP_URL=https://house-money-ubc.jairoamayac.workers.dev \
  RPC_URL=https://api.devnet.solana.com node scripts/demo-seed.mts

# after the deadline: friends verify (FAIL=<names> didn't do it) and collect
FAIL=Josh RPC_URL=https://api.devnet.solana.com node scripts/demo-act.mts <crewAddress>
```

The friends' keys are saved in `keys/demo-devnet.json` (git-ignored). `demo-seed` also creates a yes/no bet from the earlier concept; the app will hide bets (D13).
