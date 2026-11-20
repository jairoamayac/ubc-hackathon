"use client";

// The one welcome screen (design/kept-v5 01-login-v2), shared by the live app and the demo so both start
// the same way: "Get started" signs in to your own account, "Try the demo" opens the offline walkthrough.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TAGLINE } from "@/lib/brand";
import { Icon3D, Wordmark } from "./demo/parts";

export function WelcomeHero({ onStart, startLabel = "Get started", demoHref = "/demo" }: { onStart: () => void; startLabel?: string; demoHref?: string | null }) {
  return (
    <div className="enter relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-lilac px-6 pb-6 pt-6 text-deep sm:min-h-[860px]">
      <span aria-hidden className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/20" />
      <span aria-hidden className="absolute -left-28 top-[58%] h-64 w-64 rounded-full bg-white/15" />
      <header className="relative flex items-center justify-between">
        <Wordmark />
      </header>
      <div className="relative mt-8">
        <h1 className="leading-[0.95] tracking-tight">
          <span className="outline-title block whitespace-nowrap text-[39px] font-extrabold uppercase tracking-[-0.03em]">Put something</span>
          <span className="block text-[52px] font-bold">on the line.</span>
        </h1>
        <p className="mt-4 max-w-[330px] text-[17px] leading-snug">{TAGLINE} Set a goal with friends. Your money is locked until the promise is kept.</p>
      </div>
      <div className="relative mx-auto mt-2 h-[340px] w-full max-w-[360px] flex-1" aria-hidden>
        <span className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 blur-2xl" />
        <Icon3D name="calendar" size={92} className="float-slow absolute left-0 top-6" />
        <Icon3D name="chat-check" size={100} className="float absolute right-0 top-2" />
        <Icon3D name="padlock-key" size={250} className="float absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        <Icon3D name="friends" size={96} className="float absolute bottom-6 left-3" />
        <Icon3D name="coins-stack" size={104} className="float-slow absolute bottom-10 right-0" />
        <span className="absolute left-[64%] top-4 h-5 w-5 rounded-full bg-white/80" />
        <span className="absolute bottom-4 left-[40%] h-6 w-6 rounded-full bg-mandarina" />
      </div>
      <div className="relative mt-auto flex items-center justify-between gap-3">
        <button onClick={onStart} className="btn btn-white min-h-[64px] gap-4 pl-7 pr-3 text-[18px]">
          {startLabel} <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mandarina text-ink"><ArrowRight className="h-5 w-5" aria-hidden /></span>
        </button>
        {demoHref && <Link href={demoHref} className="flex min-h-11 items-center text-[16px] font-medium underline underline-offset-4">Try the demo</Link>}
      </div>
    </div>
  );
}
