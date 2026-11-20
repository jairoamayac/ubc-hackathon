"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { AuthContext, PRIVY_APP_ID } from "./AuthContext";
import { Splash } from "./Splash";

// Privy is only bundled when an app id is set at build time. Without it the app runs the demo sign-in.
const PrivyGate = PRIVY_APP_ID
  ? dynamic(() => import("./PrivyGate"), { ssr: false, loading: () => <Splash /> })
  : null;

const LOCAL = { kind: "local" } as const;

export function AuthGate({ children }: { children: ReactNode }) {
  if (!PrivyGate) return <AuthContext.Provider value={LOCAL}>{children}</AuthContext.Provider>;
  return <PrivyGate>{children}</PrivyGate>;
}
