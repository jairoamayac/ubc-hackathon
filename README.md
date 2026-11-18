# House Money

> Save like a grown-up. Play with house money.

A savings account that only lets you play with the interest. Your money sits in your **Vault**; only the interest it earns (your **house money**) can be used for a weekly call: *is SOL going up or down this week?* Worst case, you lose that week's interest. Never your savings.

Built for the UBC Hackathon 2026 (Consumer Apps track, Solana).

- **Live demo:** https://house-money-ubc.jairoamayac.workers.dev
- Architecture and flows (C4, state machine, sequences): [`docs/architecture.md`](docs/architecture.md)
- Brand (60 / 30 / 10): [`docs/brand.md`](docs/brand.md)

## Status

| Part | State |
|---|---|
| Frontend (Next.js 16, Tailwind 4) | Done, with simulated data behind the `HouseMoneyClient` facade |
| Anchor program (`house_money`) | Not started |
| Privy login + fee payer (`/api/relay`) | Not started |
| QuickNode Streams notifications | Not started |

The UI never talks to the chain directly: every screen calls `src/lib/house-money/client.ts`. Today that is `createMockClient()`; swapping it for a Solana client does not touch the screens.

## Run locally

```bash
npm install
npm run dev
```

## Deploy (Cloudflare Worker, static assets)

```bash
npm run build
npx wrangler deploy
```

`next.config.ts` uses `output: "export"`, so the build is plain static files in `out/`, served by the Worker defined in `wrangler.jsonc`. When server routes are needed (`/api/relay`, `/api/streams`), move to a Workers runtime for Next.js (vinext is Cloudflare's recommended path).
