"use client";

// The real Grok coach (task "coach"). It takes minutes because Grok works as an agent, so the instant coach in the
// goal form stays the default and this card only shows up as a suggestion when Grok answers.
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CoachResult, JobView } from "@/lib/grok";
import { AppealError, getCoachJob, startCoach, GROK_GAVE_UP, keepPolling } from "@/lib/grok-client";
import { usd } from "@/lib/format";

export function GrokCoach({ goal, member, onUse }: { goal: string; member?: string; onUse: (r: CoachResult) => void }) {
  const [job, setJob] = useState<JobView<CoachResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }, []);

  const poll = (id: string, startedAt: number) => {
    timer.current = setTimeout(async () => {
      if (!alive.current) return;
      try {
        const j = await getCoachJob(id);
        if (!alive.current) return;
        setJob(j);
        if (j.status === "pending") {
          if (Date.now() - startedAt > 10 * 60_000) setError(GROK_GAVE_UP);
          else poll(id, startedAt);
        }
      } catch (e) {
        if (!alive.current) return;
        if (keepPolling(e, startedAt)) poll(id, startedAt);
        else setError(e instanceof AppealError ? e.message : GROK_GAVE_UP);
      }
    }, 5000);
  };
  const ask = async () => {
    if (sending || !goal.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { job_id } = await startCoach({ raw_goal: goal.trim(), member });
      setJob({ job_id, kind: "coach", status: "pending", created_at: Date.now() });
      poll(job_id, Date.now());
    } catch (e) {
      setError(e instanceof AppealError ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  if (job?.status === "pending") {
    return <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin text-forest" aria-hidden /> Grok is sharpening your goal… keep going, it shows up here in a few minutes.</p>;
  }
  const r = job?.status === "decided" ? job.result : undefined;
  if (r) {
    return (
      <div className="card space-y-2 p-4 text-sm" aria-live="polite">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted"><Sparkles className="h-3.5 w-3.5 text-forest" aria-hidden /> Grok suggests</p>
        <p className="text-base font-medium">{r.goal}</p>
        {r.criterion && <p><span className="text-muted">We count:</span> {r.criterion}</p>}
        {r.proof_method && <p><span className="text-muted">Proof:</span> {r.proof_method}</p>}
        {r.suggested_stake_usd !== null && <p><span className="text-muted">A stake that hurts:</span> {usd(r.suggested_stake_usd)}{r.stake_reason ? `. ${r.stake_reason}` : ""}</p>}
        {r.tips.length > 0 && <ul className="list-disc pl-5 text-muted">{r.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
        <button type="button" onClick={() => onUse(r)} className="btn btn-primary mt-1 w-full">Use this goal</button>
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={ask} disabled={!goal.trim() || sending} className="min-h-11 text-sm text-forest underline disabled:opacity-45">
        {sending ? "Sending to Grok…" : "Ask the real Grok too (takes a few minutes)"}
      </button>
      {(error || job?.status === "failed") && <p role="alert" className="text-sm text-danger">{error ?? job?.error ?? "We could not reach Grok."} The instant coach above still works.</p>}
    </div>
  );
}
