# Add funds with Apple Pay or a card (Crossmint, test mode)

What it does: on **Add funds**, a signed-in person picks an amount, pays with Apple Pay or a card in Crossmint's
embedded checkout, and the same amount lands in their Kept balance. Staging only: no real money moves.

How: the Worker creates a Crossmint **staging** order (USDC on Solana devnet, `exact-in`, the person's own Privy
account as the recipient). When Crossmint reports the order complete, `POST /api/onramp/credit` checks it with
Crossmint's Get Order (completed, one line item, recipient = this account, at most $500), and returns a sponsor-signed
transfer of the same amount of **hmUSD** (the test dollar pacts and the Kamino devnet reserve use), exactly like the
simulated top-up. One credit per order (KV key `onramp:credit:<orderId>` in the existing `DISPUTES` namespace, plus a
`kept-onramp:<orderId>` memo on the transfer). The devnet USDC Crossmint delivers stays in the person's account.

Safe fallback: Add funds keeps today's simulated Apple Pay sheet unless **all** of these hold:
`NEXT_PUBLIC_CROSSMINT_CLIENT_KEY` is set at build time (it is, in `.env.production`), the person signed in with email
(Privy), and `GET /api/config` says `onramp: true` (the Worker has `CROSSMINT_SERVER_KEY`). The demo (`/demo`) is untouched.

## What Jairo needs to do

1. **Server key (secret).** In the Crossmint **staging** console, the server key needs the scopes `orders.create`,
   `orders.read` and the users / linked-wallets scope (to link the person's account). Then:
   `npx wrangler secret put CROSSMINT_SERVER_KEY` (paste the `sk_staging_...`, never commit it).
2. **Client key (public).** Already in `.env.production` as `NEXT_PUBLIC_CROSSMINT_CLIENT_KEY` (`ck_staging_...`).
   In the staging console, allow the origin `https://kept.jairoamayac.workers.dev` for that key if it asks for origins.
3. **Apple Pay domain.** The file for `kept.jairoamayac.workers.dev` (from the staging console, Integrate → Apple Pay
   Domains) is committed as `worker/apple-developer-merchantid-domain-association.txt` and the Worker serves it byte for
   byte at `/.well-known/apple-developer-merchantid-domain-association` (`text/plain`; `run_worker_first` covers
   `/.well-known/*`). Optional override: `npx wrangler secret put CROSSMINT_APPLE_PAY_DOMAIN_FILE`.
   After deploying, open that URL to check it, then press **Verify domain** in the Crossmint console.
4. **Deploy:** `npm run build && npx wrangler deploy`. Check `curl https://kept.jairoamayac.workers.dev/api/config`
   shows `"onramp": true`.
5. **Test.**
   - Any browser: in the checkout, pay with card `4242 4242 4242 4242`, any future date, any CVC.
   - Apple Pay: Safari on a real iPhone (iOS 17+) or Mac with a card in Wallet; not the simulator, not localhost.
     In staging the Wallet card is never charged.
   - Crossmint first shows a short identity step ("One quick check": country, name, date of birth). Staging accepts
     test data; plan for it in the pitch (do one purchase beforehand with the same email so it is already done).

## Risks and limits

- **`workers.dev` and Apple Pay.** `workers.dev` is a shared Cloudflare domain; Apple verifies per (sub)domain, so it
  should work, but if Verify domain fails, use a custom domain (and its own file). Cards keep working either way.
- **Idempotency** relies on KV, which is eventually consistent. A double request with the same blockhash produces the
  same transaction (it cannot land twice); a reissue only happens once the earlier transfer provably did not land and its
  blockhash expired. Two near-simultaneous requests with different blockhashes could in theory both be signed; the
  amount is capped at $500 of test dollars and rate-limited (TOPUP_LIMIT per IP, per account, per order).
- **Production** is blocked in code (`CROSSMINT_ENV=production` refuses credits): real USDC must not buy test dollars.
  Going live means a signed Order Form + KYB with Crossmint, and pacts running on real USDC on mainnet (then the onramp
  delivers straight into the account and `/api/onramp/credit` goes away).
- No webhook yet: the app asks for the credit when the checkout reports completion; "Try again" covers a dropped
  connection. A signed `orders.delivery.completed` webhook can be added later.

## Files

`worker/onramp.ts` (routes and rules), `worker/index.ts` (wiring, `/api/config` flag, Apple Pay file),
`src/components/AddFundsCrossmint.tsx`, `src/components/CrewsApp.tsx` (flag), `src/lib/house-money/solana/live.ts`
(`onrampOrder`, `creditOnramp`), `scripts/onramp-check.mts` (unit checks: `node scripts/onramp-check.mts`).

Sources: https://docs.crossmint.com/onramp/overview, https://docs.crossmint.com/onramp/quickstarts/react,
https://docs.crossmint.com/onramp/guides/payment-methods, https://docs.crossmint.com/payments/embedded/quickstarts/apple-pay-only
