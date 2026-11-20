# Demo and pitch

## For judges (2 minutes, on your phone)

Open https://kept.jairoamayac.workers.dev. One welcome, two ways in:

- **Try the demo**: the whole story in 75 seconds, offline (five friends, a disputed proof, the Grok council, the payout). Press **D** or **Demo controls > Play all**.
- **Get started**: your real account, by email (Privy).
  1. **Add funds** with Apple Pay (simulated: test dollars, no card charged).
  2. **New goal**: write it, pick an amount and a deadline (2 min for testing). The money is locked and lent on Kamino while the pact runs.
  3. **Invite** a friend with the link; they join with their own goal.
  4. When time is up, vote on each other: **Kept it** or **Didn't**. Then **Collect**.

No wallet, no seed phrase, no fees: every action is a real devnet transaction, sponsored by the app.

## Pitch (3 minutes, the team's script)

| | Time | Say | Show |
|---|---|---|---|
| Hook | 20 s | "Raise your hand if you've ever set a goal and quit. Losing hurts about twice as much as winning feels good, yet every habit app tries to motivate us with rewards. We flipped it." | Title slide |
| Problem | 25 s | "Failing a goal costs nothing. No consequences, no commitment. Reminders don't work. Streaks don't work. Losing something that hurts does." | One line on screen |
| Solution | 30 s | "Kept: set a goal with your friends, put real money on the line, your friends verify. Hit it and you get your money back plus a share of the people who quit. Miss it and you lose it. It's not betting on others; it's a commitment to yourself." | App home |
| Demo | 75 s | Sign in with email, Apple Pay, set "Run 21 km by Sunday", stake $20, friends join with their own goals, deadline, verification, payout. Dispute → Grok council review (in the demo; live once its keys are set). | Live app or `/demo` on a phone |
| Why Solana | 20 s | "The stakes live in a program, not in our bank account. Nobody can run off with the money: not your friends, not us. While a pact runs, the pot earns real interest on Kamino. Rules are code; payouts are instant and almost free." | Explorer: program + a payout transaction |
| Business + close | 20 s | "When someone walks away, 95% of their money goes to the friends who kept their word, and we keep 5%. Next: Strava, Screen Time and Apple Health, so proof is automatic. Promises that keep themselves." | Closing slide |

Likely questions:
- *Why does the platform take money?* Our incentive is growth: we earn more when more people join and complete.
- *Is this gambling?* No element of chance: you stake on your own behaviour, which you control.
- *What if friends collude?* Only people who put money in can confirm, nobody confirms themselves, a strict majority of the others decides, and nobody loses money without that majority. Disputes are recorded on-chain and reviewed by the Grok council. Invite-only groups come next.
- *Who holds the money?* The program. Not us, not your friends.

## Running a group alone (testing or recording)

```bash
# friends Leo, Maya and Josh with a live commitment; prints the invite link
CREW="Saturday Squad" MINUTES=10 APP_URL=https://kept.jairoamayac.workers.dev \
  RPC_URL=https://api.devnet.solana.com node scripts/demo-seed.mts

# after the deadline: friends verify (FAIL=<names> didn't do it) and collect
FAIL=Josh RPC_URL=https://api.devnet.solana.com node scripts/demo-act.mts <crewAddress>
```

The friends' keys are saved in `keys/demo-devnet.json` (git-ignored).
