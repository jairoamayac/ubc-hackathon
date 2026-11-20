"use client";

// Kept, offline demo: the 75 second path with no backend. Press D (or use "Demo controls") to make the
// friends act, or "Play all" to run the whole story. Everything is simulated and labeled as such.
import Link from "next/link";
import { Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { coachGoal } from "@/lib/coach";
import { initial, nextAutopilot, reducer, type Action, type DemoState } from "@/lib/demo/store";
import { BottomNav, Shell, type DemoTab } from "./parts";
import { LoginScreen, HomeScreen, NewGoalScreen, GroupScreen, type Route } from "./screens-a";
import { DisputeScreen, FeedScreen, GoalScreen, ProfileScreen, ResultsScreen, VoteScreen } from "./screens-b";

const TAB_OF: Partial<Record<Route, DemoTab>> = { home: "home", goal: "home", new: "home", group: "group", feed: "group", vote: "group", dispute: "group", results: "group", me: "me" };

/** What the next autopilot step is, in plain words, for the demo controls. */
export function describe(a: Action | null, s: DemoState): string {
  if (!a) return s.stage === "login" || s.stage === "empty" ? "Your turn: sign in and lock a goal" : "Nothing left. Press Reset to run it again";
  switch (a.type) {
    case "friendJoin": return `${a.id[0].toUpperCase()}${a.id.slice(1)} locks $50 on their goal`;
    case "fastForward": return "Fast forward to 20 hours left";
    case "submitProof": return "Martin sends proof of his run";
    case "vote": return a.approve ? `${a.id[0].toUpperCase()}${a.id.slice(1)} approves` : `${a.id[0].toUpperCase()}${a.id.slice(1)} disputes the proof`;
    case "appeal": return "Martin appeals with Grok";
    case "disputeStep": return a.step === 1 ? "Dispute received" : a.step === 2 ? "Grok Bot reviews" : "Grok Bot proposes a verdict";
    case "confirm": return `${a.id[0].toUpperCase()}${a.id.slice(1)} confirms the proposal`;
    case "deadline": return "Time runs out";
    case "collect": return "Martin collects";
    default: return "Next step";
  }
}

type Jump = { route: Route; until: (s: DemoState) => boolean };
const JUMPS: Record<string, Jump> = {
  login: { route: "login", until: (s) => s.stage === "login" },
  start: { route: "home", until: (s) => s.stage === "empty" },
  new: { route: "new", until: (s) => s.stage === "empty" },
  group: { route: "group", until: (s) => s.stage === "running" },
  home: { route: "home", until: (s) => s.stage === "running" && s.hoursLeft <= 20 },
  goal: { route: "goal", until: (s) => s.stage === "running" && s.hoursLeft <= 20 },
  feed: { route: "feed", until: (s) => s.stage === "proof" && s.votes.approve.length > 0 },
  vote: { route: "vote", until: (s) => s.stage === "proof" && s.votes.approve.length > 0 },
  dispute: { route: "dispute", until: (s) => s.stage === "disputed" },
  appeal: { route: "dispute", until: (s) => s.stage === "appeal" && s.disputeStep >= 2 },
  verdict: { route: "dispute", until: (s) => s.stage === "proposed" },
  results: { route: "results", until: (s) => s.stage === "ended" },
  me: { route: "me", until: (s) => s.stage === "ended" },
};

/** The actions that take a fresh demo to the first state matching `until`. */
function playTo(until: (s: DemoState) => boolean): Action[] {
  const out: Action[] = [];
  let st = initial();
  const step = (a: Action) => { out.push(a); st = reducer(st, a); };
  for (let i = 0; i < 40 && !until(st); i++) {
    if (st.stage === "login") step({ type: "signIn", email: "martin@example.com" });
    else if (st.stage === "empty") {
      const c = coachGoal("Run 21 km by Sunday");
      step({ type: "lockGoal", goal: c.goal, stake: c.stake, coachNote: c.note });
    }
    else {
      const a = nextAutopilot(st);
      if (!a) break;
      step(a);
    }
  }
  return out;
}

function routeAfter(a: Action): Route | null {
  switch (a.type) {
    case "friendJoin": return "group";
    case "fastForward": return "goal";
    case "submitProof": case "vote": return "feed";
    case "appeal": case "disputeStep": case "confirm": return "dispute";
    case "deadline": case "collect": return "results";
    default: return null;
  }
}

const DEMO_EMAIL = "martin@example.com";

const PLAY_STEP_MS = 5_000;

export default function DemoApp() {
  const [s, d] = useReducer(reducer, undefined, initial);
  // The demo opens straight on Home: the one welcome and sign-in screen is the live app's (/).
  const [route, setRoute] = useState<Route>("home");
  const [panel, setPanel] = useState(false);
  const [auto, setAuto] = useState(false);
  const sRef = useRef(s);
  useEffect(() => {
    sRef.current = s;
  }, [s]);

  const go = useCallback((r: Route) => setRoute(r), []);

  // Deep links for the pitch and for screenshots: /demo?at=goal opens that screen with the story played up
  // to that point (same reducer and autopilot as the live walkthrough, nothing is faked on the side).
  useEffect(() => {
    const at = new URLSearchParams(location.search).get("at");
    const plan = at ? JUMPS[at] : undefined;
    if (!plan) {
      d({ type: "signIn", email: DEMO_EMAIL });
      return;
    }
    const t = setTimeout(() => {
      for (const a of playTo(plan.until)) d(a);
      setRoute(plan.route);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const advance = useCallback(() => {
    const a = nextAutopilot(sRef.current);
    if (!a) {
      setAuto(false);
      return;
    }
    d(a);
    const r = routeAfter(a);
    if (r) setRoute(r);
  }, []);

  // The appeal flow plays itself: opened, detected on-chain, Grok Bot reviewing, proposal.
  useEffect(() => {
    if (s.stage !== "appeal") return;
    const delay = s.disputeStep === 0 ? 900 : s.disputeStep === 1 ? 1100 : 2400;
    const t = setTimeout(() => d({ type: "disputeStep", step: (s.disputeStep + 1) as 1 | 2 | 3 }), delay);
    return () => clearTimeout(t);
  }, [s.stage, s.disputeStep]);

  // Play all: the first step right away, then one step every 5 s so a screen can be read before it changes,
  // until it is your turn or the story ends.
  useEffect(() => {
    if (!auto) return;
    const tick = () => {
      // Do not race the appeal timers or the Grok checks.
      if (sRef.current.stage === "appeal") return;
      advance();
    };
    const first = setTimeout(tick, 700);
    const t = setInterval(tick, PLAY_STEP_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [auto, advance]);

  // D advances one step, unless you are typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "d" || e.key === "D") advance();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [advance]);

  const next = nextAutopilot(s);
  const tab = TAB_OF[route];
  const showNav = route !== "login" && route !== "new";
  const reset = () => {
    setAuto(false);
    d({ type: "reset" });
    d({ type: "signIn", email: DEMO_EMAIL });
    setRoute("home");
  };

  let screen;
  switch (route) {
    case "login": screen = <LoginScreen d={d} go={go} />; break;
    case "home": screen = <HomeScreen s={s} go={go} />; break;
    case "new": screen = <NewGoalScreen s={s} d={d} go={go} />; break;
    case "group": screen = <GroupScreen s={s} go={go} />; break;
    case "goal": screen = <GoalScreen s={s} d={d} go={go} />; break;
    case "feed": screen = <FeedScreen s={s} d={d} go={go} />; break;
    case "vote": screen = <VoteScreen s={s} d={d} go={go} />; break;
    case "dispute": screen = <DisputeScreen s={s} d={d} go={go} />; break;
    case "results": screen = <ResultsScreen s={s} d={d} go={go} />; break;
    case "me": screen = <ProfileScreen s={s} d={d} />; break;
  }

  return (
    <Shell tone={route === "login" ? "lilac" : "paper"}>
      {screen}
      <div className={`sticky bottom-0 z-20 space-y-1.5 px-4 pb-1.5 pt-4 ${route === "login" ? "" : "bg-linear-to-t from-paper via-paper/90 to-transparent"}`}>
        {panel ? (
          <section aria-label="Demo controls" className="rounded-[20px] bg-white p-3 text-sm shadow-[0_12px_28px_rgba(46,34,96,0.18)]">
            <p className="mono text-xs uppercase tracking-widest text-ink">Demo controls · simulated</p>
            <p className="mt-1">{describe(next, s)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={advance} disabled={!next} className="btn btn-ink min-h-12 rounded-xl px-2 text-sm"><SkipForward className="h-4 w-4" aria-hidden /> Next (D)</button>
              <button onClick={() => setAuto((v) => !v)} disabled={!next && !auto} aria-pressed={auto} className="btn btn-quiet min-h-12 rounded-xl border border-ink/20 px-2 text-sm"><Play className="h-4 w-4" aria-hidden /> {auto ? "Pause" : "Play all"}</button>
              <button onClick={reset} className="btn btn-quiet min-h-12 rounded-xl border border-ink/20 px-2 text-sm"><RotateCcw className="h-4 w-4" aria-hidden /> Reset</button>
            </div>
          </section>
        ) : null}
        {showNav && tab && <BottomNav tab={tab} onTab={(t) => setRoute(t === "me" ? "me" : t === "group" ? "group" : "home")} />}
        {/* Tiny hint under the bar: never covers content. D still advances, the panel has Play all. */}
        <div className={`flex items-center justify-center gap-3 text-xs ${route === "login" ? "text-deep/70" : "text-muted"}`}>
          <button onClick={() => setPanel((v) => !v)} aria-expanded={panel} className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white shadow-[0_6px_16px_rgba(46,34,96,0.25)]">
            <span className="mono rounded bg-white/20 px-1.5 text-xs text-white">D</span> {panel ? "Hide demo controls" : "Demo controls"}
          </button>
          <Link href="/" className="flex min-h-11 items-center text-sm font-medium underline underline-offset-2">Demo · sign in for real</Link>
        </div>
      </div>
    </Shell>
  );
}
