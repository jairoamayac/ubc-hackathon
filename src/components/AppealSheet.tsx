"use client";

// Appeal flow: the person disagrees with a result, attaches proof (a screenshot) and gets a review.
// LIVE: "Send to the Grok council" starts the Grok Bot routine through the Worker (/api/appeal) and polls
// /api/disputes/:id until the council of three jurors has voted. The council only PROPOSES a verdict, it never
// moves money. "Instant demo judge" is the offline fallback: simulated on the device, nothing is uploaded,
// so a video never depends on timing.
import { Check, ImagePlus, Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChallengeView } from "@/lib/house-money/solana/live";
import { usd } from "@/lib/format";
import type { DisputeView } from "@/lib/grok";
import { AppealError, getDispute, shrinkImage, startAppeal, GROK_GAVE_UP, keepPolling } from "@/lib/grok-client";
import { Check3, Icon3D } from "./demo/parts";

type Reason = { label: string; ok: boolean; detail: string };
type Verdict = { accepted: boolean; headline: string; reasons: Reason[] };

const STEP_STEPS = ["Dispute opened", "Dispute received", "Grok Bot is reviewing…"];
const STEP_DELAYS = [700, 900, 2300];

function simulateReview(goal: string, accepted: boolean): Verdict {
  if (accepted) {
    return {
      accepted,
      headline: "Proof accepted",
      reasons: [
        { label: "Matches your goal", ok: true, detail: `The screenshot shows what you said you would do: "${goal}".` },
        { label: "Inside the pact window", ok: true, detail: "The date on the proof falls between the start and the deadline." },
        { label: "Details look consistent", ok: true, detail: "Numbers on the screenshot add up and nothing looks edited." },
      ],
    };
  }
  return {
    accepted,
    headline: "Proof not accepted",
    reasons: [
      { label: "Matches your goal", ok: false, detail: `We could not find evidence of "${goal}" in the screenshot.` },
      { label: "Inside the pact window", ok: false, detail: "The date on the proof is outside the pact window." },
      { label: "Looks unedited", ok: true, detail: "No signs of editing were found." },
    ],
  };
}

