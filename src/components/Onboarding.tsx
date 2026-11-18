"use client";

import { ArrowRight, Lock, Sparkles, Users } from "lucide-react";
import { useState } from "react";

const slides = [
  {
    icon: <Lock className="h-8 w-8" strokeWidth={2.2} />,
    title: "Save like a grown‑up.",
    body: "Your money sits in your Vault and earns interest every week. It only leaves when you take it out.",
  },
  {
    icon: <Sparkles className="h-8 w-8" strokeWidth={2.2} />,
    title: "Play with house money.",
    body: "Only the interest your savings pay you can be played. Is SOL going up or down this week?",
  },
  {
    icon: <Users className="h-8 w-8" strokeWidth={2.2} />,
    title: "Keep the streak with friends.",
    body: "Weekly leagues and streaks. Worst case, you lose that week's interest. Never your savings.",
  },
];

export function Onboarding({ onDone }: { onDone: (email: string) => void }) {
  const [i, setI] = useState(0);
  const [email, setEmail] = useState("");
  const last = i === slides.length;

  return (
    <div className="enter flex min-h-full flex-1 flex-col px-6 pb-8 pt-6">
      <div className="flex items-center gap-3">
        <div className="bar flex-1">
          <span style={{ width: `${((i + 1) / (slides.length + 1)) * 100}%` }} />
        </div>
        {!last && (
          <button onClick={() => setI(slides.length)} className="text-sm font-bold text-muted">
            Skip
          </button>
        )}
      </div>

      {!last ? (
        <div key={i} className="enter flex flex-1 flex-col justify-center gap-6">
          <div className="sun sun-hero flex h-56 w-full items-start justify-center rounded-[32px] bg-ink pt-12 text-paper">{slides[i].icon}</div>
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight">{slides[i].title}</h1>
          <p className="text-lg font-semibold leading-snug text-muted">{slides[i].body}</p>
        </div>
      ) : (
        <form
          className="enter flex flex-1 flex-col justify-center gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            onDone(email || "ana@college.edu");
          }}
        >
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight">Open your Vault.</h1>
          <p className="text-lg font-semibold text-muted">Just your email. No passwords, no wallets, no jargon.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
            className="card w-full px-4 py-4 text-lg font-bold outline-none ring-ember placeholder:text-muted/60 focus:ring-2"
            aria-label="Email"
          />
          <button type="submit" className="btn btn-primary w-full py-4 text-lg">
            Continue with email <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      )}

      {!last && (
        <button onClick={() => setI(i + 1)} className="btn btn-primary mt-6 w-full py-4 text-lg">
          {i === 0 ? "Get started" : "Continue"} <ArrowRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
