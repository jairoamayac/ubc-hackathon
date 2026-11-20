# Archive

Earlier iterations, kept for history. Nothing here is built, deployed or imported by the app.

- `v1-house-money/`: the first concept (a savings Vault where only the interest could be played on a weekly SOL call), its mock-data screens, its architecture and its brand (Paper/Navy/Ember). Replaced by Kept on 19–20 Nov 2026; see `docs/decisions.md`.
- `scripts/`: setup and test scripts from earlier phases:
  - one-off seeding scripts from the v1 phase;
  - `e2e.mts` (simulated yield and the SOL up/down "tryhard" calls), `social-e2e.mts` (yes/no bets) and `yield-check.mts` (simulated yield). Tryhard and bets were turned off in the program after the 20 Nov audit (`docs/audit-2026-11-20.md`), and real yield now comes from Kamino (`scripts/kamino-e2e.mts`).
- `next-template/`: the default icons from `create-next-app`, unused by the app.
