"use client";

// Sign-in with Privy: email (one-time code). Privy creates the person's Solana account on
// first sign-in; the app never shows it. Docs used:
//  - Setup / PrivyProvider: https://docs.privy.io/basics/react/setup
//  - Automatic account creation: https://docs.privy.io/basics/react/advanced/automatic-wallet-creation
//  - Solana networks: https://docs.privy.io/basics/react/advanced/configuring-solana-networks
//  - Sign a transaction (useSignTransaction, useWallets from "@privy-io/react-auth/solana"):
//    https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction
//  - Create a wallet (useCreateWallet): https://docs.privy.io/wallets/wallets/create/create-a-wallet
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useCreateWallet, useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, type Transaction } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ownerSignatureFrom, type OwnerSigner } from "@/lib/house-money/solana/signer";
import { Onboarding } from "../Onboarding";
import { AuthContext, PRIVY_APP_ID, PRIVY_CLIENT_ID } from "./AuthContext";
import { AuthShell, Splash } from "./Splash";

type PrivyWallet = ReturnType<typeof useWallets>["wallets"][number];
type SignTransaction = ReturnType<typeof useSignTransaction>["signTransaction"];

/** Adapter: the Privy embedded account as an OwnerSigner (docs/architecture.md, "PrivySignerAdapter"). */
class PrivySignerAdapter implements OwnerSigner {
  readonly publicKey: PublicKey;
  constructor(private wallet: PrivyWallet, private signRef: { current: SignTransaction }) {
    this.publicKey = new PublicKey(wallet.address);
  }
  async sign(tx: Transaction) {
    // The sponsor is the fee payer and has not signed yet, so ask only for the owner's signature.
    const transaction = new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
    // A hidden signer that never answers must not freeze the app (every other action waits on this one).
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Signing took too long. Please try again.")), 60_000));
    const { signedTransaction } = await Promise.race([timeout, this.signRef.current({
      transaction,
      wallet: this.wallet,
      chain: "solana:devnet",
      options: { uiOptions: { showWalletUIs: false } }, // no confirmation pop-up: one tap in our own UI
    })]);
    tx.addSignature(this.publicKey, ownerSignatureFrom(signedTransaction, tx, this.publicKey));
  }
}

export default function PrivyGate({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID || undefined}
      config={{
        loginMethods: ["email"],
        appearance: { theme: "light", accentColor: "#2e2260", walletChainType: "solana-only", showWalletLoginFirst: false },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
      }}
    >
      <Session>{children}</Session>
    </PrivyProvider>
  );
}

const PRIVY_START_TIMEOUT_MS = 10_000;
const WALLET_WAIT_MS = 15_000;
const KEY_NAME = "hm.name";
const KEY_PROFILE = "hm.profile"; // the name last saved for this account
const KEY_OWNER = "hm.owner"; // which account hm.name / hm.profile belong to

