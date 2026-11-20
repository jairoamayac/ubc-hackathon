"use client";

// Kept, offline demo: the 75 second path with no backend. Press D (or use "Demo controls") to make the
// friends act, or "Play all" to run the whole story. Everything is simulated and labeled as such.
import { Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
    case "disputeStep": return a.step === 1 ? "Detected on-chain" : a.step === 2 ? "Grok Bot reviews" : "Grok Bot proposes a verdict";
    case "confirm": return `${a.id[0].toUpperCase()}${a.id.slice(1)} confirms the proposal`;
    case "deadline": return "Time runs out";
    case "collect": return "Martin collects";
    default: return "Next step";
  }
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

export default function DemoApp() {
  const [s, d] = useReducer(reducer, undefined, initial);
  const [route, setRoute] = useState<Route>("login");
  const [panel, setPanel] = useState(false);
  const [auto, setAuto] = useState(false);
  const sRef = useRef(s);
  useEffect(() => {
    sRef.current = s;
  }, [s]);

  const go = useCallback((r: Route) => setRoute(r), []);

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

  // Play all: one step every 1.4 s until it is your turn or the story ends.
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      const st = sRef.current;
      // Do not race the appeal timers or the Grok checks.
      if (st.stage === "appeal") return;
      advance();
    }, 1400);
    return () => clearInterval(t);
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
    setRoute("login");
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
    <Shell>
      {screen}
      {showNav && tab && <BottomNav tab={tab} onTab={(t) => setRoute(t === "me" ? "me" : t === "group" ? "group" : "home")} />}
      <div className="sticky bottom-0 z-20 px-4 pb-3 pt-2">
        {panel ? (
          <section aria-label="Demo controls" className="rounded-xl border border-stone bg-paper p-3 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted">Demo controls · simulated</p>
            <p className="mt-1">{describe(next, s)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={advance} disabled={!next} className="btn btn-primary min-h-10 px-2 text-sm"><SkipForward className="h-4 w-4" aria-hidden /> Next (D)</button>
              <button onClick={() => setAuto((v) => !v)} disabled={!next && !auto} aria-pressed={auto} className="btn btn-quiet min-h-10 px-2 text-sm"><Play className="h-4 w-4" aria-hidden /> {auto ? "Pause" : "Play all"}</button>
              <button onClick={reset} className="btn btn-quiet min-h-10 px-2 text-sm"><RotateCcw className="h-4 w-4" aria-hidden /> Reset</button>
            </div>
            <button onClick={() => setPanel(false)} className="mt-2 min-h-9 text-xs text-muted underline">Hide</button>
          </section>
        ) : (
          <button onClick={() => setPanel(true)} className="ml-auto flex min-h-9 items-center rounded-full border border-stone bg-paper px-3 text-xs text-muted">Demo controls (D)</button>
        )}
      </div>
    </Shell>
  );
}
