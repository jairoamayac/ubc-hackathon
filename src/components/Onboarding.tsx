"use client";

// First open (design/kept-v5 01-login-v2): lilac hero with the 3D padlock, then the name step.
// There is no password: the account key is created on this device.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FEE_PERCENT, KEEPERS_PERCENT } from "@/lib/brand";
import { Icon3D } from "./kept/ui";

/** When set (Privy), the last step signs in with Google or email instead of asking for a first name. */
export interface SignInOptions { onGoogle: () => void; onEmail: () => void; error?: string }

export function Onboarding({ onDone, signIn }: { onDone: (name: string) => void; signIn?: SignInOptions }) {
  const [step, setStep] = useState<"hero" | "name">("hero");
  const [name, setName] = useState("");

  if (step === "hero") {
    return (
      <div className="enter relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-lilac px-6 pb-8 pt-6 text-violet-deep sm:min-h-[860px]">
        <div className="flex justify-end">
          <button onClick={() => setStep("name")} className="min-h-11 px-2 text-sm font-medium">Skip</button>
        </div>
        <h1 className="mt-4 leading-[0.95] tracking-tight">
          <span className="block text-[36px] font-extrabold uppercase text-transparent [-webkit-text-stroke:1.5px_#2E2260]">Put something</span>
          <span className="block text-[48px] font-bold">on the line.</span>
        </h1>
        <p className="mt-4 max-w-[300px] text-base">Set a goal with friends. Your money is locked until the promise is kept.</p>
        <div className="flex flex-1 items-center justify-center py-6">
          <Icon3D name="padlock-key" size={220} glow />
        </div>
        <p className="mb-4 text-sm">Keep it and your money comes back. Miss it and {KEEPERS_PERCENT}% goes to the friends who kept theirs, {FEE_PERCENT}% to us.</p>
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setStep("name")} className="btn btn-white min-h-14 gap-3 pl-6 pr-2 text-ink">
            Get started <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mand"><ArrowRight className="h-5 w-5" aria-hidden /></span>
          </button>
          <Link href="/demo" className="flex min-h-11 items-center text-sm font-medium underline">See the demo</Link>
        </div>
      </div>
    );
  }

  if (signIn) {
    return (
      <div className="enter flex flex-1 flex-col justify-center gap-5 px-6 pb-8 pt-6">
        <div className="flex justify-center"><Icon3D name="friends" size={120} /></div>
        <h1 className="text-[30px] font-medium leading-[1.1] tracking-tight">Sign in to start</h1>
        <p className="text-lg text-muted">No password to remember. Your account is ready in a second.</p>
        <button type="button" onClick={signIn.onGoogle} className="btn btn-primary w-full">Continue with Google</button>
        <button type="button" onClick={signIn.onEmail} className="btn btn-quiet w-full">Continue with email</button>
        {signIn.error && <p role="alert" className="text-sm text-danger">{signIn.error}</p>}
        <button type="button" onClick={() => setStep("hero")} className="min-h-11 text-sm text-muted">Back</button>
      </div>
    );
  }

  return (
    <form
      className="enter flex flex-1 flex-col justify-center gap-5 px-6 pb-8 pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onDone(name.trim());
      }}
    >
      <div className="flex justify-center"><Icon3D name="friends" size={120} /></div>
      <h1 className="text-[30px] font-medium leading-[1.1] tracking-tight">What should your friends call you?</h1>
      <p className="text-lg text-muted">No password to remember. Your account is ready in a second.</p>
      <label className="block">
        <span className="sr-only">First name</span>
        <input value={name} maxLength={20} autoComplete="given-name" autoFocus onChange={(e) => setName(e.target.value)} placeholder="Your first name"
          className="w-full rounded-2xl border-[1.5px] border-ink bg-white px-4 py-4 text-lg outline-none placeholder:text-muted/70" />
      </label>
      <button type="submit" disabled={!name.trim()} className="btn btn-primary w-full">
        Continue <ArrowRight className="h-5 w-5" aria-hidden />
      </button>
      <button type="button" onClick={() => setStep("hero")} className="min-h-11 text-sm text-muted">Back</button>
    </form>
  );
}
