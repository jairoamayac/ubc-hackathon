"use client";

// Who is signed in. Two modes, chosen at build time by NEXT_PUBLIC_PRIVY_APP_ID:
//  - "privy": Google or email sign-in, account created and kept by Privy
//  - "local": the old demo (a first name, key kept on this device), used when no Privy app id is set
import { createContext, useContext } from "react";
import type { OwnerSigner } from "@/lib/house-money/solana/signer";

export interface Auth {
  kind: "privy" | "local";
  /** The account that signs. Undefined in local mode: LiveClient then uses the key kept on this device. */
  signer?: OwnerSigner;
  signOut?: () => Promise<void>;
}

export const AuthContext = createContext<Auth>({ kind: "local" });
export const useAuth = () => useContext(AuthContext);

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const PRIVY_CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? "";
