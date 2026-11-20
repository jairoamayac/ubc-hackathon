"use client";

// Appeal flow: the person disagrees with a result, attaches proof (a screenshot) and gets a review.
// DEMO: the review is simulated on the device. Nothing is uploaded, the verdict is chosen with the
// demo control below, and it does not change the result or anyone's money. In production an accepted
// appeal is reviewed by Grok Bot and its decision is recorded with the result (docs/architecture-v2.md §5, row 4).
import { Check, ImagePlus, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChallengeView } from "@/lib/house-money/solana/live";
import { usd } from "@/lib/format";
import { Check3 } from "./demo/parts";

type Reason = { label: string; ok: boolean; detail: string };
type Verdict = { accepted: boolean; headline: string; reasons: Reason[] };

const STEP_STEPS = ["Dispute opened", "Detected on-chain", "Grok Bot is reviewing…"];
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
  const [phase, setPhase] = useState<"form" | "reviewing" | "done">("form");
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

  if (phase === "reviewing") {
    return (
      <div className="space-y-5 py-2" role="status" aria-live="polite">
        <p className="font-medium">Grok is reviewing your proof</p>
        <Check3 items={STEP_STEPS} step={step} />
        <p className="text-xs text-muted">Preview: Grok review is not live yet. Simulated on this device. <span className="rounded-md bg-stone px-1.5 py-0.5 text-[10px] uppercase tracking-widest">Preview</span></p>
      </div>
    );
  }

  if (phase === "done" && verdict) {
    return (
      <div className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-forest">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Reviewed by Grok
          </span>
          <span className="rounded-full border border-stone px-2.5 py-0.5 text-xs text-muted">Preview</span>
        </div>
        <div className={`rounded-xl p-4 ${verdict.accepted ? "bg-mint" : "border border-stone"}`}>
          <p className={`text-lg font-medium ${verdict.accepted ? "text-forest" : "text-danger"}`}>{verdict.headline}</p>
          <p className="mt-1 text-sm text-muted">Your goal: {goal} · {usd(stake)} locked</p>
        </div>
        <ul className="divide-y divide-stone" aria-label="Why">
          {verdict.reasons.map((r) => (
            <li key={r.label} className="flex items-start gap-3 py-3 first:pt-0">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${r.ok ? "bg-mint text-forest" : "bg-stone text-danger"}`}>
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
        <p className="text-xs text-muted">Preview only. This verdict is simulated and does not change the result or your money.</p>
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
        <label htmlFor="proof" className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone p-4 text-center text-sm text-muted focus-within:border-forest">
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
        <p className="mt-2 text-xs text-muted">In this preview your screenshot stays on this device.</p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm text-muted">Anything we should know? (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          rows={2}
          className="card w-full px-4 py-3 outline-none focus:border-forest"
        />
      </label>

      <fieldset className="rounded-xl bg-mint p-3">
        <legend className="px-1 text-xs text-muted">Preview control: the verdict to show</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={demoAccepts} onClick={() => setDemoAccepts(true)} className="tile min-h-11 py-2 text-sm">Accepted</button>
          <button type="button" aria-pressed={!demoAccepts} onClick={() => setDemoAccepts(false)} className="tile min-h-11 py-2 text-sm">Not accepted</button>
        </div>
      </fieldset>

      <button onClick={send} disabled={!file} className="btn btn-primary w-full py-4 text-lg">
        {file ? "Send for review" : "Add a screenshot first"}
      </button>
    </div>
  );
}
