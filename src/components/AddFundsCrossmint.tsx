"use client";

// Add funds with Apple Pay or a card, through Crossmint's embedded checkout (test mode on staging).
// Flow: pick an amount -> the Worker creates the order for this account -> Crossmint takes the payment ->
// when the order is complete, the Worker adds the same amount to the balance (see worker/onramp.ts, docs/ONRAMP.md).
// Only mounted when NEXT_PUBLIC_CROSSMINT_CLIENT_KEY is set, the person signed in with email (Privy) and the Worker
// says the onramp is ready; otherwise CrewsApp keeps the simulated Apple Pay sheet.
import { useEffect, useRef, useState } from "react";
import { CrossmintCheckoutProvider, CrossmintEmbeddedCheckout, CrossmintProvider, useCrossmintCheckout } from "@crossmint/client-sdk-react-ui";
import type { LiveClient } from "@/lib/house-money/solana/live";
import { usd } from "@/lib/format";
import { ErrorNote, Spinner } from "./kept/ui";

const AMOUNTS = [20, 50, 100];

export function AddFundsCrossmint({ client, email, clientKey, busy, onPaid }: {
  client: LiveClient;
  email: string;
  clientKey: string;
  busy: boolean;
  /** Called once Crossmint says the payment is complete: adds the money (the parent shows the toast and closes). */
  onPaid: (orderId: string, amount: number) => Promise<boolean>;
}) {
  const [amt, setAmt] = useState(50);
  const [order, setOrder] = useState<{ orderId: string; clientSecret: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setStarting(true);
    setError("");
    try {
      setOrder(await client.onrampOrder(email, amt));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  if (order) {
    return (
      <CrossmintProvider apiKey={clientKey} consoleLogLevel="silent">
        <CrossmintCheckoutProvider>
          <Checkout order={order} email={email} amount={amt} busy={busy} onPaid={onPaid} onBack={() => setOrder(null)} />
        </CrossmintCheckoutProvider>
      </CrossmintProvider>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Amount</legend>
        <div className="grid grid-cols-3 gap-2">
          {AMOUNTS.map((a) => <button key={a} onClick={() => setAmt(a)} aria-pressed={amt === a} className="tile min-h-12 py-3 text-xl font-medium">${a}</button>)}
        </div>
      </fieldset>
      <div className="card space-y-2 p-4 text-sm">
        <p className="flex justify-between"><span className="text-muted">Pay with</span><span>Apple Pay or a card</span></p>
        <p className="flex justify-between text-base font-medium"><span>You add</span><span className="tabular-nums">{usd(amt)}</span></p>
      </div>
      {error && <ErrorNote text={error} onRetry={start} />}
      <button disabled={starting} onClick={start} className="btn btn-primary w-full py-4 text-lg">{starting ? "Starting" : `Continue to pay ${usd(amt)}`}</button>
      <p className="text-center text-xs text-muted">Test mode: no card is charged. Payments are handled by Crossmint.</p>
    </div>
  );
}

function Checkout({ order, email, amount, busy, onPaid, onBack }: {
  order: { orderId: string; clientSecret: string };
  email: string;
  amount: number;
  busy: boolean;
  onPaid: (orderId: string, amount: number) => Promise<boolean>;
  onBack: () => void;
}) {
  const { order: live } = useCrossmintCheckout();
  const phase = (live as { phase?: string } | undefined)?.phase;
  const [failed, setFailed] = useState(false);
  const sent = useRef(false);

  const credit = async () => {
    sent.current = true;
    setFailed(false);
    if (!(await onPaid(order.orderId, amount))) setFailed(true);
  };

  useEffect(() => {
    if (phase !== "completed" || sent.current) return;
    // Starts the credit once; the result arrives asynchronously (no synchronous setState here).
    void credit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className="space-y-4">
      {phase !== "completed" && (
        <CrossmintEmbeddedCheckout
          orderId={order.orderId}
          clientSecret={order.clientSecret}
          payment={{
            receiptEmail: email,
            crypto: { enabled: false },
            fiat: { enabled: true, allowedMethods: { applePay: true, card: true, googlePay: false } },
            defaultMethod: "fiat",
          }}
          appearance={{
            variables: {
              borderRadius: "12px",
              colors: { accent: "#ff7a3d", textPrimary: "#1a1a18", textSecondary: "#6b6a64", backgroundPrimary: "#ffffff", borderPrimary: "#e4e0d8" },
            },
            rules: { DestinationInput: { display: "hidden" }, ReceiptEmailInput: { display: "hidden" }, GlobalMessage: { display: "visible" } },
          }}
        />
      )}
      {phase === "completed" && !failed && <Spinner label={busy ? `Adding ${usd(amount)} to your balance` : "Payment received"} />}
      {failed && <ErrorNote text="Your payment went through, but we couldn't add it yet." onRetry={credit} />}
      {phase !== "completed" && <button onClick={onBack} className="btn btn-quiet w-full">Change amount</button>}
      <p className="text-center text-xs text-muted">Test mode: no card is charged. Payments are handled by Crossmint.</p>
    </div>
  );
}
