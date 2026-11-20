"use client";

// "Verify with Grok": for goals anyone can check in public data (for example an X follower count).
// Grok Bot reads the data itself and answers KEPT, MISSED or CANNOT_VERIFY. It takes a few minutes, so we poll.
// Grok only reports what it found. It never moves money: the group still settles the pact.
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChallengeView } from "@/lib/house-money/solana/live";
import type { VerificationView } from "@/lib/grok";
import { AppealError, getVerification, startVerification, GROK_GAVE_UP, keepPolling } from "@/lib/grok-client";

const LABEL = { KEPT: "Goal reached", MISSED: "Goal not reached", CANNOT_VERIFY: "Grok could not verify this" } as const;

export function VerifySheet({ pact, onClose }: { pact: ChallengeView; onClose: () => void }) {
  const me = pact.entries.find((e) => e.isMe);
  const goal = me?.goal ?? "your goal";
  const [handle, setHandle] = useState("");
  const [target, setTarget] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<VerificationView | null>(null);
  const [waited, setWaited] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }, []);
  const poll = (id: string, startedAt: number) => {
    timer.current = setTimeout(async () => {
      if (!alive.current) return;
      setWaited(Math.round((Date.now() - startedAt) / 1000));
      try {
        const v = await getVerification(id);
        if (!alive.current) return;
        setJob(v);
        if (v.status === "pending") poll(id, startedAt);
      } catch (e) {
        if (!alive.current) return;
        if (keepPolling(e, startedAt)) poll(id, startedAt);
        else setError(e instanceof AppealError ? e.message : GROK_GAVE_UP);
      }
    }, 5000);
  };

  const cleanHandle = handle.trim().replace(/^@/, "");
  const goalNumber = Number(target.replace(/[,\s]/g, ""));
  const valid = /^[A-Za-z0-9_]{1,15}$/.test(cleanHandle) && Number.isFinite(goalNumber) && goalNumber > 0;

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const { verification_id } = await startVerification({
        member: me?.name ?? "A member",
        goal,
        criterion: `@${cleanHandle} reaches ${goalNumber.toLocaleString("en-US")} followers on X`,
        deadline: new Date(pact.challenge.endsAt * 1000).toISOString(),
        source: `@${cleanHandle}`,
      });
      setJob({ verification_id, status: "pending", created_at: Date.now() });
      setWaited(0);
      poll(verification_id, Date.now());
    } catch (e) {
      setError(e instanceof AppealError ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  if (job?.status === "pending") {
    return (
      <div className="space-y-4 py-2" role="status" aria-live="polite">
        <div className="flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-deep" aria-hidden /><p className="font-medium">Grok is checking @{cleanHandle} on X…</p></div>
        <p className="text-sm text-muted">Grok reads the public profile itself, so nobody has to vote. This can take a few minutes{waited > 0 ? ` (${Math.floor(waited / 60)}:${String(waited % 60).padStart(2, "0")} so far)` : ""}.</p>
      </div>
    );
  }
  if (job?.status === "failed") {
    return (
      <div className="space-y-4" role="alert">
        <p className="font-medium text-danger">We could not reach Grok.</p>
        <p className="text-sm text-muted">{job.error ?? "Try again in a moment."}</p>
        <button onClick={() => setJob(null)} className="btn btn-primary w-full">Try again</button>
      </div>
    );
  }
  if (job?.status === "decided" && job.verdict) {
    const kept = job.verdict === "KEPT";
    return (
      <div className="space-y-4" aria-live="polite">
        <span className="pill self-start bg-ink text-white"><ShieldCheck className="h-4 w-4" aria-hidden /> Checked by Grok</span>
        <div className="surface-lilac p-4">
          <p className="flex items-center gap-2 text-lg font-semibold text-deep">
            {kept ? <Check className="h-5 w-5" aria-hidden /> : job.verdict === "MISSED" ? <X className="h-5 w-5" aria-hidden /> : null}
            {LABEL[job.verdict]}
          </p>
          {job.observed && <p className="mt-1 text-sm">Grok saw: {job.observed}</p>}
          {job.checked_at && <p className="text-xs text-deep/80">Checked {job.checked_at}</p>}
        </div>
        {job.reason && <p className="text-sm text-muted">{job.reason}</p>}
        <p className="text-sm text-muted">This is a public data check, not a payout. Show it to your group; your money moves only when the pact settles.</p>
        <button onClick={onClose} className="btn btn-quiet w-full">Close</button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">For goals anyone can check in public, like followers on X. Grok looks at the profile itself, so no vote is needed.</p>
      <p className="rounded-2xl bg-stone2 p-3 text-sm">Your goal: {goal}</p>
      <div>
        <label htmlFor="x-handle" className="mb-1 block text-sm text-muted">X handle</label>
        <input id="x-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" autoCapitalize="none" autoCorrect="off" className="w-full h-12 rounded-2xl bg-white px-4 shadow-[0_10px_28px_rgba(26,26,24,0.08)] outline-none focus:ring-2 focus:ring-deep" />
      </div>
      <div>
        <label htmlFor="x-target" className="mb-1 block text-sm text-muted">Followers you promised to reach</label>
        <input id="x-target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="6,000" className="w-full h-12 rounded-2xl bg-white px-4 shadow-[0_10px_28px_rgba(26,26,24,0.08)] outline-none focus:ring-2 focus:ring-deep" />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button onClick={submit} disabled={!valid || sending} className="btn btn-primary w-full py-4 text-lg">
        {sending ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Sending to Grok</> : "Verify with Grok"}
      </button>
    </div>
  );
}