export function AppealSheet({ pact, onClose }: { pact: ChallengeView; onClose: () => void }) {
  const goal = pact.entries.find((e) => e.isMe)?.goal ?? "your goal";
  const stake = pact.mine?.usd ?? 0;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [demoAccepts, setDemoAccepts] = useState(true);
  const [phase, setPhase] = useState<"form" | "reviewing" | "done" | "council">("form");
  const [dispute, setDispute] = useState<DisputeView | null>(null);
  const [sending, setSending] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  // The preview URL is created in the handler (not in an effect) and released when replaced or on unmount.
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const choose = (f: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f ? URL.createObjectURL(f) : null;
    setFile(f);
    setPreview(urlRef.current);
  };

  // Simulated states, same wording as the real flow: opened, detected on-chain, Grok Bot reviewing, proposal.
  const [step, setStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const send = () => {
    if (!file || phase !== "form") return;
    setPhase("reviewing");
    setStep(0);
    let at = 0;
    STEP_DELAYS.forEach((delay, i) => {
      at += delay;
      timers.current.push(setTimeout(() => {
        if (i < STEP_STEPS.length - 1) setStep(i + 1);
        else {
          setVerdict(simulateReview(goal, demoAccepts));
          setPhase("done");
        }
      }, at));
    });
  };

  // LIVE path: Worker starts the routine, then we poll every 5 seconds. The Bot runs as an agent and can take
  // a few minutes, so there is no short timeout: we keep asking until it answers or the sheet is closed.
  const polling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (polling.current) clearTimeout(polling.current); }, []);
  const poll = (id: string, startedAt: number) => {
    polling.current = setTimeout(async () => {
      if (!alive.current) return;
      setWaited(Math.round((Date.now() - startedAt) / 1000));
      try {
        const d = await getDispute(id);
        if (!alive.current) return;
        setDispute(d);
        if (d.status === "pending") poll(id, startedAt);
      } catch (e) {
        if (!alive.current) return;
        if (keepPolling(e, startedAt)) poll(id, startedAt); // a lost request is not a lost verdict
        else setLiveError(e instanceof AppealError ? e.message : GROK_GAVE_UP);
      }
    }, 5000);
  };
  const sendLive = async () => {
    if (sending) return;
    setSending(true);
    setLiveError(null);
    try {
      const me = pact.entries.find((e) => e.isMe);
      const image = file ? await shrinkImage(file).catch(() => undefined) : undefined;
      const { dispute_id } = await startAppeal({
        challenge: pact.challenge.address.toBase58(),
        member: me?.name ?? "A member",
        disputer: "a friend in the group",
        goal,
        criterion: pact.challenge.title ? `Pact: ${pact.challenge.title}. Do what the goal says, with proof, before the deadline.` : "Do what the goal says, with proof, before the deadline.",
        deadline: new Date(pact.challenge.endsAt * 1000).toISOString(),
        dispute_reason: "A friend says the goal was not met.",
        member_reply: note,
        proof: { description: note || (file ? "Screenshot attached." : "No screenshot attached.") },
        image_data_url: image,
      });
      setDispute({ dispute_id, status: "pending", created_at: Date.now() });
      setPhase("council");
      setWaited(0);
      poll(dispute_id, Date.now());
    } catch (e) {
      setLiveError(e instanceof AppealError ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  if (phase === "council" && dispute) return <CouncilView dispute={dispute} goal={goal} stake={stake} waited={waited} onClose={onClose} onInstant={() => { if (polling.current) clearTimeout(polling.current); setPhase("form"); }} />;

  if (phase === "reviewing") {
    return (
      <div className="space-y-5 py-2" role="status" aria-live="polite">
        <p className="font-medium">Grok is reviewing your proof</p>
        <Check3 items={STEP_STEPS} step={step} />
        <p className="text-xs text-muted">Simulated for the demo. <span className="rounded-md bg-stone px-1.5 py-0.5 text-[10px] uppercase tracking-widest">Demo</span></p>
      </div>
    );
  }

  if (phase === "done" && verdict) {
    return (
      <div className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <span className="pill self-start bg-ink text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Reviewed by Grok
          </span>
          <span className="rounded-full border border-stone px-2.5 py-0.5 text-xs text-muted">Demo</span>
        </div>
        <div className="surface-lilac p-4 pr-20">
          <Icon3D name={verdict.accepted ? "shield-check" : "chat-check"} size={64} className="absolute -right-1 -top-1" />
          <p className="text-lg font-semibold text-deep">{verdict.headline}</p>
          <p className="mt-1 text-sm text-deep">Your goal: {goal} · {usd(stake)} locked</p>
        </div>
        <ul className="divide-y divide-stone" aria-label="Why">
          {verdict.reasons.map((r) => (
            <li key={r.label} className="flex items-start gap-3 py-3 first:pt-0">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${r.ok ? "bg-locked text-forest" : "bg-stone text-danger"}`}>
                {r.ok ? <Check className="h-3.5 w-3.5" aria-label="Yes" /> : <X className="h-3.5 w-3.5" aria-label="No" />}
              </span>
              <span>
                <span className="block font-medium">{r.label}</span>
                <span className="block text-sm text-muted">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Next, your group confirms Grok&apos;s proposal. In the real product the decision is recorded together with the result.</p>
        <p className="text-xs text-muted">Demo only. This verdict is simulated and does not change the result or your money.</p>
        <button onClick={onClose} className="btn btn-quiet w-full">Close</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-muted">If your friends got it wrong, send proof of {goal === "your goal" ? "your goal" : `"${goal}"`}, such as a screenshot. Grok reviews the goal, the date and the details, and explains its decision.</p>

      <div>
        <label htmlFor="proof" className="mb-2 block text-sm text-muted">Screenshot</label>
        <input
          id="proof"
          type="file"
          accept="image/*"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <label htmlFor="proof" className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-lilac bg-lilac-tint p-4 text-center text-sm text-deep focus-within:border-deep">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your screenshot" className="max-h-48 rounded-lg" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" aria-hidden />
              <span>Choose a screenshot</span>
            </>
          )}
          {file && <span className="text-xs">{file.name}. Tap to change.</span>}
        </label>
        <p className="mt-2 text-xs text-muted">With the Grok council the screenshot is shrunk and sent so the jurors can open it. The instant demo judge keeps it on this device.</p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm text-muted">Anything we should know? (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          rows={2}
          className="card w-full px-4 py-3 outline-none focus:ring-2 focus:ring-deep"
        />
      </label>

      <fieldset className="rounded-2xl bg-lilac-tint p-3">
        <legend className="px-1 text-xs text-muted">Instant demo judge: the verdict to show</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={demoAccepts} onClick={() => setDemoAccepts(true)} className="tile min-h-11 py-2 text-sm">Accepted</button>
          <button type="button" aria-pressed={!demoAccepts} onClick={() => setDemoAccepts(false)} className="tile min-h-11 py-2 text-sm">Not accepted</button>
        </div>
      </fieldset>

      {liveError && <p role="alert" className="text-sm text-danger">{liveError} You can still use the instant demo judge below.</p>}
      <button onClick={sendLive} disabled={sending} className="btn btn-primary w-full py-4 text-lg">
        {sending ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Sending to Grok</> : "Send to the Grok council"}
      </button>
      <p className="-mt-2 text-xs text-muted">Three independent AI jurors review your case and vote blind. It can take a few minutes. They propose a verdict, your group sees it, and your money does not move on one opinion.</p>
      <button onClick={send} disabled={!file} className="btn btn-quiet w-full">
        {file ? "Instant demo judge (simulated)" : "Instant demo judge: add a screenshot first"}
      </button>
    </div>
  );
}


const VERDICT_LABEL = { KEPT: "Kept", MISSED: "Missed", NEEDS_MORE_EVIDENCE: "Needs more evidence" } as const;
const LENS_LABEL: Record<string, string> = { criterion: "Does the proof meet the goal?", fraud: "Is it fraudulent?", fairness: "What do both sides say?" };

function CouncilView({ dispute, goal, stake, waited, onClose, onInstant }: { dispute: DisputeView; goal: string; stake: number; waited: number; onClose: () => void; onInstant: () => void }) {
  if (dispute.status === "failed") {
    return (
      <div className="space-y-4" role="alert">
        <p className="font-medium text-danger">We could not reach the Grok council.</p>
        <p className="text-sm text-muted">{dispute.error ?? "Try again in a moment."}</p>
        <button onClick={onInstant} className="btn btn-primary w-full">Back to the appeal</button>
      </div>
    );
  }
  if (dispute.status === "pending") {
    return (
      <div className="space-y-5 py-2" role="status" aria-live="polite">
        <div className="flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-deep" aria-hidden /><p className="font-medium">The Grok council is deliberating…</p></div>
        <Check3 items={["Case sent to Grok Bot", "Three jurors vote blind", "Votes are counted"]} step={waited < 8 ? 1 : 2} />
        <p className="text-sm text-muted">This can take a few minutes{waited > 0 ? ` (${Math.floor(waited / 60)}:${String(waited % 60).padStart(2, "0")} so far)` : ""}. You can keep this open or come back.</p>
        <button onClick={onInstant} className="btn btn-quiet w-full">Use the instant demo judge instead</button>
      </div>
    );
  }
  const v = dispute.verdict!;
  const tally = dispute.tally;
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="pill self-start bg-ink text-white"><ShieldCheck className="h-4 w-4" aria-hidden /> Grok council</span>
        <span className="rounded-full border border-stone px-2.5 py-0.5 text-xs text-muted">Proposal, not final</span>
      </div>
      <div className="surface-lilac p-4 pr-20">
        <Icon3D name={v === "KEPT" ? "shield-check" : "chat-check"} size={64} className="absolute -right-1 -top-1" />
        <p className="text-lg font-semibold text-deep">{VERDICT_LABEL[v]}</p>
        <p className="mt-1 text-sm text-deep">Your goal: {goal} · {usd(stake)} locked · {Math.round((dispute.confidence ?? 0) * 100)}% confident</p>
        {tally && <p className="mt-2 text-sm">Votes: {tally.KEPT} kept · {tally.MISSED} missed · {tally.NEEDS_MORE_EVIDENCE} need more evidence</p>}
      </div>
      {dispute.evidence_requested && <p className="rounded-2xl bg-stone2 p-3 text-sm"><span className="font-medium">The council asks for:</span> {dispute.evidence_requested}</p>}
      <ul className="space-y-2" aria-label="The three jurors">
        {(dispute.council ?? []).map((j) => (
          <li key={j.juror} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted">Juror {j.juror} · {LENS_LABEL[j.lens] ?? j.lens}</p>
                <p className="mt-1 font-medium">{VERDICT_LABEL[j.vote]} <span className="font-normal text-muted">({Math.round(j.confidence * 100)}%)</span></p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${j.coherent ? "bg-lilac-tint text-deep" : "border border-stone text-muted"}`}>{j.coherent ? "Coherent" : "Incoherent"}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{j.reason}</p>
          </li>
        ))}
      </ul>
      {(dispute.reasons ?? []).length > 0 && (
        <ul className="divide-y divide-stone" aria-label="Why">
          {dispute.reasons!.map((r) => <li key={r} className="py-2 text-sm">{r}</li>)}
        </ul>
      )}
      <p className="text-sm text-muted">Each juror voted for the verdict it expects the other honest jurors to reach. Grok proposes, your group sees it, and only then is the result settled.</p>
      <button onClick={onClose} className="btn btn-quiet w-full">Close</button>
    </div>
  );
}
