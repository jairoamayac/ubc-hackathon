"use client";

// Demo screens, part 1: login, home, new goal wizard, group.
import { Check, Link2, Loader2, Plus, Sparkles } from "lucide-react";
import { useMemo, useState, type Dispatch } from "react";
import { FEE_PERCENT, KEEPERS_PERCENT, PROJECT_NAME, STAKE_SUGGESTED_MIN, STAKE_WARN_MULTIPLE, TAGLINE } from "@/lib/brand";
import { coachGoal, type Coaching } from "@/lib/coach";
import { GROUP_NAME, onTheLine, pot, yieldFor, type Action, type DemoState } from "@/lib/demo/store";
import { StakePicker } from "../StakePicker";
import { usd } from "../ui";
import { Avatar, Back, DemoBadge, LockAnimation, ScreenBody, StatusChip, UrgencyBanner, timeLeft } from "./parts";

export type Route = "login" | "home" | "new" | "group" | "goal" | "feed" | "vote" | "dispute" | "results" | "me";
export type ScreenProps = { s: DemoState; d: Dispatch<Action>; go: (r: Route) => void };

// -------------------------------------------------------------------- 1 login
export function LoginScreen({ d, go }: Pick<ScreenProps, "d" | "go">) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const submit = () => {
    if (!email.includes("@") || sending) return;
    setSending(true);
    setTimeout(() => {
      d({ type: "signIn", email });
      go("home");
    }, 900);
  };
  return (
    <ScreenBody>
      <div className="mt-16 flex flex-col gap-3">
        <span className="flex items-center gap-2 text-lg font-medium tracking-tight"><span className="dot" aria-hidden /> {PROJECT_NAME}</span>
        <h1 className="text-[40px] font-medium leading-[1.05] tracking-tight">Put something on the line.</h1>
        <p className="text-muted">{TAGLINE} Lock money on your goal. Your friends are the witnesses.</p>
      </div>
      <form className="mt-8 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="block">
          <span className="mb-2 block text-sm text-muted">Your email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="martin@example.com"
            className="card w-full px-4 py-3 text-lg outline-none placeholder:text-muted/70 focus:border-forest"
          />
        </label>
        <button type="submit" disabled={!email.includes("@") || sending} className="btn btn-primary w-full py-4 text-lg">
          {sending ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Sending your link</> : "Continue with email"}
        </button>
        <p className="text-sm text-muted">No password to remember. <DemoBadge>Demo</DemoBadge> No email is sent.</p>
      </form>
      <button type="button" onClick={() => { setEmail("martin@example.com"); }} className="mt-2 min-h-11 self-start text-sm text-forest underline">Use the demo email</button>
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 2 home
export function HomeScreen({ s, go }: Pick<ScreenProps, "s" | "go">) {
  const me = s.people.find((p) => p.id === "martin")!;
  const hasGoal = me.stake > 0;
  const joined = s.people.filter((p) => p.stake > 0).length;
  const progress = Math.round(((72 - s.hoursLeft) / 72) * 100);
  return (
    <ScreenBody>
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-medium tracking-tight"><span className="dot" aria-hidden /> {PROJECT_NAME}</span>
        <Avatar id="martin" />
      </header>
      <section className="card p-5" aria-label="Your money">
        <p className="text-sm text-muted">Your money</p>
        <p className="mt-1 text-[40px] font-medium leading-none tracking-tight tabular-nums">{usd(s.balance + onTheLine(s))}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="pill-locked">On the line {usd(onTheLine(s))}</span>
          <span className="rounded-full border border-stone px-3 py-0.5 text-sm text-muted">Free {usd(s.balance)}</span>
        </div>
      </section>
      <UrgencyBanner hours={me.status === "on_track" && s.stage === "running" ? s.hoursLeft : 99} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Your goals</h2>
        {s.stage === "empty" && <button onClick={() => go("new")} className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-forest"><Plus className="h-4 w-4" aria-hidden /> New goal</button>}
      </div>
      {hasGoal ? (
        <button onClick={() => go("goal")} className="card w-full space-y-3 p-5 text-left" aria-label={`Open goal: ${me.goal}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{me.goal}</p>
              <p className="text-sm text-muted">{timeLeft(s.hoursLeft)} · <span className="pill-locked">Locked {usd(me.stake)}</span></p>
            </div>
            <StatusChip status={me.status} />
          </div>
          <div className="bar" aria-hidden><span style={{ width: `${s.stage === "ended" ? 100 : Math.max(4, progress)}%` }} /></div>
        </button>
      ) : (
        <div className="card p-5">
          <p className="font-medium">Nothing on the line yet.</p>
          <p className="mt-1 text-sm text-muted">Pick a goal you could measure, lock money on it, and your friends will keep you honest.</p>
          <button onClick={() => go("new")} className="btn btn-primary mt-4 w-full py-4 text-lg">+ New goal</button>
        </div>
      )}

      <h2 className="mt-2 text-lg font-medium">Groups</h2>
      <button onClick={() => go("group")} className="card flex w-full items-center justify-between gap-3 p-5 text-left">
        <span>
          <span className="flex items-center gap-2 font-medium"><span className="dot" aria-hidden /> {GROUP_NAME}</span>
          <span className="block text-sm text-muted">{joined} of 5 locked in · pot {usd(pot(s))}</span>
        </span>
        <span className="flex -space-x-2" aria-hidden>{s.people.filter((p) => p.stake > 0).slice(0, 4).map((p) => <Avatar key={p.id} id={p.id} size={28} />)}</span>
      </button>
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 3 new goal (wizard)
const CATEGORIES = ["Fitness", "Study", "Habit", "Work"] as const;
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
      <Back onClick={() => (step > 1 ? setStep(step - 1) : go("home"))} />
      <header>
        <p className="text-sm text-muted">Step {step} of 3</p>
        <div className="bar mt-2" aria-hidden><span style={{ width: `${(step / 3) * 100}%` }} /></div>
      </header>

      {step === 1 && (
        <>
          <h1 className="text-[30px] font-medium leading-tight tracking-tight">What do you want to get done?</h1>
          <label className="block">
            <span className="sr-only">Your goal</span>
            <input value={text} onChange={(e) => { setText(e.target.value.slice(0, 80)); setCoach(null); }} placeholder="Run 21 km by Sunday" className="card w-full px-4 py-3 text-lg outline-none placeholder:text-muted/70 focus:border-forest" />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
            {CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className="tile min-h-9 px-3 text-sm">{c}</button>)}
          </div>
          <div>
            <button type="button" onClick={askGrok} disabled={!text.trim()} className="flex min-h-11 items-center gap-1.5 rounded-full border border-stone px-4 text-sm font-medium disabled:opacity-45">
              <Sparkles className="h-4 w-4 text-forest" aria-hidden /> Make it measurable with Grok <DemoBadge />
            </button>
            {coach && (
              <div role="status" className={`mt-3 rounded-xl p-4 text-sm ${coach.measurable ? "bg-mint" : "border border-danger"}`}>
                <p className={`font-medium ${coach.measurable ? "text-forest" : "text-danger"}`}>{coach.note}</p>
                {coach.measurable && <p className="mt-1 text-muted">We count: {coach.metric.toLowerCase()}. Proof: {coach.proof.toLowerCase()}.</p>}
              </div>
            )}
          </div>
          <div className="mt-auto" />
          <button disabled={!goal || (coach !== null && !coach.measurable)} onClick={() => setStep(2)} className="btn btn-primary w-full py-4 text-lg">Next</button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-[30px] font-medium leading-tight tracking-tight">When, and who checks?</h1>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Deadline</legend>
            <div className="grid grid-cols-3 gap-2">
              {DEADLINES.map(([label, h]) => <button key={label} type="button" onClick={() => setDeadline(h)} aria-pressed={deadline === h} className="tile min-h-12 py-2">{label}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">How it is verified</legend>
            <div className="space-y-2">
              <button type="button" onClick={() => setVerify("friends")} aria-pressed={verify === "friends"} className="tile w-full p-4 text-left"><span className="block font-medium">Friends vote</span><span className="text-sm opacity-80">The friends who put money in confirm.</span></button>
              <button type="button" onClick={() => setVerify("photo")} aria-pressed={verify === "photo"} className="tile w-full p-4 text-left"><span className="block font-medium">Photo proof</span><span className="text-sm opacity-80">You upload proof, friends approve or dispute.</span></button>
              <div className="tile flex w-full items-center justify-between p-4 text-left opacity-60"><span className="font-medium">Strava, Screen Time</span><span className="rounded-md bg-stone px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">Coming soon</span></div>
            </div>
          </fieldset>
          <div className="mt-auto" />
          <button onClick={() => setStep(3)} className="btn btn-primary w-full py-4 text-lg">Next</button>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="text-[30px] font-medium leading-tight tracking-tight">How much would it hurt to lose?</h1>
          <p className="text-muted">&ldquo;{goal}&rdquo; · {deadlineLabel}</p>
          <StakePicker value={stake} onChange={(v) => { setStake(v); setSure(false); }} min={5} max={Math.floor(s.balance)} suggested={suggested} label="Money you lock" />
          {veryHigh && !tooMuch && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-5 w-5 accent-[#1F5F4A]" />
              <span>Yes, I want to lock {usd(stake)}. I understand I lose it if I walk away.</span>
            </label>
          )}
          <div className="space-y-2 rounded-xl bg-mint p-4 text-sm" aria-live="polite">
            <p className="font-medium">If you miss it, you lose {usd(stake)}. If you keep it, you get it back plus a share of what others lose.</p>
            <p><span className="font-medium text-forest">Keep your word:</span> {usd(stake)} back, plus {KEEPERS_PERCENT}% of forfeits shared by stake.</p>
            <p><span className="font-medium text-danger">Walk away:</span> you lose {usd(stake)}. {FEE_PERCENT}% goes to {PROJECT_NAME}.</p>
            <p className="text-muted">Locked in the contract, not with us.</p>
          </div>
          <div className="mt-auto" />
          <button disabled={tooMuch || (veryHigh && !sure)} onClick={() => setLocking(true)} className="btn btn-primary w-full py-4 text-lg">
            {tooMuch ? "Add funds first" : `Lock it in · ${usd(stake)}`}
          </button>
        </>
      )}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 4 group
export function GroupScreen({ s, go }: Pick<ScreenProps, "s" | "go">) {
  const [copied, setCopied] = useState(false);
  const y = useMemo(() => yieldFor(s), [s]);
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
  return (
    <ScreenBody>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[30px] font-medium leading-tight tracking-tight"><span className="dot" aria-hidden /> {GROUP_NAME}</h1>
          <p className="text-sm text-muted">{s.people.filter((p) => p.stake > 0).length} locked in · {s.people.length} people</p>
        </div>
        <button onClick={invite} className="flex min-h-11 items-center gap-1.5 rounded-full border border-stone px-4 text-sm font-medium"><Link2 className="h-4 w-4" aria-hidden /> {copied ? "Link copied" : "Invite friends"}</button>
      </header>
      <section className="card p-5" aria-label="Pot">
        <p className="text-sm text-muted">In the pot</p>
        <p className="mt-1 text-[36px] font-medium leading-none tracking-tight tabular-nums">{usd(pot(s))}</p>
        {pot(s) > 0 && (
          <p className="mt-3 text-sm text-muted">
            Earning about {usd(y.total)} while it waits, simulated at 4% a year <DemoBadge />
          </p>
        )}
      </section>
      <ul className="space-y-3" aria-label="People and goals">
        {s.people.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-4">
            <Avatar id={p.id} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.id === "martin" ? "You" : p.name}</p>
              <p className="truncate text-sm text-muted">{p.goal || "No goal yet"}</p>
            </div>
            <div className="shrink-0 text-right">
              {p.stake > 0 ? <p className="mb-1 text-sm tabular-nums">{usd(p.stake)}</p> : null}
              <StatusChip status={p.status} />
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => go("feed")} className="btn btn-quiet">Group feed</button>
        <button onClick={() => go(s.stage === "ended" ? "results" : "goal")} className="btn btn-quiet">{s.stage === "ended" ? "Results" : "My goal"}</button>
      </div>
      <p className="text-sm text-muted"><Check className="mr-1 inline h-4 w-4 text-forest" aria-hidden />Only people who put money in can vote or confirm.</p>
    </ScreenBody>
  );
}
