"use client";

import { ArrowRight, Flame, Lock, Users } from "lucide-react";
import { useState } from "react";

const slides = [
  {
    icon: <Users className="h-8 w-8" strokeWidth={2.2} />,
    title: "Save with your crew.",
    body: "Add money with Apple Pay and send it to a crew: your roommates, your team, your group chat. Together it grows every day.",
  },
  {
    icon: <Flame className="h-8 w-8" strokeWidth={2.2} />,
    title: "See who's growing.",
    body: "Every crew is ranked live. Watch the trending ones, join them, or beat them.",
  },
  {
    icon: <Lock className="h-8 w-8" strokeWidth={2.2} />,
    title: "Your savings never move.",
    body: "Feeling tryhard? Play only what your crew earned on a weekly call. Worst case, you lose those earnings. Never your savings.",
  },
];

export function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
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
            onDone(name.trim() || "Ana");
          }}
        >
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight">What should your crew call you?</h1>
          <p className="text-lg font-semibold text-muted">No passwords, no wallets, no jargon. Your account is ready in a second.</p>
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className="card w-full px-4 py-4 text-lg font-bold outline-none ring-ember placeholder:text-muted/60 focus:ring-2"
            aria-label="First name"
          />
          <button type="submit" className="btn btn-primary w-full py-4 text-lg">
            Open my account <ArrowRight className="h-5 w-5" />
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