function Session({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signTransaction } = useSignTransaction();
  const signRef = useRef<SignTransaction>(signTransaction);
  useEffect(() => {
    signRef.current = signTransaction;
  }, [signTransaction]);

  const [error, setError] = useState("");
  const [gaveUp, setGaveUp] = useState(false);
  const [setupError, setSetupError] = useState(false);
  const [setupTry, setSetupTry] = useState(0);
  const creating = useRef(false);

  // If Privy never starts (wrong app id, this site not in the allowed origins, no network), don't leave
  // the demo stuck on a spinner: after a few seconds fall back to the local demo sign-in.
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setGaveUp(true), PRIVY_START_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready]);

  const wallet = wallets[0];
  const address = wallet?.address;

  // On a reload the user comes back signed in and Privy lists their Solana account a moment later than
  // `authenticated`. If the profile already has one, we must wait for it, never create a second one
  // (Privy rejects that, which used to land on "We couldn't finish setting up your account").
  const hasAccount = !!user?.linkedAccounts?.some((a) => a.type === "wallet" && "chainType" in a && a.chainType === "solana");

  // createOnLogin covers new sign-ins; this covers anyone who is signed in but has no account yet.
  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || wallet || hasAccount || creating.current) return;
    creating.current = true;
    setSetupError(false);
    createWallet()
      .catch((e: unknown) => {
        // "Already has an account" is success: it will show up in the wallets list in a moment.
        if (!/already|exist/i.test(e instanceof Error ? e.message : String(e))) setSetupError(true);
      })
      .finally(() => {
        creating.current = false;
      });
  }, [ready, authenticated, walletsReady, wallet, hasAccount, createWallet, setupTry]);

  // They have an account but it never showed up in the list: stop spinning and offer a real retry.
  useEffect(() => {
    if (!ready || !authenticated || wallet || !hasAccount) return;
    const t = setTimeout(() => setSetupError(true), WALLET_WAIT_MS);
    return () => clearTimeout(t);
  }, [ready, authenticated, wallet, hasAccount, setupTry]);
  useEffect(() => {
    if (wallet) setSetupError(false);
  }, [wallet]);

  // "Try again": with an account already on file the cleanest retry is a fresh load of the session.
  const retrySetup = useCallback(() => {
    if (hasAccount) location.reload();
    else setSetupTry((n) => n + 1);
  }, [hasAccount]);

  // The rest of the app reads the name from localStorage ("hm.name"). We never take it from the email
  // (it can look like "a.r.i.a+abuela"): the app asks for a first name after the first sign-in. We only forget
  // the old account's saved name if someone else signs in on this device.
  // Idempotent, so it is safe to run more than once.
  const started = useMemo(() => {
    if (!authenticated || !address) return null;
    if (localStorage.getItem(KEY_OWNER) !== address) {
      // A different account on this device: forget the old name; the app asks for a first name next.
      localStorage.removeItem(KEY_PROFILE);
      localStorage.removeItem(KEY_NAME);
      localStorage.setItem(KEY_OWNER, address);
    }
    return address;
  }, [authenticated, address]);

  // Rebuild the signer only when the account changes, not on every wallets refresh (avoids reconnects).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const signer = useMemo(() => (wallet ? new PrivySignerAdapter(wallet, signRef) : undefined), [address]);
  const signOut = useCallback(async () => {
    localStorage.removeItem(KEY_NAME);
    localStorage.removeItem(KEY_PROFILE);
    localStorage.removeItem(KEY_OWNER);
    await logout();
  }, [logout]);
  const value = useMemo(() => ({ kind: "privy" as const, signer, signOut }), [signer, signOut]);

  if (!ready) {
    // Never switch to a hidden device-only account: money put there would not be in the person's real account.
    if (gaveUp) return <Problem text="We can't reach sign-in right now." onRetry={() => location.reload()} />;
    return <Splash />;
  }
  if (!authenticated) {
    return (
      <AuthShell>
        <Onboarding
          onDone={() => {}}
          signIn={{
            error,
            onEmail: () => { setError(""); login({ loginMethods: ["email"] }); },
          }}
        />
      </AuthShell>
    );
  }
  if (setupError) {
    return <Problem text="We couldn't finish setting up your account." onRetry={retrySetup} onSignOut={() => void signOut()} />;
  }
  if (!signer || started !== address) return <Splash text="Setting up your account" />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Problem({ text, onRetry, onSignOut }: { text: string; onRetry: () => void; onSignOut?: () => void }) {
  return (
    <AuthShell>
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-lg">{text}</p>
        <button onClick={onRetry} className="btn btn-primary w-full">Try again</button>
        {onSignOut && <button onClick={onSignOut} className="btn btn-quiet w-full">Sign out</button>}
        <a href="/demo" className="min-h-11 text-sm text-muted underline">Try the demo meanwhile</a>
      </div>
    </AuthShell>
  );
}
