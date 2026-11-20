"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FEE_PERCENT, KEEPERS_PERCENT, PROJECT_NAME, TAGLINE } from "@/lib/brand";

const slides = [
  {
    title: "Say it once. It stays said.",
    body: "Most goals fail quietly, because walking away costs nothing. Here, you put money on your own goal, and it stays locked until you keep your word.",
  },
  {
    title: "Your friends are the witnesses.",
    body: "Start a pact with your friends. Each person locks money on their own goal. When time is up, the people who put money in confirm who kept their word.",
  },
  {
    title: "Keep it, and get it back.",
    body: `Keep your word and your money comes back, plus a share of what was left behind. Walk away and you lose it: ${KEEPERS_PERCENT}% goes to the friends who kept theirs, ${FEE_PERCENT}% to us.`,
  },
];

export function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
  const last = i === slides.length;

  return (
    <div className="enter flex min-h-full flex-1 flex-col px-6 pb-8 pt-6">
      <div className="flex items-center gap-3">
        <div className="bar flex-1" role="progressbar" aria-label="Introduction progress" aria-valuemin={1} aria-valuemax={slides.length + 1} aria-valuenow={i + 1}>
          <span style={{ width: `${((i + 1) / (slides.length + 1)) * 100}%` }} />
        </div>
        {!last && (
          <button onClick={() => setI(slides.length)} className="min-h-11 px-2 text-sm text-muted">
            Skip
          </button>
        )}
      </div>

      {!last ? (
        <div key={i} className="enter flex flex-1 flex-col justify-center gap-6">
          <p className="flex items-center gap-2 text-base font-medium">
            <span className="dot" aria-hidden /> {PROJECT_NAME}
          </p>
          <h1 className="text-[34px] font-medium leading-[1.1] tracking-tight">{slides[i].title}</h1>
          <p className="text-lg leading-relaxed text-muted">{slides[i].body}</p>
          {i === 0 && <p className="text-sm text-muted">{TAGLINE}</p>}
        </div>
      ) : (
        <form
          className="enter flex flex-1 flex-col justify-center gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onDone(name.trim());
          }}
        >
          <h1 className="text-[34px] font-medium leading-[1.1] tracking-tight">What should your friends call you?</h1>
          <p className="text-lg text-muted">No password to remember. Your account is ready in a second.</p>
          <label className="block">
            <span className="sr-only">First name</span>
            <input
              value={name}
              maxLength={20}
              autoComplete="given-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              className="card w-full px-4 py-4 text-lg outline-none placeholder:text-muted/70 focus:border-forest"
            />
          </label>
          <button type="submit" disabled={!name.trim()} className="btn btn-primary w-full py-4 text-lg">
            Continue <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        </form>
      )}

      {!last && (
        <button onClick={() => setI(i + 1)} className="btn btn-primary mt-6 w-full py-4 text-lg">
          {i === 0 ? "Get started" : "Next"} <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      )}
      {i === 0 && (
        <Link href="/demo" className="mt-3 flex min-h-11 items-center justify-center text-sm text-forest underline">
          See the whole story in 75 seconds
        </Link>
      )}
    </div>
  );
}
