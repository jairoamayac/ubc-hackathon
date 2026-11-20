"use client";

// Grok coach (task "coach"): turns a goal into something friends can check, with a stake that hurts.
// One tap asks the real Grok (about 20 s). If Grok can't answer in time, the instant coach fills in so nobody waits forever.
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CoachResult } from "@/lib/grok";
import { coachGoal } from "@/lib/coach";
import { getCoachJob, startCoach } from "@/lib/grok-client";
import { usd } from "@/lib/format";

/** Give Grok this long before falling back to the instant suggestion. */
const GROK_WAIT_MS = 90_000;
const POLL_MS = 2_500;

type Suggestion = { goal: string; criterion?: string; proof?: string; stake: number | null; reason?: string; fromGrok: boolean };

export function GrokCoach({ goal, member, onUse }: { goal: string; member?: string; onUse: (goal: string, stake: number | null) => void }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "vague">("idle");
  const [s, setS] = useState<Suggestion | null>(null);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);
  useEffect(() => () => { run.current++; if (timer.current) clearTimeout(timer.current); }, []);
  // An answer belongs to the goal text it was asked for: editing the goal shows the button again.
  const [askedFor, setAskedFor] = useState("");
  const view = askedFor === goal ? state : "idle";

  const instant = (mine: number) => {
    if (mine !== run.current) return;
    const c = coachGoal(goal);
    if (!c.measurable) { setNote(c.note); setState("vague"); return; }
    setS({ goal: c.goal, proof: c.proof, stake: c.stake, fromGrok: false });
    setState("done");
  };
  const fromGrok = (r: CoachResult): Suggestion => ({
    goal: r.goal, criterion: r.criterion || undefined, proof: r.proof_method || undefined, stake: r.suggested_stake_usd, reason: r.stake_reason || undefined, fromGrok: true,
  });

  const ask = async () => {
    if (!goal.trim() || view === "working") return;
    const mine = ++run.current;
    setAskedFor(goal);
    setState("working");
    const started = Date.now();
    try {
      const { job_id } = await startCoach({ raw_goal: goal.trim(), member });
      const poll = () => {
        timer.current = setTimeout(async () => {
          if (mine !== run.current) return;
          try {
            const j = await getCoachJob(job_id);
            if (mine !== run.current) return;
            if (j.status === "decided" && j.result) { setS(fromGrok(j.result)); setState("done"); return; }
            if (j.status === "failed") return instant(mine);
          } catch { /* network blip: keep polling until the deadline */ }
          if (Date.now() - started > GROK_WAIT_MS) instant(mine); else poll();
        }, POLL_MS);
      };
      poll();
    } catch {
      instant(mine);
    }
  };

  return (
    <section className="rounded-[24px] bg-ink p-5 text-white" aria-labelledby="coach" aria-live="polite">
      <p id="coach" className="flex items-center gap-2 text-xs text-[#C9CCC4]"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Grok coach</p>
      {view === "idle" && (
        <>
          <p className="mt-2 text-sm text-[#C9CCC4]">Grok makes it measurable, so your friends can tell if you kept it.</p>
          <button type="button" onClick={ask} disabled={!goal.trim()} className="btn mt-3 min-h-11 w-full bg-lilac text-violet-deep">Make it measurable</button>
        </>
      )}
      {view === "working" && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-lilac" aria-hidden /> Grok is working on your goal. About 20 seconds.</p>
      )}
      {view === "vague" && (
        <>
          <p role="status" className="mt-2 text-sm">{note}</p>
          <button type="button" onClick={() => setState("idle")} className="btn mt-3 min-h-11 w-full border border-white/40 text-white">Try again</button>
        </>
      )}
      {view === "done" && s && (
        <>
          <p className="mt-2 text-xl font-medium leading-snug">{s.goal}</p>
          {s.criterion && <p className="mt-2 text-sm text-[#C9CCC4]"><span className="text-white">We count:</span> {s.criterion}</p>}
          {s.proof && <p className="mt-1 text-sm text-[#C9CCC4]"><span className="text-white">Proof:</span> {s.proof}</p>}
          {s.stake !== null && <p className="mt-1 text-sm text-[#C9CCC4]"><span className="text-white">A stake that hurts:</span> {usd(s.stake)}{s.reason ? `. ${s.reason}` : ""}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onUse(s.goal, s.stake)} className="btn min-h-11 bg-lilac text-violet-deep">Use this</button>
            <button type="button" onClick={() => { run.current++; setState("idle"); setS(null); }} className="btn min-h-11 border border-white/40 text-white">Edit</button>
          </div>
        </>
      )}
    </section>
  );
}
