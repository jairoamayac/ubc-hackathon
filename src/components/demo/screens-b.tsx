"use client";

// Demo screens, part 2: goal detail, feed, vote, dispute and appeal, results, profile.
// Look: design/kept-v5 ("Lila y mandarina"). Logic and copy rules unchanged from the Forest version.
import { Check, ImagePlus, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FEE_PERCENT, KEEPERS_PERCENT, LEAVE_EARLY_LOSS_PERCENT, PROJECT_NAME } from "@/lib/brand";
import {
  CONFIRMS_NEEDED, FRIENDS, GROUP_NAME, NAMES, onTheLine, pot, results,
} from "@/lib/demo/store";
import { usd } from "../ui";
import { GroupTabs, type ScreenProps } from "./screens-a";
import {
  Avatar, Check3, ChatBubble, DemoBadge, GrokAvatar, Icon3D, LockedPill, ProgressRing, ProofImage, ScreenBody, Sheet,
  StatusChip, TopBar, UrgencyBanner, VerdictCard, VoteBar, Wordmark, timeLeft,
} from "./parts";

const KEPT_BEFORE = { kept: 8, total: 10 };
const whole = (n: number) => usd(n).replace(".00", "");

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
  const approvedCount = voters.filter((v) => v.vote === "Approved").length;

  if (me.stake === 0) {
    return (
      <ScreenBody>
        <TopBar onBack={() => go("home")} title="Your goal" />
        <div className="surface-lilac p-5">
          <Icon3D name="padlock-key" size={96} className="absolute -right-1 -top-1" />
          <p className="pr-24">You have no goal yet. Start one from Home.</p>
        </div>
      </ScreenBody>
    );
  }
  return (
    <ScreenBody>
      <TopBar onBack={() => go("home")} title="Your goal" />
      <section className="surface-lilac p-5" aria-label="Goal">
        <Icon3D name="padlock-key" size={96} className="float absolute -right-1 top-8" />
        <div className="flex items-center justify-between gap-2">
          <LockedPill>Locked</LockedPill>
          <span className="text-sm"><span className="mono">{whole(me.stake)}</span> on the line</span>
        </div>
        <h1 className="mt-3 pr-24 text-[24px] font-medium leading-tight tracking-tight">{me.goal}</h1>
        <div className="mt-3"><StatusChip status={me.status} /></div>
        <div className="mt-3 flex items-center gap-4">
          <ProgressRing percent={pct} label={`${pct}%`} sub="time used" size={120} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm"><Icon3D name="clock" size={26} /> Time left</p>
            <p className="big mt-1 text-[38px]">{s.hoursLeft <= 0 ? "Time is up" : timeLeft(s.hoursLeft).replace(" left", "")}</p>
            <p className="mt-1 text-sm">Ends Sunday, 11:59 pm</p>
          </div>
        </div>
      </section>
      <UrgencyBanner hours={s.stage === "running" ? s.hoursLeft : 99} />

      {canSend && (
        <section className="card space-y-3 p-5" aria-label="Upload proof">
          <h2 className="flex items-center gap-2 text-lg font-medium"><Icon3D name="camera" size={36} /> Upload proof</h2>
          <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed border-lilac bg-lilac-tint px-4 text-sm text-deep">
            <ImagePlus className="h-5 w-5" aria-hidden />
            <span className="truncate">{file ? file.name : "Choose a photo or screenshot"}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
          </label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Your proof, preview" className="max-h-56 w-full rounded-[20px] object-contain" /> : <ProofImage />}
          <p className="text-xs text-muted">{preview ? "Nothing is uploaded in the demo." : "No file chosen: we use a sample screenshot."} <DemoBadge /></p>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="Add a comment (optional)" className="h-12 w-full rounded-2xl bg-stone2 px-4 outline-none focus:ring-2 focus:ring-deep" aria-label="Comment" />
          <button onClick={() => { d({ type: "submitProof", note: note || "Done. 21.1 km, Saturday morning." }); go("feed"); }} className="btn btn-primary w-full py-4 text-lg">Send proof</button>
        </section>
      )}

      {!canSend && s.stage !== "ended" && me.status !== "kept" && (
        <button onClick={() => go(s.stage === "proof" ? "feed" : "dispute")} className="btn btn-ink w-full">
          {s.stage === "proof" ? "Proof sent. See the votes" : s.stage === "disputed" ? "Your proof was disputed" : "See the dispute"}
        </button>
      )}
      {s.stage === "ended" && <button onClick={() => go("results")} className="btn btn-primary w-full py-4 text-lg">See results</button>}

      <div className="grid grid-cols-2 gap-3">
        <section aria-label="Timeline" className="card p-4">
          <h2 className="font-medium">Timeline</h2>
          <ol className="mt-3 space-y-3 border-l border-stone pl-4 text-sm">
            {timeline.length === 0 && <li className="text-muted">Nothing yet.</li>}
            {timeline.map((m) => (
              <li key={m.id} className="relative leading-snug"><span className="absolute -left-[22.5px] top-1 h-3 w-3 rounded-full bg-deep" aria-hidden />{m.text}</li>
            ))}
            <li className="relative leading-snug text-muted"><span className="absolute -left-[22.5px] top-1 h-3 w-3 rounded-full border-2 border-deep bg-white" aria-hidden />Deadline: Sunday</li>
          </ol>
        </section>
        <section aria-label="Friends and votes" className="card p-4">
          <div className="flex items-baseline justify-between"><h2 className="font-medium">Friends</h2><span className="mono text-xs text-muted">{approvedCount} of {voters.length}</span></div>
          <p className="text-xs text-muted">Approved your proof</p>
          <ul className="mt-2 space-y-2">
            {voters.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><Avatar id={v.id} size={28} /> <span className="truncate">{NAMES[v.id]}</span></span>
                {v.vote === "Approved" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-white" aria-label="Approved"><Check className="h-3.5 w-3.5" aria-hidden /></span>
                ) : v.vote === "Disputed" ? (
                  <span className="pill min-h-6 bg-ink px-2 text-xs text-white">Disputed</span>
                ) : (
                  <span className="h-6 w-6 rounded-full border-2 border-dashed border-muted/50" aria-label="Waiting" />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

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
      <h1 className="text-[30px] font-medium leading-tight tracking-tight">{GROUP_NAME}</h1>
      <GroupTabs active="feed" go={go} />
      <div className="flex flex-1 flex-col gap-3" aria-live="polite">
        {s.messages.length === 0 && (
          <div className="card flex items-center gap-3 p-5 text-sm text-muted"><Icon3D name="chat-check" size={56} />Nothing here yet. Proofs, votes and messages from Grok Bot show up as they happen.</div>
        )}
        {s.messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <ChatBubble from={m.from} text={m.text} mine={m.from === "martin"} />
            {m.kind === "proof" && m.from === "martin" && (
              <div className="card ml-auto mr-9 max-w-[82%] space-y-3 p-3">
                <ProofImage />
                <VoteBar approve={s.votes.approve.length} dispute={s.votes.dispute.length} total={total} />
                {s.stage === "proof" && <p className="text-xs text-muted">Waiting for your friends. You can&apos;t vote on your own proof.</p>}
              </div>
            )}
            {m.kind === "proof" && m.from === "ana" && (
              <div className="card ml-9 max-w-[82%] space-y-2 p-3">
                {s.myVote ? (
                  <p className="text-sm text-muted">You {s.myVote === "approve" ? "approved" : "disputed"} this.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => d({ type: "myVote", approve: true })} className="btn btn-approve min-h-11 text-sm"><Check className="h-4 w-4" aria-hidden /> Approve</button>
                    <button onClick={() => d({ type: "myVote", approve: false })} className="btn btn-quiet min-h-11 text-sm">Dispute</button>
                  </div>
                )}
                <button onClick={() => go("vote")} className="min-h-9 text-sm font-medium text-deep underline">Open proof</button>
              </div>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {(s.stage === "disputed" || s.stage === "appeal" || s.stage === "proposed") && <button onClick={() => go("dispute")} className="btn btn-primary w-full py-4 text-lg">Open the dispute</button>}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 7 vote
export function VoteScreen({ s, d, go }: ScreenProps) {
  const approve = 2 + (s.myVote === "approve" ? 1 : 0);
  const dispute = s.myVote === "dispute" ? 1 : 0;
  return (
    <ScreenBody>
      <TopBar onBack={() => go("feed")} backLabel="Back to feed" title="Vote" right={<span className="mono">1 of 2</span>} />
      <header>
        <h1 className="text-[30px] font-medium leading-tight tracking-tight">Did Ana keep it?</h1>
        <p className="mt-1 text-sm text-muted">Gym 4 times this week · session 3</p>
      </header>
      <section className="pastel bg-sky p-5" aria-label="Ana's proof">
        <Icon3D name="camera" size={84} className="float absolute -right-1 bottom-2" />
        <div className="flex items-center gap-2"><Avatar id="ana" size={32} white /><span className="font-medium">Ana&apos;s proof</span><span className="text-sm text-muted">· screenshot</span></div>
        <div className="mt-4 rounded-[20px] bg-white p-4 pr-16">
          <p className="text-sm text-muted">Sessions this week</p>
          <p className="big mt-1 text-[48px]">3 / 4</p>
          <div className="mt-3 flex h-14 items-end gap-1.5" aria-hidden>
            {[40, 70, 0, 85, 0, 0, 0].map((h, i) => <span key={i} className="flex-1 rounded-md" style={{ height: `${Math.max(h, 8)}%`, background: h ? "#2E2260" : "#EEE8FF" }} />)}
          </div>
          <p className="mt-2 text-xs text-muted">Thu, 7:12 am</p>
        </div>
      </section>
      <VoteBar approve={approve} dispute={dispute} total={4} />
      {s.myVote ? (
        <p className="card p-4 text-sm" role="status">You {s.myVote === "approve" ? "approved" : "disputed"} Ana&apos;s proof. Thanks.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => d({ type: "myVote", approve: true })} className="btn btn-approve"><Check className="h-4 w-4" aria-hidden /> Approve</button>
          <button onClick={() => d({ type: "myVote", approve: false })} className="btn btn-quiet">Dispute</button>
        </div>
      )}
      <p className="text-sm text-muted">Only people who put money in vote. If most approve, it counts. If someone disputes, it goes to an appeal.</p>
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 8 dispute and appeal
const STEPS = ["Dispute opened", "Dispute received", "Grok Bot is reviewing…", "Grok Bot proposes", "Decision saved"];
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
        <TopBar onBack={() => go("goal")} title="Appeal" />
        <div className="card flex items-center gap-3 p-5"><Icon3D name="shield-check" size={56} /><p>No dispute right now. If a friend disputes your proof, you can appeal here.</p></div>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <TopBar onBack={() => go("goal")} title={s.stage === "disputed" ? "Run 21 km" : "Appeal"} />
      {s.stage === "disputed" ? (
        <>
          <section className="surface-ink p-5" aria-label="Disputed">
            <Icon3D name="chat-check" size={80} className="absolute -right-1 -top-1" />
            <span className="pill bg-white/10 text-white">Disputed</span>
            <h1 className="mt-3 pr-16 text-[28px] font-medium leading-tight tracking-tight">Your proof was disputed</h1>
            <p className="mt-2 text-sm text-white/80">Your money stays locked until this is resolved.</p>
          </section>
          <section className="card flex items-start gap-3 p-4 text-sm" aria-label="Dispute reason">
            <Avatar id="ben" size={36} />
            <div><p className="font-medium">Ben disputed it</p><p className="mt-1 text-muted">&ldquo;{s.disputeReason}&rdquo;</p></div>
          </section>
          <ProofImage />
          <section className="card space-y-3 p-5" aria-label="Appeal with Grok">
            <h2 className="flex items-center gap-2 font-medium"><GrokAvatar size={24} /> Appeal with Grok</h2>
            <p className="text-sm text-muted">Add a screenshot or any proof. Grok Bot checks distance, date and route and proposes a verdict. Your group confirms it.</p>
            <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed border-lilac bg-lilac-tint px-4 text-sm text-deep">
              <Plus className="h-5 w-5" aria-hidden />
              <span>{shot ? "Screenshot added" : "Add a screenshot (optional)"}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            </label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {shot && <img src={shot} alt="Your screenshot, preview" className="max-h-48 w-full rounded-[20px] object-contain" />}
            <button onClick={() => d({ type: "appeal" })} className="btn btn-primary w-full py-4 text-lg">Appeal with Grok</button>
            <p className="text-xs text-muted">Simulated for the demo. Nothing is uploaded. <DemoBadge /></p>
          </section>
        </>
      ) : (
        <>
          {s.disputeStep < 3 && !(s.stage === "resolved" || s.stage === "ended") ? (
            <section className="surface-ink p-5" aria-label="Grok Bot is reviewing">
              <Icon3D name="clock" size={80} className="float absolute -right-1 -top-1" />
              <span className="pill bg-white/10 text-lilac"><GrokAvatar size={18} /> Grok</span>
              <h1 className="mt-3 pr-16 text-[28px] font-medium leading-tight tracking-tight">Grok Bot is on it</h1>
              <p className="mt-1 text-sm text-white/75">Usually under a minute.</p>
              <div className="mt-4"><Check3 items={["Distance", "Date", "Route"]} step={checksShown} dark /></div>
            </section>
          ) : (
            <h1 className="text-[28px] font-medium leading-tight tracking-tight">{s.stage === "resolved" || s.stage === "ended" ? "Decision saved" : "Grok Bot made a proposal"}</h1>
          )}
          {s.disputeStep >= 3 && <VerdictCard confidence={92} reasons={REASONS} confirms={confirmed} needed={CONFIRMS_NEEDED} total={friends.length} />}
          <ol className="card space-y-3 p-5" aria-label="Dispute steps">
            {STEPS.map((label, i) => {
              const done = s.disputeStep >= (i < 3 ? i + 1 : i);
              const active = !done && s.disputeStep === i;
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${done ? "border-deep bg-deep text-white" : "border-stone text-muted"}`}>
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  </span>
                  <span className={done || active ? "text-ink" : "text-muted"}>{label}</span>
                </li>
              );
            })}
          </ol>
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
                        <span className="pill min-h-7 bg-forest text-white"><Check className="h-3.5 w-3.5" aria-hidden /> Confirmed</span>
                      ) : s.stage === "proposed" ? (
                        <span className="flex items-center gap-2">
                          <button onClick={() => d({ type: "confirm", id })} className="btn btn-approve btn-sm min-h-9 px-3 text-sm" aria-label={`Confirm as ${NAMES[id]}`}>Confirm</button>
                          <button onClick={() => d({ type: "reject", id })} className="btn btn-quiet btn-sm min-h-9 px-3 text-sm" aria-label={`Reject as ${NAMES[id]}`}>Reject</button>
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
          {(s.stage === "resolved" || s.stage === "ended") && <button onClick={() => go(s.stage === "ended" ? "results" : "goal")} className={`btn w-full py-4 text-lg ${s.stage === "ended" ? "btn-primary" : "btn-ink"}`}>{s.stage === "ended" ? "See results" : "Back to my goal"}</button>}
        </>
      )}
    </ScreenBody>
  );
}

// -------------------------------------------------------------------- 9 results
export function ResultsScreen({ s, d, go }: ScreenProps) {
  const [receipt, setReceipt] = useState(false);
  const r = useMemo(() => results(s), [s]);
  const mine = r.payouts.find((p) => p.id === "martin");
  const confetti = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 0.08, color: ["#FF7A3D", "#B9A4FF", "#1A1A18", "#FFF0BF"][i % 4] })), []);

  if (s.stage !== "ended" || !mine) {
    return (
      <ScreenBody>
        <TopBar onBack={() => go("group")} backLabel={`Back to ${GROUP_NAME}`} title="Results" />
        <div className="card flex items-center gap-3 p-5 text-muted"><Icon3D name="trophy" size={64} /><p>Results show up when time is up and every dispute is resolved. Use the demo control below to jump to the deadline.</p></div>
      </ScreenBody>
    );
  }
  const gain = mine.payout - mine.stake;
  const keeperShare = r.forfeited > 0 ? (r.toKeepers / r.forfeited) * 100 : KEEPERS_PERCENT;
  return (
    <ScreenBody>
      {!s.collected && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[480px] overflow-hidden">
          {confetti.map((c, i) => <span key={i} className="confetti" style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s` }} />)}
        </div>
      )}
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="text-sm text-muted">{GROUP_NAME}</span>
      </header>
      <section className="surface-mandarina p-5" aria-label="Your result">
        <Icon3D name="trophy" size={104} className="float absolute -right-1 -top-1" />
        <Icon3D name="coins-stack" size={72} className="float-slow absolute bottom-2 right-3" />
        <h1 className="pr-24 text-[32px] font-medium leading-tight tracking-tight">You kept your word.</h1>
        <p className="pr-24 text-sm">{s.people.find((p) => p.id === "martin")?.goal}</p>
        <p className="big mt-3 text-[64px]">{usd(mine.payout)}</p>
        <div className="mt-3 flex flex-wrap gap-2 pr-16">
          <span className="pill bg-white text-ink">{usd(mine.stake)} back</span>
          <span className="pill bg-ink text-white">{usd(gain, { sign: true })} share</span>
        </div>
      </section>
      <div className="grid grid-cols-[1.25fr_1fr] gap-3">
        <section className="card p-4 text-sm" aria-label="Who gets what">
          <ul className="space-y-3">
            {r.payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2"><Avatar id={p.id as never} size={28} /><span className="min-w-0"><span className="block truncate font-medium">{p.id === "martin" ? "You" : NAMES[p.id as keyof typeof NAMES]}</span><span className="block whitespace-nowrap text-xs text-muted">{whole(p.stake)} stake</span></span></span>
                <span className={`pill min-h-7 shrink-0 px-2.5 text-xs ${p.kept ? "bg-forest text-white" : "bg-stone text-ink"}`}>{p.kept ? "Kept" : "Missed"}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface-ink flex flex-col p-4 text-sm" aria-label="Forfeited">
          <p className="text-white/75">Forfeited</p>
          <p className="big mt-1 text-[36px] text-lilac">{whole(r.forfeited)}</p>
          <div className="mt-auto pt-4">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden><span className="bg-lilac" style={{ width: `${keeperShare}%` }} /></div>
            <p className="mt-2 leading-snug"><span className="mono">{usd(r.toKeepers)}</span> to the friends who kept their word</p>
            <p className="mt-1 leading-snug text-white/75"><span className="mono">{usd(r.fee)}</span> to {PROJECT_NAME} ({FEE_PERCENT}%)</p>
          </div>
        </section>
      </div>
      <p className="text-xs text-muted">Check: {usd(r.payouts.reduce((n, p) => n + p.payout, 0))} paid out + {usd(r.fee)} fee = {usd(r.total)} in the pot.</p>
      {s.collected ? (
        <p className="card p-4 text-sm" role="status">Collected. Your balance is {usd(s.balance)}.</p>
      ) : (
        <button onClick={() => d({ type: "collect" })} className="btn btn-primary w-full py-4 text-lg">Collect {usd(mine.payout)}</button>
      )}
      <button onClick={() => setReceipt(true)} className="min-h-11 self-center font-medium underline underline-offset-4">View receipt</button>
      {receipt && (
        <Sheet title="Receipt" onClose={() => setReceipt(false)}>
          <dl className="space-y-2 text-sm">
            {[["Group", GROUP_NAME], ["Pot", usd(pot(s))], ["Platform fee", `${usd(r.fee)} (${FEE_PERCENT}%)`], ["Paid to you", usd(mine.payout)], ["Decided by", "3 of 4 friends confirmed Grok Bot's proposal"], ["Saved", "Demo receipt. In the real app the decision is saved with the result."]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted"><DemoBadge /> Nothing here uses real money.</p>
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
      <header className="flex items-center gap-3">
        <Avatar id="martin" size={64} />
        <div><h1 className="text-[28px] font-medium leading-tight tracking-tight">Martin</h1><p className="text-sm text-muted">{s.email || "martin@example.com"} · 1 group</p></div>
      </header>
      <div className="grid grid-cols-[1.3fr_1fr] gap-3">
        <section className="surface-lilac p-4" aria-label="Balance">
          <Icon3D name="piggy-bank" size={84} className="float absolute -right-2 -top-2" />
          <p className="mt-12 text-sm">Your money</p>
          <p className="big mt-1 text-[36px]">{usd(s.balance + onTheLine(s))}</p>
          <p className="mt-1 text-xs">Free {usd(s.balance)} · on the line {usd(onTheLine(s))}</p>
        </section>
        <div className="grid gap-3">
          <section className="surface-ink p-4" aria-label="Kept rate">
            <Icon3D name="trophy" size={44} className="absolute -right-1 -top-1" />
            <p className="big text-[30px] text-lilac">{Math.round((kept / total) * 100)}%</p>
            <p className="text-xs text-white/75">Kept rate <DemoBadge /></p>
          </section>
          <section className="pastel bg-peach p-4" aria-label="Goals kept">
            <p className="big text-[26px]">{kept} of {total}</p>
            <p className="text-xs">Goals kept</p>
          </section>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setSheet("add")} className="btn btn-ink"><Plus className="h-4 w-4" aria-hidden /> Add funds</button>
        <button onClick={() => setSheet("out")} className="btn btn-quiet">Withdraw</button>
      </div>
      <section aria-label="History" className="card p-4">
        <h2 className="mb-1 text-lg font-medium">History</h2>
        <ul className="divide-y divide-stone">
          {s.history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{h.text}</span><span className={`mono ${h.amount >= 0 ? "text-forest" : "text-ink"}`}>{usd(h.amount, { sign: true })}</span></li>
          ))}
        </ul>
      </section>
      {sheet && (
        <Sheet title={sheet === "add" ? "Add funds" : "Withdraw"} onClose={() => setSheet(null)}>
          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100].map((v) => <button key={v} onClick={() => setAmount(v)} aria-pressed={amount === v} className="tile min-h-12 font-medium">${v}</button>)}
          </div>
          {sheet === "add" ? (
            <div className="mt-4 space-y-2">
              <button onClick={() => { d({ type: "addFunds", amount }); setSheet(null); }} className="btn btn-ink w-full rounded-full bg-black py-4 text-lg text-white">Add {usd(amount)} with Pay</button>
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
