"use client";

// Demo screens, part 1: login, home, new goal wizard, group.
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Check, ChevronRight, Dumbbell, Link2, Loader2, Lock, Plus, Repeat, Sparkles, X } from "lucide-react";
import { useState, type Dispatch, type ReactNode } from "react";
import { FEE_PERCENT, KEEPERS_PERCENT, PROJECT_NAME, STAKE_SUGGESTED_MIN, STAKE_WARN_MULTIPLE, TAGLINE } from "@/lib/brand";
import { coachGoal, type Coaching } from "@/lib/coach";
import { GROUP_NAME, onTheLine, pot, type Action, type DemoState } from "@/lib/demo/store";
import { StakePicker } from "../StakePicker";
import { usd } from "@/lib/format";
import { Avatar, DemoBadge, Icon3D, LockAnimation, LockedPill, PASTEL, ScreenBody, StatusChip, TopBar, UrgencyBanner, Wordmark, timeLeft } from "./parts";

export type Route = "login" | "home" | "new" | "group" | "goal" | "feed" | "vote" | "dispute" | "results" | "me";
export type ScreenProps = { s: DemoState; d: Dispatch<Action>; go: (r: Route) => void };

// -------------------------------------------------------------------- 1 login
export function LoginScreen({ d, go }: Pick<ScreenProps, "d" | "go">) {
  const [step, setStep] = useState<"hero" | "email">("hero");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const submit = (value = email) => {
    if (!value.includes("@") || sending) return;
    setSending(true);
    setTimeout(() => {
      d({ type: "signIn", email: value });
      go("home");
    }, 900);
  };
  return (
    <div className="enter relative flex flex-1 flex-col overflow-hidden bg-lilac px-6 pb-6 pt-6 text-deep">
      <span aria-hidden className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/20" />
      <span aria-hidden className="absolute -left-28 top-[58%] h-64 w-64 rounded-full bg-white/15" />
      <header className="relative flex items-center justify-between">
        {step === "email" ? (
          <button onClick={() => setStep("hero")} aria-label="Back" className="iconbtn"><ArrowLeft className="h-5 w-5" aria-hidden /></button>
        ) : (
          <Wordmark />
        )}
        <button onClick={() => { setEmail("martin@example.com"); submit("martin@example.com"); }} className="min-h-11 px-1 text-[17px] font-semibold">Skip</button>
      </header>
      <div className="relative mt-8">
        <h1 className="leading-[0.95] tracking-tight">
          <span className="outline-title block whitespace-nowrap text-[39px] font-extrabold uppercase tracking-[-0.03em]">Put something</span>
          <span className="block text-[52px] font-bold">on the line.</span>
        </h1>
        <p className="mt-4 max-w-[330px] text-[17px] leading-snug">{TAGLINE} Set a goal with friends. Your money is locked until the promise is kept.</p>
      </div>

      {step === "hero" ? (
        <>
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
            <button onClick={() => setStep("email")} className="btn btn-white min-h-[64px] gap-4 pl-7 pr-3 text-[18px]">
              Get started <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mandarina text-ink"><ArrowRight className="h-5 w-5" aria-hidden /></span>
            </button>
            <button onClick={() => setStep("email")} className="min-h-11 text-[16px] font-medium underline underline-offset-4">I have an account</button>
          </div>
        </>
      ) : (
        <form className="relative mt-8 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="flex justify-center" aria-hidden><Icon3D name="padlock-key" size={150} className="float" /></div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Your email</span>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="martin@example.com"
              className="h-14 w-full rounded-2xl bg-white px-4 text-lg text-ink shadow-[0_10px_24px_rgba(46,34,96,0.16)] outline-none placeholder:text-muted/70"
            />
          </label>
          <button type="submit" disabled={!email.includes("@") || sending} className="btn btn-primary w-full py-4 text-lg">
            {sending ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Sending your link</> : "Continue with email"}
          </button>
          <p className="text-sm">No password to remember. <DemoBadge>Demo</DemoBadge> No email is sent.</p>
          <button type="button" onClick={() => setEmail("martin@example.com")} className="min-h-11 text-sm font-medium underline underline-offset-4">Use the demo email</button>
        </form>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- 2 home
export function HomeScreen({ s, go }: Pick<ScreenProps, "s" | "go">) {
  const me = s.people.find((p) => p.id === "martin")!;
  const hasGoal = me.stake > 0;
  const joined = s.people.filter((p) => p.stake > 0).length;
  const progress = Math.round(((72 - s.hoursLeft) / 72) * 100);
  const pct = s.stage === "ended" ? 100 : Math.max(4, progress);
  const first = (s.email.split("@")[0] || "Martin").replace(/^./, (c) => c.toUpperCase());
  return (
    <ScreenBody>
      <header className="flex items-center justify-between">
        <Wordmark />
        <Avatar id="martin" size={48} />
      </header>
      <h1 className="-mt-1 text-[32px] font-medium tracking-tight">Hi, {first}</h1>
      <div className="grid grid-cols-[1.15fr_1fr] gap-3">
        <section className="surface-ink p-4" aria-label="Free balance">
          <p className="text-sm text-white/75">Balance</p>
          <p className="big mt-2 text-[34px] text-lilac">{usd(s.balance)}</p>
        </section>
        <section className="pastel bg-peach p-4" aria-label="On the line">
          <p className="text-sm">On the line</p>
          <p className="big mt-2 text-[34px]">{usd(onTheLine(s)).replace(".00", "")}</p>
          <Icon3D name="coins-stack" size={72} className="absolute -right-2 -top-1" />
        </section>
      </div>
      <UrgencyBanner hours={me.status === "on_track" && s.stage === "running" ? s.hoursLeft : 99} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{hasGoal ? "Active goals" : "Your goals"}</h2>
        {s.stage === "empty" && <button onClick={() => go("new")} className="btn btn-primary btn-sm"><Plus className="h-4 w-4" aria-hidden /> New goal</button>}
      </div>
      {hasGoal ? (
        <button onClick={() => go("goal")} className="surface-lilac w-full p-5 text-left" aria-label={`Open goal: ${me.goal}`}>
          <Icon3D name="padlock-key" size={104} className="float absolute -right-1 -top-1" />
          <div className="flex flex-wrap items-center gap-2 pr-20">
            <LockedPill>Locked</LockedPill>
            <StatusChip status={me.status} />
          </div>
          <p className="mt-3 pr-20 text-[22px] font-medium leading-tight tracking-tight">{me.goal}</p>
          <div className="mt-3 flex items-center gap-3">
            <p className="big text-[56px]">{usd(me.stake).replace(".00", "")}</p>
            <span className="pill bg-white text-ink">{timeLeft(s.hoursLeft)}</span>
          </div>
          <div className="mt-4 flex justify-between text-sm"><span>Time used</span><span className="mono">{pct}%</span></div>
          <div className="bar mt-2" aria-hidden><span style={{ width: `${pct}%` }} /></div>
        </button>
      ) : (
        <div className="surface-lilac p-5">
          <Icon3D name="padlock-key" size={104} className="float absolute -right-1 -top-1" />
          <p className="pr-24 text-[22px] font-medium leading-tight">Nothing on the line yet.</p>
          <p className="mt-2 pr-20 text-sm">Pick a goal you could measure, lock money on it, and your friends will keep you honest.</p>
          <button onClick={() => go("new")} className="btn btn-primary mt-5 w-full py-4 text-lg"><Plus className="h-5 w-5" aria-hidden /> New goal</button>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between">
        <h2 className="text-lg font-medium">Groups</h2>
        <span className="text-sm text-muted">1 group</span>
      </div>
      <button onClick={() => go("group")} className="card flex w-full items-center gap-3 p-4 text-left">
        <span className="flex -space-x-2" aria-hidden>{s.people.slice(0, 4).map((p) => <Avatar key={p.id} id={p.id} size={30} />)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{GROUP_NAME}</span>
          <span className="block text-sm text-muted">{joined} of 5 locked in · {usd(pot(s)).replace(".00", "")} pot</span>
        </span>
        <Icon3D name="money-bag" size={44} />
        <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
      </button>
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 3 new goal (wizard)
const CATEGORIES = ["Fitness", "Study", "Habit", "Work"] as const;
const CAT_STYLE: Record<(typeof CATEGORIES)[number], { bg: string; icon: ReactNode }> = {
  Fitness: { bg: "bg-mint", icon: <Dumbbell className="h-4 w-4" aria-hidden /> },
  Study: { bg: "bg-sky", icon: <BookOpen className="h-4 w-4" aria-hidden /> },
  Habit: { bg: "bg-butter", icon: <Repeat className="h-4 w-4" aria-hidden /> },
  Work: { bg: "bg-peach", icon: <Briefcase className="h-4 w-4" aria-hidden /> },
};
const DEADLINES: [string, number][] = [["Tomorrow", 24], ["Sunday", 72], ["1 week", 168]];

export function NewGoalScreen({ s, d, go }: ScreenProps) {
  const [step, setStep] = useState(1);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Fitness");
  const [coach, setCoach] = useState<Coaching | null>(null);
  const [deadline, setDeadline] = useState(72);
  const [verify, setVerify] = useState<"friends" | "photo">("friends");
  const [stake, setStake] = useState(STAKE_SUGGESTED_MIN);
  const [sure, setSure] = useState(false);
  const [locking, setLocking] = useState(false);

  const goal = (coach?.measurable ? coach.goal : text).trim();
  const suggested = coach?.stake ?? STAKE_SUGGESTED_MIN;
  const veryHigh = stake > suggested * STAKE_WARN_MULTIPLE;
  const tooMuch = stake > s.balance;
  const deadlineLabel = DEADLINES.find(([, h]) => h === deadline)?.[0] ?? "Sunday";

  const askGrok = () => {
    const c = coachGoal(text);
    setCoach(c);
    if (c.measurable) {
      setText(c.goal);
      setStake(c.stake);
    }
  };

  if (locking) {
    return (
      <LockAnimation
        onDone={() => {
          d({ type: "lockGoal", goal, stake, coachNote: coach?.note ?? "" });
          go("group");
        }}
      />
    );
  }

  return (
    <ScreenBody>
      <TopBar onBack={() => (step > 1 ? setStep(step - 1) : go("home"))} title="New goal" right={<span className="mono">{step}/3</span>} />
      <div className="steps" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map((i) => <i key={i} data-on={i <= step} />)}</div>

      {step === 1 && (
        <>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">What do you want to get done?</h1>
          <label className="block">
            <span className="sr-only">Your goal</span>
            <input value={text} onChange={(e) => { setText(e.target.value.slice(0, 80)); setCoach(null); }} placeholder="Run 21 km by Sunday" className="h-14 w-full rounded-2xl bg-white px-4 text-lg shadow-[0_10px_28px_rgba(26,26,24,0.08)] outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-deep" />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Category</legend>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={`cat relative flex h-[78px] flex-col items-start justify-between p-2.5 text-sm font-medium ${CAT_STYLE[c].bg}`}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70">{CAT_STYLE[c].icon}</span>
                  {c}
                  {category === c && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"><Check className="h-3 w-3" aria-hidden /></span>}
                </button>
              ))}
            </div>
          </fieldset>
          <section className="surface-ink p-4" aria-label="Grok coach">
            <Icon3D name="chat-check" size={64} className="absolute -right-1 -top-1" />
            <span className="pill bg-white/10 text-lilac"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Grok coach <DemoBadge /></span>
            {coach ? (
              <div role="status" className="mt-3 pr-10 text-sm">
                <p className={`font-medium ${coach.measurable ? "text-white" : "text-butter"}`}>{coach.note}</p>
                {coach.measurable && <p className="mt-1 text-white/75">We count: {coach.metric.toLowerCase()}. Proof: {coach.proof.toLowerCase()}.</p>}
              </div>
            ) : (
              <p className="mt-3 pr-12 text-sm text-white/80">Type a goal and Grok turns it into something your friends can check.</p>
            )}
            <button type="button" onClick={askGrok} disabled={!text.trim()} className="btn btn-sm mt-3 bg-lilac text-deep">
              <Sparkles className="h-4 w-4" aria-hidden /> Make it measurable
            </button>
          </section>
          <div className="mt-auto" />
          <button disabled={!goal || (coach !== null && !coach.measurable)} onClick={() => setStep(2)} className="btn btn-primary w-full py-4 text-lg">Continue</button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">When, and who checks?</h1>
          <fieldset>
            <legend className="mb-2 flex items-center gap-2 text-sm text-muted">Deadline</legend>
            <div className="grid grid-cols-3 gap-2">
              {DEADLINES.map(([label, h]) => <button key={label} type="button" onClick={() => setDeadline(h)} aria-pressed={deadline === h} className="tile min-h-14 py-2 font-medium">{label}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">How it is verified</legend>
            <div className="space-y-2">
              {([["friends", "Friends vote", "The friends who put money in confirm.", "friends"], ["photo", "Photo proof", "You upload proof, friends approve or dispute.", "camera"]] as const).map(([id, title, sub, icon]) => (
                <button key={id} type="button" onClick={() => setVerify(id)} aria-pressed={verify === id} className="tile flex w-full items-center gap-3 p-3 text-left">
                  <Icon3D name={icon} size={48} />
                  <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="text-sm opacity-80">{sub}</span></span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${verify === id ? "border-deep bg-deep text-white" : "border-stone"}`}>{verify === id && <Check className="h-4 w-4" aria-hidden />}</span>
                </button>
              ))}
              <div className="flex w-full items-center justify-between rounded-2xl bg-stone2 p-4 text-left text-muted"><span><span className="block font-medium text-ink/70">Strava, Screen Time</span><span className="text-sm">Proof comes in by itself</span></span><span className="pill bg-white/70 text-xs">Coming soon</span></div>
            </div>
          </fieldset>
          <div className="mt-auto" />
          <button onClick={() => setStep(3)} className="btn btn-primary w-full py-4 text-lg">Continue</button>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">How much would it hurt to lose?</h1>
          <StakePicker value={stake} onChange={(v) => { setStake(v); setSure(false); }} min={5} max={Math.floor(s.balance)} suggested={suggested} label="Money you lock" />
          {veryHigh && !tooMuch && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-5 w-5 accent-[#2E2260]" />
              <span>Yes, I want to lock {usd(stake)}. I understand I lose it if I walk away.</span>
            </label>
          )}
          <section className="surface-lilac space-y-2 p-5 text-sm" aria-live="polite" aria-label="Summary">
            <Icon3D name="padlock-key" size={92} className="float absolute -right-1 -top-1" />
            <p>Summary</p>
            <p className="pr-20 text-[20px] font-medium leading-tight">{goal.toLowerCase().includes(deadlineLabel.toLowerCase()) ? goal : `${goal} · ${deadlineLabel}`}</p>
            <div className="flex items-center gap-3 pb-1"><p className="big text-[52px]">{usd(stake).replace(".00", "")}</p><LockedPill>Locked</LockedPill></div>
            <div className="space-y-2 border-t border-deep/20 pt-3">
              <p className="flex gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-locked text-forest"><Check className="h-3 w-3" aria-hidden /></span><span><span className="font-semibold">Keep your word:</span> {usd(stake)} back, plus {KEEPERS_PERCENT}% of forfeits shared by stake.</span></p>
              <p className="flex gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-deep/15"><X className="h-3 w-3" aria-hidden /></span><span><span className="font-semibold">Walk away:</span> you lose {usd(stake)}. {FEE_PERCENT}% goes to {PROJECT_NAME}.</span></p>
            </div>
          </section>
          <p className="text-center text-sm text-muted">Paid from your balance · <span className="mono">{usd(s.balance)}</span></p>
          <div className="mt-auto" />
          <button disabled={tooMuch || (veryHigh && !sure)} onClick={() => setLocking(true)} className="btn btn-primary w-full py-4 text-lg">
            {tooMuch ? "Add funds first" : <><Lock className="h-5 w-5" aria-hidden /> Lock it in · {usd(stake)}</>}
          </button>
          <p className="-mt-1 text-center text-xs text-muted">Locked by code, not held by us.</p>
        </>
      )}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 4 group
export function GroupTabs({ active, go }: { active: "group" | "feed"; go: (r: Route) => void }) {
  return (
    <div className="seg" role="tablist" aria-label="Group views">
      <button onClick={() => go("group")} aria-current={active === "group" ? "page" : undefined}>Members</button>
      <button onClick={() => go("feed")} aria-current={active === "feed" ? "page" : undefined}>Feed</button>
    </div>
  );
}

export function GroupScreen({ s, go }: Pick<ScreenProps, "s" | "go">) {
  const [copied, setCopied] = useState(false);
  const invite = async () => {
    const url = `${location.origin}/demo?invite=austin-runners`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard blocked: the label still confirms the demo action */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const inCount = s.people.filter((p) => p.stake > 0).length;
  return (
    <ScreenBody>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] font-medium leading-tight tracking-tight">{GROUP_NAME}</h1>
        <button onClick={() => go(s.stage === "ended" ? "results" : "goal")} className="btn btn-quiet btn-sm border-0 shadow-[0_10px_28px_rgba(26,26,24,0.08)]">{s.stage === "ended" ? "Results" : "My goal"}</button>
      </header>
      <GroupTabs active="group" go={go} />
      <section className="surface-lilac p-5" aria-label="Pot">
        <Icon3D name="money-bag" size={112} className="float absolute -right-2 -top-2" />
        <div className="flex items-center gap-2"><p>Group pot</p>{pot(s) > 0 && <LockedPill>Locked</LockedPill>}</div>
        <p className="big mt-2 text-[64px]">{usd(pot(s)).replace(".00", "")}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span>{inCount} of {s.people.length} locked in</span>
          <span className="flex -space-x-2" aria-hidden>{s.people.filter((p) => p.stake > 0).map((p) => <Avatar key={p.id} id={p.id} size={28} />)}</span>
        </div>
        {pot(s) > 0 && <p className="mt-2 text-xs">Your money stays locked until the deadline.</p>}
      </section>
      <ul className="grid grid-cols-2 gap-3" aria-label="People and goals">
        {s.people.map((p, i) => (
          <li key={p.id} className={`pastel flex flex-col gap-2 p-4 ${p.id === "martin" ? "bg-mint" : p.id === "dani" ? "bg-lilac-tint" : PASTEL[p.id]} ${i === s.people.length - 1 && s.people.length % 2 === 1 ? "col-span-2" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <Avatar id={p.id} size={40} white />
              <StatusChip status={p.status} />
            </div>
            <p className="mt-1 text-lg font-medium leading-tight">{p.id === "martin" ? "You" : p.name}</p>
            <p className="line-clamp-2 text-sm">{p.goal || "No goal yet"}{p.stake > 0 ? <> · <span className="mono">{usd(p.stake).replace(".00", "")}</span></> : null}</p>
          </li>
        ))}
      </ul>
      <button onClick={invite} className="btn btn-primary w-full py-4 text-lg"><Link2 className="h-5 w-5" aria-hidden /> {copied ? "Link copied" : "Invite friends"}</button>
      <p className="text-sm text-muted"><Check className="mr-1 inline h-4 w-4 text-forest" aria-hidden />Only people who put money in can vote or confirm.</p>
    </ScreenBody>
  );
}
