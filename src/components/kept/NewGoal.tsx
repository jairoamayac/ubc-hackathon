"use client";

// New goal wizard (design/kept-v5 03a-c): what, when and how, how much. Starts a round in the group, or joins
// an open one (then the deadline is the round's). Money comes from your balance; if the group doesn't hold
// enough of your free money yet, the missing part moves in first, in the same tap.
import { Check, Dumbbell, BookOpen, Smartphone, Repeat, Users, MoreHorizontal, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ChallengeView, CrewView } from "@/lib/house-money/solana/live";
import { FEE_PERCENT, KEEPERS_PERCENT, PROJECT_NAME, STAKE_SUGGESTED_MIN, STAKE_WARN_MULTIPLE } from "@/lib/brand";
import { coachGoal } from "@/lib/coach";
import { GrokCoach } from "../GrokCoach";
import { usd } from "@/lib/format";
import { StakePicker } from "../StakePicker";
import { dateLabel, Header, Icon3D, LockedPill, Page, Steps } from "./ui";
import { roundTitle } from "./model";

const CATEGORIES: { id: string; label: string; tone: string; icon: ReactNode; idea: string }[] = [
  { id: "fitness", label: "Fitness", tone: "bg-fit", icon: <Dumbbell className="h-4 w-4" aria-hidden />, idea: "Run 21 km by Sunday" },
  { id: "study", label: "Study", tone: "bg-sky", icon: <BookOpen className="h-4 w-4" aria-hidden />, idea: "Study 10 hours this week" },
  { id: "screen", label: "Screen time", tone: "bg-lilac-pastel", icon: <Smartphone className="h-4 w-4" aria-hidden />, idea: "Under 2 hours of screen time a day" },
  { id: "habits", label: "Habits", tone: "bg-butter", icon: <Repeat className="h-4 w-4" aria-hidden />, idea: "In bed before midnight, 7 nights" },
  { id: "followers", label: "Followers", tone: "bg-peach", icon: <Users className="h-4 w-4" aria-hidden />, idea: "Post 3 videos this week" },
  { id: "other", label: "Other", tone: "bg-stone2", icon: <MoreHorizontal className="h-4 w-4" aria-hidden />, idea: "" },
];
const DURATIONS: [string, number][] = [["2 min (test)", 2], ["1 hour", 60], ["Tonight", 360], ["1 day", 1440], ["3 days", 4320], ["1 week", 10080]];

export type LockInput = { crew: CrewView; goal: string; stake: number; minutes: number; minStake: number };

