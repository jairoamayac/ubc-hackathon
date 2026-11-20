"use client";

// Sign-in with Privy: Google or email (one-time code). Privy creates the person's Solana account on
// first sign-in; the app never shows it. Docs used:
//  - Setup / PrivyProvider: https://docs.privy.io/basics/react/setup
//  - Automatic account creation: https://docs.privy.io/basics/react/advanced/automatic-wallet-creation
//  - Solana networks: https://docs.privy.io/basics/react/advanced/configuring-solana-networks
//  - Sign a transaction (useSignTransaction, useWallets from "@privy-io/react-auth/solana"):
//    https://docs.privy.io/wallets/using-wallets/solana/sign-a-transaction
//  - Create a wallet (useCreateWallet): https://docs.privy.io/wallets/wallets/create/create-a-wallet
import { PrivyProvider, usePrivy, type User } from "@privy-io/react-auth";
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
    const { signedTransaction } = await this.signRef.current({
      transaction,
      wallet: this.wallet,
      chain: "solana:devnet",
      options: { uiOptions: { showWalletUIs: false } }, // no confirmation pop-up: one tap in our own UI
    });
    tx.addSignature(this.publicKey, ownerSignatureFrom(signedTransaction, tx, this.publicKey));
  }
}

export default function PrivyGate({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID || undefined}
      config={{
        loginMethods: ["google", "email"],
        appearance: { theme: "light", accentColor: "#2e2260", walletChainType: "solana-only", showWalletLoginFirst: false },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
      }}
    >
      <Session>{children}</Session>
    </PrivyProvider>
  );
}

const PRIVY_START_TIMEOUT_MS = 10_000;
const KEY_NAME = "hm.name";
const KEY_PROFILE = "hm.profile"; // the name last saved for this account
const KEY_OWNER = "hm.owner"; // which account hm.name / hm.profile belong to

function displayName(user: User | null): string {
  const raw = user?.google?.name || user?.email?.address?.split("@")[0] || user?.google?.email?.split("@")[0] || "";
  const first = raw.trim().split(/\s+/)[0] ?? "";
  return (first || "Friend").slice(0, 20);
}

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

  // createOnLogin covers new sign-ins; this covers anyone who is signed in but has no account yet.
  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || wallet || creating.current) return;
    creating.current = true;
    createWallet().catch(() => setError("We couldn't finish setting up your account. Please try again.")).finally(() => {
      creating.current = false;
    });
  }, [ready, authenticated, walletsReady, wallet, createWallet]);

  // The rest of the app reads the name from localStorage ("hm.name"); fill it from Google or email once
  // per account, and forget the old account's saved name if someone else signs in on this device.
  // Idempotent, so it is safe to run more than once.
  const started = useMemo(() => {
    if (!authenticated || !address) return null;
    if (localStorage.getItem(KEY_OWNER) !== address) {
      localStorage.removeItem(KEY_PROFILE);
      localStorage.setItem(KEY_OWNER, address);
      localStorage.setItem(KEY_NAME, displayName(user));
    } else if (!localStorage.getItem(KEY_NAME)) {
      localStorage.setItem(KEY_NAME, displayName(user));
    }
    return address;
  }, [authenticated, address, user]);

  const signer = useMemo(() => (wallet ? new PrivySignerAdapter(wallet, signRef) : undefined), [wallet]);
  const signOut = useCallback(async () => {
    localStorage.removeItem(KEY_NAME);
    localStorage.removeItem(KEY_PROFILE);
    localStorage.removeItem(KEY_OWNER);
    await logout();
  }, [logout]);
  const value = useMemo(() => ({ kind: "privy" as const, signer, signOut }), [signer, signOut]);

  if (!ready) {
    if (gaveUp) return <AuthContext.Provider value={{ kind: "local" }}>{children}</AuthContext.Provider>;
    return <Splash />;
  }
  if (!authenticated) {
    return (
      <AuthShell>
        <Onboarding
          onDone={() => {}}
          signIn={{
            error,
            onGoogle: () => { setError(""); login({ loginMethods: ["google"] }); },
            onEmail: () => { setError(""); login({ loginMethods: ["email"] }); },
          }}
        />
      </AuthShell>
    );
  }
  if (!signer || started !== address) return <Splash text="Setting up your account" />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
