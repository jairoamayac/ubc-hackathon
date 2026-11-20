# Sign-in with Privy (Google and email)

Replaces the demo sign-in (a first name plus a key kept in `localStorage`) with Privy: **Continue with Google** or **Continue with email** (one-time code). Privy creates the person's Solana account on first sign-in; the app never shows it, and every action is signed by it. The sponsor in the Worker still pays all fees.

If `NEXT_PUBLIC_PRIVY_APP_ID` is **not** set at build time, the app runs the old demo sign-in unchanged. If it is set but Privy doesn't start within 10 s (wrong id, origin not allowed, no network), the app falls back to the demo sign-in too, so the demo never dead-ends on a spinner.

## How it works

```
Continue with Google / email  ->  Privy modal (login)  ->  Privy creates the embedded Solana account
every action: app builds tx (fee payer = sponsor)
  -> Privy signs as the account (useSignTransaction, no pop-up)      src/components/auth/PrivyGate.tsx
  -> POST /api/sponsor: Worker vets it and adds the fee payer signature   worker/index.ts (unchanged)
  -> the app sends it to the RPC
```

- `src/components/auth/PrivyGate.tsx`: `PrivyProvider`, sign-in screen, `PrivySignerAdapter` (the adapter named in `docs/architecture.md`).
- `src/lib/house-money/solana/signer.ts`: `OwnerSigner` interface. `LiveClient` only knows this interface; the device-key signer (fallback) and the Privy signer both implement it. The returned signature is only accepted if the signed message is byte-identical to the one we sent.
- `src/components/auth/AuthGate.tsx`: loads Privy only when an app id is set (lazy chunk), otherwise wraps the app in the local mode.
- Display name = first name from the Google profile, or the part of the email before `@`. It is written to the same `localStorage` keys as before (`hm.name`, `hm.profile`) plus a new `hm.owner` (which account they belong to), so `setProfile` and the rest of the app are unchanged.
- Docs used: [setup](https://docs.privy.io/basics/react/setup), [automatic account creation](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation), [Solana networks](https://docs.privy.io/basics/react/advanced/configuring-solana-networks), [sign a Solana transaction](https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction), [create a wallet](https://docs.privy.io/wallets/wallets/create/create-a-wallet), [login methods](https://docs.privy.io/basics/get-started/dashboard/configure-login-methods), [allowed domains](https://docs.privy.io/recipes/react/allowed-domains).

## Setup (one time, in the Privy dashboard: https://dashboard.privy.io)

1. Create an app (type **Web / client-side**). Copy the **App ID** (it looks like `cm...`; it is public, not a secret). Never use the App Secret anywhere in this repo.
2. **Login methods** (Authentication): turn on **Email** (one-time code) and **Google**. Privy's default Google credentials are enough for the demo.
3. **Wallets / Embedded wallets**: turn on embedded wallets for **Solana**. (The app also asks Privy to create the account automatically at first sign-in and hides Privy's confirmation pop-ups.)
4. **Configuration > App settings > Domains > Allowed origins**: add
   - `https://house-money-ubc.jairoamayac.workers.dev` (production demo; add any other production URL or custom domain too)
   - `http://localhost:3000` (for `npm run dev`; the port is required)
   
   Protocol `https` is required, no trailing paths. Sign-in will not start from a site that isn't listed here.
5. Hand the App ID to whoever runs the deploy (see below).

## Where the App ID goes

**Already done:** `.env.production` (committed; the App ID is public) holds `NEXT_PUBLIC_PRIVY_APP_ID=cmwp0pqgn03et0gld17mispk3`, and `next build` reads it automatically, so `npm run build && npx wrangler deploy` is enough. To use a different app, override it in the shell as below or edit that file.

The site is a Next.js **static export** (`output: "export"`) served by the Cloudflare Worker `house-money-ubc`. `NEXT_PUBLIC_*` variables are baked into the JavaScript **when `npm run build` runs**, so they must exist in the environment of the build, not in the Worker:

```bash
# whoever deploys (the one logged in to wrangler):
NEXT_PUBLIC_PRIVY_APP_ID=<app id> npm run build && npx wrangler deploy
```

or put it in a file so it's never forgotten: `.env.production.local` (git-ignored, local only) or `.env.production` (public value, can be committed with `git add -f`) containing

```
NEXT_PUBLIC_PRIVY_APP_ID=<app id>
```

`wrangler.jsonc` `vars` and `wrangler secret put` do **not** reach the browser bundle, so don't put it there. `NEXT_PUBLIC_PRIVY_CLIENT_ID` is optional (only if you create an app client in the dashboard).

Local test: `NEXT_PUBLIC_PRIVY_APP_ID=<app id> npm run dev`.

## Tested

Locally against this App ID (static build served on `http://localhost:3000`, `/api` proxied to the deployed Worker): email one-time code sign-in, account created, name taken from the email, and the first sponsored transaction (saving the name) signed by the Privy account and confirmed on devnet. Google was not clicked through (needs a Google login).

## Not covered

- People who used the demo before keep their old on-device account only in the demo mode; a Google/email account starts with a fresh Privy account (no test dollars until they use Apple Pay in the app).
- Apple Pay is still simulated.
- Account recovery, MFA and a custom Google OAuth app (own branding on the Google screen) are production steps, not in the hackathon build.
