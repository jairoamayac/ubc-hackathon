"use client";

// "Ask Grok" for the group (task "group"): reminders, cheers and a little teasing, written from the pacts that are open.
// Grok only writes messages. It never moves money.
import { Loader2, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChallengeView } from "@/lib/house-money/solana/live";
import type { GroupMember, GroupMessage, JobView } from "@/lib/grok";
import { AppealError, askGroup, getGroupJob, GROK_GAVE_UP, keepPolling } from "@/lib/grok-client";

const STATUS = ["pending", "kept", "missed"] as const;

export function GrokGroup({ groupId, pacts }: { groupId: string; pacts: ChallengeView[] }) {
  const [job, setJob] = useState<JobView<{ messages: GroupMessage[] }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }, []);

  const members: GroupMember[] = pacts.flatMap((p) =>
    p.entries.filter((e) => e.goal).map((e) => ({
      name: e.name, goal: e.goal as string, deadline: new Date(p.challenge.endsAt * 1000).toISOString(),
      status: STATUS[e.entry.status] ?? "pending", last_proof_at: null,
    })));

  const poll = (id: string, startedAt: number) => {
    timer.current = setTimeout(async () => {
      if (!alive.current) return;
      try {
        const j = await getGroupJob(id);
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
    if (sending || members.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const { job_id } = await askGroup({ group_id: groupId, members });
      setJob({ job_id, kind: "group", status: "pending", created_at: Date.now() });
      poll(job_id, Date.now());
    } catch (e) {
      setError(e instanceof AppealError ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  if (members.length === 0) return null;
  const messages = job?.status === "decided" ? job.result?.messages ?? [] : [];
  return (
    <section aria-label="Grok check-in" className="card space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-medium"><MessageCircle className="h-4 w-4 text-forest" aria-hidden /> Grok check-in</h2>
        <button onClick={ask} disabled={sending || job?.status === "pending"} className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-stone px-4 text-sm font-medium disabled:opacity-45">
          {job?.status === "pending" ? "Grok is writing…" : messages.length ? "Ask again" : "Ask Grok"}
        </button>
      </div>
      {job?.status === "pending" && <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin text-forest" aria-hidden /> It takes a few minutes. You can keep using the app.</p>}
      {messages.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className="rounded-xl bg-mint p-3 text-sm">
              <span className="block text-xs text-muted">Grok{m.to !== "all" ? ` to ${m.to}` : ""}</span>
              {m.text}
            </li>
          ))}
        </ul>
      )}
      {(error || job?.status === "failed") && <p role="alert" className="text-sm text-danger">{error ?? job?.error ?? "We could not reach Grok."}</p>}
      {!job && <p className="text-sm text-muted">Grok reads who has what on the line and writes reminders, cheers and a little teasing. It never moves money.</p>}
    </section>
  );
}
