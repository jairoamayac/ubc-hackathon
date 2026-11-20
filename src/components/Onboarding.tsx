"use client";

// First open (design/kept-v5 01-login-v2): lilac hero with the 3D padlock, then the name step.
// There is no password: the account key is created on this device.
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Icon3D } from "./kept/ui";
import { WelcomeHero } from "./Welcome";

/** When set (Privy), the last step signs in with email instead of asking for a first name. */
export interface SignInOptions { onEmail: () => void; error?: string }

/** `nameOnly`: signed in already (Privy), so skip the welcome and just ask for the first name. */
export function Onboarding({ onDone, signIn, nameOnly }: { onDone: (name: string) => void; signIn?: SignInOptions; nameOnly?: boolean }) {
  const [step, setStep] = useState<"hero" | "name">(nameOnly ? "name" : "hero");
  const [name, setName] = useState("");

  if (step === "hero") return <WelcomeHero onStart={() => setStep("name")} />;

  if (signIn) {
    return (
      <div className="enter flex flex-1 flex-col justify-center gap-5 px-6 pb-8 pt-6">
        <div className="flex justify-center"><Icon3D name="friends" size={120} /></div>
        <h1 className="text-[30px] font-medium leading-[1.1] tracking-tight">Sign in to start</h1>
        <p className="text-lg text-muted">No password to remember. Your account is ready in a second.</p>
        <button type="button" onClick={signIn.onEmail} className="btn btn-primary w-full">Continue with email</button>
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
      <p className="text-lg text-muted">{nameOnly ? "This is the name your group sees." : "No password to remember. Your account is ready in a second."}</p>
      <label className="block">
        <span className="sr-only">First name</span>
        <input value={name} maxLength={20} autoComplete="given-name" autoFocus onChange={(e) => setName(e.target.value)} placeholder="Your first name"
          className="w-full rounded-2xl border-[1.5px] border-ink bg-white px-4 py-4 text-lg outline-none placeholder:text-muted/70" />
      </label>
      <button type="submit" disabled={!name.trim()} className="btn btn-primary w-full">
        Continue <ArrowRight className="h-5 w-5" aria-hidden />
      </button>
      {!nameOnly && <button type="button" onClick={() => setStep("hero")} className="min-h-11 text-sm text-muted">Back</button>}
    </form>
  );
}