export function NewGoal({ groups, crew, join, cash, now, busy, freeIn, onPickGroup, onBack, onAddFunds, onLock }: {
  groups: CrewView[]; crew?: CrewView; join?: ChallengeView; cash: number; now: number; busy: string | null;
  freeIn: (c: CrewView) => number; onPickGroup: (k: string) => void; onBack: () => void; onAddFunds: () => void;
  onLock: (v: LockInput) => Promise<boolean>;
}) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("");
  const [cat, setCat] = useState("fitness");
  const [coach, setCoach] = useState<ReturnType<typeof coachGoal> | null>(null);
  const [minutes, setMinutes] = useState(10080);
  const min = join ? join.stakeUsd : 1;
  const suggested = Math.max(min, coach?.stake ?? STAKE_SUGGESTED_MIN);
  const [stake, setStake] = useState(Math.max(min, STAKE_SUGGESTED_MIN));
  const [minStake, setMinStake] = useState(5);
  const [sure, setSure] = useState(false);

  if (!crew) {
    return <Page><Header title="New goal" onBack={onBack} /><p className="text-muted">Create or join a group first.</p></Page>;
  }
  const available = cash + freeIn(crew);
  const tooMuch = stake > available + 1e-9;
  const veryHigh = stake > suggested * STAKE_WARN_MULTIPLE;
  const endsAt = join ? join.challenge.endsAt : now + minutes * 60;
  const back = () => (step === 1 ? onBack() : setStep(step - 1));

  const askGrok = () => {
    const c = coachGoal(goal);
    setCoach(c);
    if (c.measurable) setStake((s) => (s < c.stake ? Math.max(min, c.stake) : s));
  };

  return (
    <Page className="pb-8">
      <Header title={join ? "Join the round" : "New goal"} onBack={back} right={<span className="text-sm text-muted">{step}/3</span>} />
      <Steps step={step} of={3} />

      {step === 1 && (
        <>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">What do you want to do?</h1>
          {join && <p className="-mt-2 text-sm text-muted">Round in {crew.name}: {roundTitle(join)}</p>}
          <label className="block">
            <span className="sr-only">Your goal</span>
            <input value={goal} autoFocus onChange={(e) => { setGoal(e.target.value.slice(0, 80)); setCoach(null); }} placeholder="I want to run more"
              className="w-full rounded-2xl border-[1.5px] border-ink bg-white px-4 py-4 text-lg outline-none placeholder:text-muted/70" />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Category</legend>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button type="button" key={c.id} aria-pressed={cat === c.id}
                  onClick={() => { setCat(c.id); if (!goal.trim() && c.idea) setGoal(c.idea); }}
                  className={`relative flex h-[76px] flex-col items-start justify-between rounded-[18px] p-2.5 text-left text-sm font-medium ${c.tone} ${cat === c.id ? "ring-2 ring-ink" : ""}`}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70">{c.icon}</span>
                  {c.label}
                  {cat === c.id && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"><Check className="h-3 w-3" aria-hidden /></span>}
                </button>
              ))}
            </div>
          </fieldset>
          <section className="rounded-[24px] bg-ink p-5 text-white" aria-labelledby="coach">
            <p id="coach" className="flex items-center gap-2 text-xs text-[#C9CCC4]"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Instant coach</p>
            {!coach ? (
              <>
                <p className="mt-2 text-sm text-[#C9CCC4]">Make it measurable, so your friends can tell if you kept it.</p>
                <button type="button" onClick={askGrok} disabled={!goal.trim()} className="btn mt-3 min-h-11 w-full bg-lilac text-violet-deep">Make it measurable</button>
              </>
            ) : coach.measurable ? (
              <>
                <p className="mt-2 text-xl font-medium">{coach.goal}</p>
                <p className="mt-1 text-sm text-[#C9CCC4]">Proof: {coach.proof.toLowerCase()}. Most people start with {usd(coach.stake)}.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setGoal(coach.goal.slice(0, 80)); setCoach(null); }} className="btn min-h-11 bg-lilac text-violet-deep">Use this</button>
                  <button type="button" onClick={() => setCoach(null)} className="btn min-h-11 border border-white/40 text-white">Edit</button>
                </div>
              </>
            ) : (
              <p role="status" className="mt-2 text-sm">{coach.note}</p>
            )}
          </section>
          <GrokCoach goal={goal} onUse={(r) => {
            setGoal(r.goal.slice(0, 80));
            setCoach(null);
            if (r.suggested_stake_usd !== null) setStake(Math.max(min, r.suggested_stake_usd));
            setSure(false);
          }} />
          {!join && groups.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-sm text-muted">Group</legend>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => <button type="button" key={g.address.toBase58()} aria-pressed={g.address.equals(crew.address)} onClick={() => onPickGroup(g.address.toBase58())} className="tile min-h-11 rounded-full px-4 text-sm">{g.name}</button>)}
              </div>
            </fieldset>
          )}
          <button onClick={() => setStep(2)} disabled={!goal.trim()} className="btn btn-primary w-full">Continue</button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">When and how?</h1>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Deadline</legend>
            {join ? (
              <p className="card px-4 py-4">{dateLabel(endsAt)} <span className="text-sm text-muted">· set by the round</span></p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map(([label, m]) => <button type="button" key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className="tile min-h-11 px-1 py-2 text-sm">{label}</button>)}
                </div>
                <p className="mt-2 text-sm text-muted">Ends {dateLabel(endsAt)}</p>
              </>
            )}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm text-muted">How will it be checked?</legend>
            <Method title="Friends vote" sub="Your group approves or disputes after the deadline" on />
            <Method title="Photo proof" sub="Upload a photo or screenshot" soon />
            <Method title="Strava" sub="Proof comes in by itself" soon />
            <Method title="Screen Time" sub="Proof comes in by itself" soon />
          </fieldset>
          <button onClick={() => setStep(3)} className="btn btn-primary w-full">Continue</button>
        </>
      )}

      {step === 3 && (
        <form className="flex flex-col gap-4" onSubmit={async (e) => {
          e.preventDefault();
          if (tooMuch || busy || (veryHigh && !sure)) return;
          await onLock({ crew, goal: goal.trim(), stake, minutes, minStake: Math.min(minStake, stake) });
        }}>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">How much is on the line?</h1>
          <StakePicker value={stake} onChange={(v) => { setStake(v); setSure(false); }} min={min} max={Math.floor(available)} suggested={suggested} />
          {veryHigh && !tooMuch && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-5 w-5 accent-[#2E2260]" />
              <span>Yes, I want to lock {usd(stake)}. I understand I lose it if I miss.</span>
            </label>
          )}
          {!join && (
            <fieldset>
              <legend className="mb-2 text-sm text-muted">Friends join with at least</legend>
              <div className="grid grid-cols-4 gap-2">
                {[1, 5, 10, 50].map((v) => <button type="button" key={v} onClick={() => setMinStake(v)} aria-pressed={minStake === v} className="tile min-h-11 text-sm">${v}</button>)}
              </div>
            </fieldset>
          )}
          <section className="hero-lilac p-5" aria-live="polite">
            <span className="pointer-events-none absolute -right-1 -top-1"><Icon3D name="padlock-key" size={80} glow /></span>
            <p className="text-sm">Summary</p>
            <p className="mt-1 max-w-[75%] text-xl font-medium leading-tight">{goal.trim()}</p>
            <p className="mt-1 text-sm">Ends {dateLabel(endsAt)}</p>
            <p className="mt-3 flex items-center gap-3"><span className="num text-[40px] leading-none">{usd(stake)}</span><LockedPill /></p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Keep it and your {usd(stake)} comes back. Missed stakes are split with friends who kept theirs.</li>
              <li className="flex gap-2"><span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-center leading-4">×</span> Miss it: {KEEPERS_PERCENT}% goes to friends who kept theirs, {FEE_PERCENT}% to {PROJECT_NAME}.</li>
            </ul>
          </section>
          <p className="text-center text-sm text-muted">Paid from your balance · {usd(available)}</p>
          {tooMuch ? (
            <button type="button" onClick={onAddFunds} className="btn btn-primary w-full">Add funds first</button>
          ) : (
            <button type="submit" disabled={!!busy || (veryHigh && !sure)} className="btn btn-primary w-full">{busy === "lock" ? "Locking" : "Lock it in"}</button>
          )}
          <p className="text-center text-xs text-muted">Locked by code, not held by us.</p>
        </form>
      )}
    </Page>
  );
}

function Method({ title, sub, on, soon }: { title: string; sub: string; on?: boolean; soon?: boolean }) {
  return (
    <div className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl px-4 py-3 ${on ? "border-2 border-violet-deep bg-lilac-tint" : "bg-stone2"}`}>
      <span><span className={`block font-medium ${soon ? "text-muted" : ""}`}>{title}</span><span className="block text-sm text-muted">{sub}</span></span>
      {on ? <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-deep text-white" aria-label="Included"><Check className="h-4 w-4" aria-hidden /></span>
        : soon ? <span className="pill pill-soon">Coming soon</span> : null}
    </div>
  );
}
