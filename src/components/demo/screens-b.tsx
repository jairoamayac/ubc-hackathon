"use client";

// Demo screens, part 2: goal detail, feed, vote, dispute and appeal, results, profile.
import { Check, ImagePlus, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FEE_PERCENT, LEAVE_EARLY_LOSS_PERCENT, PLATFORM_YIELD_PERCENT, PROJECT_NAME } from "@/lib/brand";
import {
  CONFIRMS_NEEDED, FRIENDS, GROUP_NAME, NAMES, onTheLine, pot, results, yieldFor,
} from "@/lib/demo/store";
import { usd } from "../ui";
import type { ScreenProps } from "./screens-a";
import {
  Avatar, Back, Check3, ChatBubble, DemoBadge, GrokAvatar, ProgressRing, ProofImage, ScreenBody, Sheet,
  StatusChip, UrgencyBanner, VerdictCard, VoteBar, timeLeft,
} from "./parts";

const KEPT_BEFORE = { kept: 8, total: 10 };

// -------------------------------------------------------------------- 5 goal detail
export function GoalScreen({ s, d, go }: ScreenProps) {
  const me = s.people.find((p) => p.id === "martin")!;
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [leave, setLeave] = useState(false);
  const urlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const choose = (f: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f ? URL.createObjectURL(f) : null;
    setFile(f);
    setPreview(urlRef.current);
  };
  const pct = s.stage === "ended" ? 100 : Math.round(((72 - s.hoursLeft) / 72) * 100);
  const canSend = s.stage === "running";
  const timeline = s.messages.filter((m) => m.kind === "system" || m.kind === "grok" || (m.kind === "proof" && m.from === "martin"));
  const voters = FRIENDS.map((id) => ({ id, vote: s.votes.approve.includes(id) ? "Approved" : s.votes.dispute.includes(id) ? "Disputed" : "Waiting" }));

  if (me.stake === 0) {
    return (
      <ScreenBody>
        <Back onClick={() => go("home")} />
        <p className="card p-5">You have no goal yet. Start one from Home.</p>
      </ScreenBody>
    );
  }
  return (
    <ScreenBody>
      <Back onClick={() => go("home")} />
      <header>
        <h1 className="text-[28px] font-medium leading-tight tracking-tight">{me.goal}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted"><span className="pill-locked">Locked {usd(me.stake)}</span> <StatusChip status={me.status} /></p>
      </header>
      <UrgencyBanner hours={s.stage === "running" ? s.hoursLeft : 99} />
      <ProgressRing percent={pct} label={timeLeft(s.hoursLeft)} sub={`${pct}% of the time used`} />

      {canSend && (
        <section className="card space-y-3 p-5" aria-label="Upload proof">
          <h2 className="font-medium">Upload proof</h2>
          <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone px-4 text-sm text-muted">
            <ImagePlus className="h-5 w-5 text-forest" aria-hidden />
            <span className="truncate">{file ? file.name : "Choose a photo or screenshot"}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
          </label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Your proof, preview" className="max-h-56 w-full rounded-xl border border-stone object-contain" /> : <ProofImage />}
          <p className="text-xs text-muted">{preview ? "Nothing is uploaded in the demo." : "No file chosen: we use a sample screenshot."} <DemoBadge /></p>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="Add a comment (optional)" className="card w-full px-4 py-3 outline-none focus:border-forest" aria-label="Comment" />
          <button onClick={() => { d({ type: "submitProof", note: note || "Done. 21.1 km, Saturday morning." }); go("feed"); }} className="btn btn-primary w-full">Send proof</button>
        </section>
      )}

      {!canSend && s.stage !== "ended" && me.status !== "kept" && (
        <button onClick={() => go(s.stage === "proof" ? "feed" : "dispute")} className="btn btn-quiet w-full">
          {s.stage === "proof" ? "Proof sent. See the votes" : s.stage === "disputed" ? "Your proof was disputed" : "See the dispute"}
        </button>
      )}
      {s.stage === "ended" && <button onClick={() => go("results")} className="btn btn-primary w-full">See results</button>}

      <section aria-label="Friends and votes" className="card p-5">
        <h2 className="font-medium">Friends and votes</h2>
        <ul className="mt-3 divide-y divide-stone">
          {voters.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2"><Avatar id={v.id} size={28} /> {NAMES[v.id]}</span>
              <span className={`text-sm ${v.vote === "Approved" ? "text-forest" : v.vote === "Disputed" ? "text-danger" : "text-muted"}`}>{v.vote}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Timeline" className="card p-5">
        <h2 className="font-medium">Timeline</h2>
        <ol className="mt-3 space-y-3 border-l border-stone pl-4 text-sm">
          {timeline.length === 0 && <li className="text-muted">Nothing yet.</li>}
          {timeline.map((m) => (
            <li key={m.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-forest" aria-hidden />{m.text}</li>
          ))}
        </ol>
      </section>

      {s.stage !== "ended" && (
        <button onClick={() => setLeave(true)} className="min-h-11 self-start text-sm text-muted underline">Leaving early costs {LEAVE_EARLY_LOSS_PERCENT}%</button>
      )}
      {leave && (
        <Sheet title="Leave early?" onClose={() => setLeave(false)}>
          <p className="text-muted">If you walk away before the deadline, you lose {LEAVE_EARLY_LOSS_PERCENT}% of your stake, {usd((me.stake * LEAVE_EARLY_LOSS_PERCENT) / 100)}. It goes to the pot and is shared with the friends who keep their word. You get the other {usd((me.stake * (100 - LEAVE_EARLY_LOSS_PERCENT)) / 100)} back.</p>
          <p className="mt-3 text-sm text-muted">Suggested rule, not final. <DemoBadge>Not in this walkthrough</DemoBadge></p>
          <button onClick={() => setLeave(false)} className="btn btn-primary mt-5 w-full">Keep going</button>
        </Sheet>
      )}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 6 feed
export function FeedScreen({ s, d, go }: ScreenProps) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [s.messages.length]);
  const total = FRIENDS.length;
  return (
    <ScreenBody>
      <Back onClick={() => go("group")} label={GROUP_NAME} />
      <h1 className="text-[28px] font-medium leading-tight tracking-tight">Group feed</h1>
      <div className="flex flex-1 flex-col gap-3" aria-live="polite">
        {s.messages.length === 0 && <p className="card p-5 text-sm text-muted">Nothing here yet. Proofs, votes and messages from Grok Bot show up as they happen.</p>}
        {s.messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <ChatBubble from={m.from} text={m.text} mine={m.from === "martin"} />
            {m.kind === "proof" && m.from === "martin" && (
              <div className="ml-9 max-w-[78%] space-y-2">
                <ProofImage />
                <VoteBar approve={s.votes.approve.length} dispute={s.votes.dispute.length} total={total} />
                {s.stage === "proof" && <p className="text-xs text-muted">Waiting for your friends. You can&apos;t vote on your own proof.</p>}
              </div>
            )}
            {m.kind === "proof" && m.from === "ana" && (
              <div className="ml-9 max-w-[78%] space-y-2">
                {s.myVote ? (
                  <p className="text-sm text-muted">You {s.myVote === "approve" ? "approved" : "disputed"} this.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => d({ type: "myVote", approve: true })} className="btn btn-quiet min-h-11 text-sm"><Check className="h-4 w-4" aria-hidden /> Approve</button>
                    <button onClick={() => d({ type: "myVote", approve: false })} className="btn btn-quiet min-h-11 text-sm">Dispute</button>
                  </div>
                )}
                <button onClick={() => go("vote")} className="min-h-9 text-sm text-forest underline">Open proof</button>
              </div>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {(s.stage === "disputed" || s.stage === "appeal" || s.stage === "proposed") && <button onClick={() => go("dispute")} className="btn btn-primary w-full">Open the dispute</button>}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 7 vote
export function VoteScreen({ s, d, go }: ScreenProps) {
  const approve = 2 + (s.myVote === "approve" ? 1 : 0);
  const dispute = s.myVote === "dispute" ? 1 : 0;
  return (
    <ScreenBody>
      <Back onClick={() => go("feed")} label="Feed" />
      <header className="flex items-center gap-3"><Avatar id="ana" size={44} /><div><h1 className="text-[26px] font-medium leading-tight tracking-tight">Ana&apos;s proof</h1><p className="text-sm text-muted">Gym 4 times this week · session 3</p></div></header>
      <div className="rounded-xl border border-stone bg-mint p-6 text-center">
        <p className="text-[56px] font-medium leading-none tabular-nums text-forest">3 / 4</p>
        <p className="mt-2 text-sm text-muted">sessions logged this week · Thu, 7:12 am</p>
      </div>
      <VoteBar approve={approve} dispute={dispute} total={4} />
      {s.myVote ? (
        <p className="card p-4 text-sm" role="status">You {s.myVote === "approve" ? "approved" : "disputed"} Ana&apos;s proof. Thanks.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => d({ type: "myVote", approve: true })} className="btn btn-primary">Approve</button>
          <button onClick={() => d({ type: "myVote", approve: false })} className="btn btn-quiet">Dispute</button>
        </div>
      )}
      <p className="text-sm text-muted">Only people who put money in vote. If most approve, it counts. If someone disputes, it goes to an appeal.</p>
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 8 dispute and appeal
const STEPS = ["Dispute opened", "Detected on-chain", "Grok Bot is reviewing…", "Grok Bot proposes", "Resolved on-chain"];
const REASONS = [
  { label: "Distance matches", detail: "21.1 km on the activity, above the 21 km goal." },
  { label: "Date is inside the window", detail: "Saturday, before the Sunday deadline." },
  { label: "Route looks real", detail: "A loop that closes, with a steady pace and no jumps." },
];

export function DisputeScreen({ s, d, go }: ScreenProps) {
  const [shot, setShot] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const choose = (f: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f ? URL.createObjectURL(f) : null;
    setShot(urlRef.current);
  };
  const [checks, setChecks] = useState(0);
  const reviewing = s.stage === "appeal" && s.disputeStep === 2;
  useEffect(() => {
    if (!reviewing) return;
    const t = setInterval(() => setChecks((c) => Math.min(3, c + 1)), 650);
    return () => { clearInterval(t); };
  }, [reviewing]);
  const checksShown = s.disputeStep >= 3 ? 3 : reviewing ? checks : 0;
  const friends = FRIENDS;
  const confirmed = s.confirms.length;

  if (s.stage === "running" || s.stage === "proof" || s.stage === "joining" || s.stage === "empty") {
    return (
      <ScreenBody>
        <Back onClick={() => go("goal")} />
        <p className="card p-5">No dispute right now. If a friend disputes your proof, you can appeal here.</p>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <Back onClick={() => go("goal")} />
      {s.stage === "disputed" ? (
        <>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">Your proof was disputed</h1>
          <p className="text-muted">{s.disputeReason}</p>
          <ProofImage />
          <section className="card space-y-3 p-5" aria-label="Appeal with Grok">
            <h2 className="flex items-center gap-2 font-medium"><GrokAvatar size={24} /> Appeal with Grok</h2>
            <p className="text-sm text-muted">Add a screenshot or any proof. Grok Bot checks distance, date and route and proposes a verdict. Your group confirms it.</p>
            <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone px-4 text-sm text-muted">
              <ImagePlus className="h-5 w-5 text-forest" aria-hidden />
              <span>{shot ? "Screenshot added" : "Add a screenshot (optional)"}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            </label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {shot && <img src={shot} alt="Your screenshot, preview" className="max-h-48 w-full rounded-xl border border-stone object-contain" />}
            <button onClick={() => d({ type: "appeal" })} className="btn btn-primary w-full">Appeal with Grok</button>
            <p className="text-xs text-muted">Simulated for the demo. Nothing is uploaded. <DemoBadge /></p>
          </section>
        </>
      ) : (
        <>
          <h1 className="text-[28px] font-medium leading-tight tracking-tight">{s.stage === "resolved" || s.stage === "ended" ? "Resolved on-chain" : s.disputeStep < 3 ? "Grok Bot is on it" : "Grok Bot made a proposal"}</h1>
          <ol className="card space-y-3 p-5" aria-label="Dispute steps">
            {STEPS.map((label, i) => {
              const done = s.disputeStep >= (i < 3 ? i + 1 : i);
              const active = !done && s.disputeStep === i;
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-forest bg-forest text-white" : "border-stone text-muted"}`}>
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  </span>
                  <span className={done || active ? "text-ink" : "text-muted"}>{label}</span>
                </li>
              );
            })}
          </ol>
          {(reviewing || s.disputeStep >= 3) && (
            <section className="card p-5" aria-label="Checks">
              <p className="mb-3 flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-forest" aria-hidden /> What Grok Bot checks</p>
              <Check3 items={["Distance", "Date", "Route"]} step={checksShown} />
            </section>
          )}
          {s.disputeStep >= 3 && <VerdictCard confidence={92} reasons={REASONS} confirms={confirmed} needed={CONFIRMS_NEEDED} total={friends.length} />}
          {s.disputeStep >= 3 && (
            <section className="card p-5" aria-label="Group confirmations">
              <h2 className="font-medium">Group confirmations</h2>
              <ul className="mt-3 divide-y divide-stone">
                {friends.map((id) => {
                  const ok = s.confirms.includes(id);
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2"><Avatar id={id} size={28} /> {NAMES[id]}</span>
                      {ok ? (
                        <span className="text-sm text-forest">Confirmed</span>
                      ) : s.stage === "proposed" ? (
                        <span className="flex items-center gap-2">
                          <button onClick={() => d({ type: "confirm", id })} className="btn btn-quiet min-h-9 px-3 text-sm" aria-label={`Confirm as ${NAMES[id]}`}>Confirm</button>
                          <button onClick={() => d({ type: "reject", id })} className="btn btn-quiet min-h-9 px-3 text-sm" aria-label={`Reject as ${NAMES[id]}`}>Reject</button>
                        </span>
                      ) : (
                        <span className="text-sm text-muted">Not needed</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {s.stage === "proposed" && <p className="mt-3 text-xs text-muted">Friends tap these in the real app. Here you play them. <DemoBadge /></p>}
            </section>
          )}
          {(s.stage === "resolved" || s.stage === "ended") && <button onClick={() => go(s.stage === "ended" ? "results" : "goal")} className="btn btn-primary w-full">{s.stage === "ended" ? "See results" : "Back to my goal"}</button>}
        </>
      )}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 9 results
export function ResultsScreen({ s, d, go }: ScreenProps) {
  const [receipt, setReceipt] = useState(false);
  const r = useMemo(() => results(s), [s]);
  const y = useMemo(() => yieldFor(s), [s]);
  const mine = r.payouts.find((p) => p.id === "martin");
  const confetti = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 6) * 0.08, color: ["#1F5F4A", "#5FA98A", "#DDEFE5"][i % 3] })), []);

  if (s.stage !== "ended" || !mine) {
    return (
      <ScreenBody>
        <Back onClick={() => go("group")} label={GROUP_NAME} />
        <h1 className="text-[28px] font-medium leading-tight tracking-tight">Results</h1>
        <p className="card p-5 text-muted">Results show up when time is up and every dispute is resolved. Use the demo control below to jump to the deadline.</p>
      </ScreenBody>
    );
  }
  const gain = mine.payout - mine.stake;
  return (
    <ScreenBody>
      {!s.collected && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[480px] overflow-hidden">
          {confetti.map((c, i) => <span key={i} className="confetti" style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s` }} />)}
        </div>
      )}
      <Back onClick={() => go("group")} label={GROUP_NAME} />
      <header>
        <p className="text-sm text-muted">{GROUP_NAME}</p>
        <h1 className="text-[34px] font-medium leading-tight tracking-tight">You kept your word.</h1>
        <p className="mt-1 text-muted">{usd(mine.stake)} becomes {usd(mine.payout)}. That is {usd(gain, { sign: true })}.</p>
      </header>
      <section className="rounded-xl bg-mint p-4 text-sm" aria-label="Who gets what">
        <p className="font-medium">{usd(r.forfeited)} was left behind. {usd(r.toKeepers)} goes to the friends who kept their word and {usd(r.fee)} to {PROJECT_NAME} ({FEE_PERCENT}%).</p>
        <ul className="mt-3 divide-y divide-stone">
          {r.payouts.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2"><Avatar id={p.id as never} size={28} /><span><span className="block font-medium">{p.id === "martin" ? "You" : NAMES[p.id as keyof typeof NAMES]}</span><span className={`block ${p.kept ? "text-forest" : "text-danger"}`}>{p.kept ? "Kept it" : "Walked away"}</span></span></span>
              <span className="shrink-0 text-right tabular-nums"><span className="block text-muted">{usd(p.stake)} in</span><span className="block font-medium">{usd(p.payout)} out</span></span>
            </li>
          ))}
          <li className="flex items-center justify-between py-2"><span className="font-medium">{PROJECT_NAME}</span><span className="tabular-nums"><span className="text-muted">{FEE_PERCENT}% fee</span> <span className="font-medium">{usd(r.fee)}</span></span></li>
        </ul>
        <p className="mt-2 text-xs text-muted">Check: {usd(r.payouts.reduce((n, p) => n + p.payout, 0))} paid out + {usd(r.fee)} fee = {usd(r.total)} in the pot.</p>
      </section>
      <section className="card p-4 text-sm" aria-label="Yield">
        <p className="font-medium">Yield while locked <DemoBadge>Simulated</DemoBadge></p>
        <p className="mt-1 text-muted">About {usd(y.total)} over 5 days at 4% a year. {PLATFORM_YIELD_PERCENT}% of it ({usd(y.platform)}) is the platform&apos;s share. Tiny on purpose: the real money is in the stakes.</p>
      </section>
      {s.collected ? (
        <p className="card p-4 text-sm" role="status">Collected. Your balance is {usd(s.balance)}.</p>
      ) : (
        <button onClick={() => d({ type: "collect" })} className="btn btn-primary w-full py-4 text-lg">Collect {usd(mine.payout)}</button>
      )}
      <button onClick={() => setReceipt(true)} className="btn btn-quiet w-full">View receipt</button>
      {receipt && (
        <Sheet title="Receipt" onClose={() => setReceipt(false)}>
          <dl className="space-y-2 text-sm">
            {[["Group", GROUP_NAME], ["Pot", usd(pot(s))], ["Platform fee", `${usd(r.fee)} (${FEE_PERCENT}%)`], ["Paid to you", usd(mine.payout)], ["Decided by", "3 of 4 friends confirmed Grok Bot's proposal"], ["Recorded", "Demo receipt. In the real app this links to the public record."]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted"><DemoBadge /> Nothing here is on a real network.</p>
        </Sheet>
      )}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 10 profile
export function ProfileScreen({ s, d }: Pick<ScreenProps, "s" | "d">) {
  const [sheet, setSheet] = useState<null | "add" | "out">(null);
  const [amount, setAmount] = useState(50);
  const kept = KEPT_BEFORE.kept + (s.stage === "ended" ? 1 : 0);
  const total = KEPT_BEFORE.total + (s.stage === "ended" ? 1 : 0);
  return (
    <ScreenBody>
      <header className="flex items-center gap-3"><Avatar id="martin" size={48} /><div><h1 className="text-[26px] font-medium leading-tight tracking-tight">Martin</h1><p className="text-sm text-muted">{s.email || "martin@example.com"}</p></div></header>
      <section className="card p-5" aria-label="Balance">
        <p className="text-sm text-muted">Your money</p>
        <p className="mt-1 text-[36px] font-medium leading-none tracking-tight tabular-nums">{usd(s.balance + onTheLine(s))}</p>
        <p className="mt-2 text-sm text-muted">Free {usd(s.balance)} · on the line {usd(onTheLine(s))}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => setSheet("add")} className="btn btn-primary">Add funds</button>
          <button onClick={() => setSheet("out")} className="btn btn-quiet">Withdraw</button>
        </div>
      </section>
      <section className="card p-5" aria-label="Kept rate">
        <p className="text-sm text-muted">Kept rate <DemoBadge /></p>
        <p className="mt-1 text-[36px] font-medium leading-none tracking-tight tabular-nums">{Math.round((kept / total) * 100)}%</p>
        <p className="mt-2 text-sm text-muted">{kept} of {total} goals kept</p>
        <div className="bar mt-3" aria-hidden><span style={{ width: `${(kept / total) * 100}%` }} /></div>
      </section>
      <section aria-label="History">
        <h2 className="mb-2 text-lg font-medium">History</h2>
        <ul className="card divide-y divide-stone">
          {s.history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span>{h.text}</span><span className={`tabular-nums ${h.amount >= 0 ? "text-forest" : "text-ink"}`}>{usd(h.amount, { sign: true })}</span></li>
          ))}
        </ul>
      </section>
      {sheet && (
        <Sheet title={sheet === "add" ? "Add funds" : "Withdraw"} onClose={() => setSheet(null)}>
          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100].map((v) => <button key={v} onClick={() => setAmount(v)} aria-pressed={amount === v} className="tile min-h-12">${v}</button>)}
          </div>
          {sheet === "add" ? (
            <div className="mt-4 space-y-2">
              <button onClick={() => { d({ type: "addFunds", amount }); setSheet(null); }} className="btn w-full bg-black py-4 text-lg text-white">Add {usd(amount)} with Pay</button>
              <button onClick={() => { d({ type: "addFunds", amount }); setSheet(null); }} className="btn btn-quiet w-full py-4">Add {usd(amount)} with card</button>
              <p className="text-xs text-muted">Both are simulated. <DemoBadge /></p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <button disabled={amount > s.balance} onClick={() => setSheet(null)} className="btn btn-primary w-full py-4">{amount > s.balance ? "Not enough free money" : `Withdraw ${usd(amount)}`}</button>
              <p className="text-xs text-muted">Simulated: nothing leaves the demo. <DemoBadge /></p>
            </div>
          )}
        </Sheet>
      )}
    </ScreenBody>
  );
}
