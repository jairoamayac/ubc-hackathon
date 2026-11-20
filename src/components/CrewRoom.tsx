"use client";

// A group: the people, their money, and pacts. In a pact each person locks money on their own goal;
// when time is up the people who put money in confirm who kept their word. Walk away and you lose it:
// the friends who kept theirs get the rest after a small platform fee (see FEE_PERCENT in lib/brand).
// Everything here is sponsored, with no wallet in sight.
import { Check, Clock, Link2, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { ChallengeView, CrewDetail, CrewView, LiveClient, Snapshot } from "@/lib/house-money/solana/live";
import * as hm from "@/lib/house-money/solana/hm";
import { FEE_PERCENT, KEEPERS_PERCENT, PROJECT_NAME, STAKE_SUGGESTED_MIN, STAKE_WARN_MULTIPLE } from "@/lib/brand";
import { coachGoal } from "@/lib/coach";
import { AppealSheet } from "./AppealSheet";
import { VerifySheet } from "./VerifySheet";
import { StakePicker } from "./StakePicker";
import { BackButton, Dialog, type Act } from "./CrewsApp";
import { usd } from "@/lib/format";

type RoomSheet = null | { id: "start" } | { id: "join"; pact: ChallengeView } | { id: "appeal"; pact: ChallengeView } | { id: "verify"; pact: ChallengeView };

const GOAL_IDEAS = ["Run 21 km by Sunday", "Gym 3 times this week", "No takeout for 7 days", "In bed before midnight, all week"];
const DURATIONS: [string, number][] = [["2 minutes", 2], ["1 hour", 60], ["Tonight", 360], ["1 day", 1440], ["3 days", 4320], ["1 week", 10080]];

export function CrewRoom(props: {
  client: LiveClient;
  crew: CrewView;
  snap: Snapshot;
  now: number;
  busy: string | null;
  value: number;
  act: Act;
  onBack: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { client, crew, now, busy, act } = props;
  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [sheet, setSheet] = useState<RoomSheet>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await client.crewDetail(crew.address));
    } catch {
      /* the parent's refresh shows network errors */
    }
  }, [client, crew.address]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 8_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const run: Act = async (label, fn, done) => {
    const ok = await act(label, fn, done);
    await load();
    return ok;
  };

  const me = crew.me;
  // Money locked on goals still counts as yours until your friends confirm.
  const locked = detail
    ? detail.challenges.reduce((s, c) => {
        if (!c.mine || c.mine.entry.claimed) return s;
        const settled = c.challenge.participants > 0 && c.challenge.decided === c.challenge.participants;
        return s + (settled ? c.mine.payoutUsd : c.mine.usd);
      }, 0)
    : 0;
  const pacts = detail?.challenges ?? [];

  const invite = async () => {
    const url = `${location.origin}/?crew=${crew.address.toBase58()}`;
    try {
      if (navigator.share) await navigator.share({ title: `Join ${crew.name} on ${PROJECT_NAME}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* the person closed the share sheet */
    }
  };

  return (
    <div className="enter flex flex-1 flex-col gap-4 px-5 pb-8 pt-6">
      {celebrate > 0 && <Confetti key={celebrate} />}
      <div className="flex items-center justify-between">
        <BackButton onClick={props.onBack} />
        <button onClick={invite} className="flex min-h-11 items-center gap-1.5 rounded-full border border-stone px-4 text-sm font-medium">
          <Link2 className="h-4 w-4" aria-hidden /> {copied ? "Link copied" : "Invite"}
        </button>
      </div>

      <header>
        <h1 className="flex items-center gap-2 text-[30px] font-medium leading-tight tracking-tight"><span className="dot" aria-hidden /> {crew.name}</h1>
        <p className="text-sm text-muted">{crew.members} {crew.members === 1 ? "person" : "people"} · {pacts.length} {pacts.length === 1 ? "pact" : "pacts"}</p>
      </header>

      <section aria-labelledby="mine-title" className="card p-5">
        <h2 id="mine-title" className="text-sm text-muted">{me ? "Your money here" : "In this group"}</h2>
        <p className="mt-1 text-[36px] font-medium leading-none tracking-tight tabular-nums">{usd(me ? props.value + locked : crew.vault)}</p>
        {me && locked > 0 && <p className="mt-3"><span className="pill-locked">Locked {usd(locked)}</span></p>}
        {detail && detail.people.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="People in this group">
            {detail.people.map((p) => (
              <li key={p.owner.toBase58()} className={`rounded-full border px-3 py-1 text-sm ${p.isMe ? "border-forest text-forest" : "border-stone"}`}>{p.name}</li>
            ))}
          </ul>
        )}
        {me ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={props.onDeposit} className="btn btn-primary">Add money</button>
            <button onClick={props.onWithdraw} className="btn btn-quiet">Take out</button>
          </div>
        ) : (
          <button onClick={props.onDeposit} className="btn btn-primary mt-5 w-full">Join with money</button>
        )}
      </section>

      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-lg font-medium">Pacts</h2>
        {me && (
          <button onClick={() => setSheet({ id: "start" })} className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-forest">
            <Plus className="h-4 w-4" aria-hidden /> Start a pact
          </button>
        )}
      </div>

      {!detail ? (
        <p className="flex items-center gap-2 text-muted" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading pacts</p>
      ) : pacts.length === 0 ? (
        <div className="card p-5">
          <p className="font-medium">Make the first promise.</p>
          <p className="mt-1 text-sm text-muted">Start a pact, lock money on your goal, and invite the group. Everyone joins with their own goal.</p>
          {me && <button onClick={() => setSheet({ id: "start" })} className="btn btn-primary mt-4 w-full">Start a pact</button>}
        </div>
      ) : (
        <ul className="space-y-4">
          {pacts.map((c) => (
            <li key={c.challenge.address.toBase58()}>
              <PactCard c={c} now={now} isMember={!!me} busy={busy}
                onJoin={() => setSheet({ id: "join", pact: c })}
                onConfirm={(owner, kept) => run("confirm", () => client.voteEntry(crew.address, c.challenge.address, owner, kept), "Thanks. Your answer is in.")}
                onAppeal={() => setSheet({ id: "appeal", pact: c })}
                onVerify={() => setSheet({ id: "verify", pact: c })}
                onCollect={async () => {
                  const won = c.mine && c.mine.payoutUsd > c.mine.usd;
                  const ok = await run("collect", () => client.claimChallenge(crew.address, c.challenge.address, c.feeTaken),
                    c.mine && c.mine.payoutUsd > 0 ? `${usd(c.mine.payoutUsd)} is back in your money.` : "Settled.");
                  if (ok && won) setCelebrate((x) => x + 1);
                }} />
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <Dialog
          title={sheet.id === "start" ? "Start a pact" : sheet.id === "join" ? "Lock money on your goal" : sheet.id === "verify" ? "Verify with Grok" : "Disagree with a result"}
          onClose={() => setSheet(null)}
        >
          {sheet.id === "start" && (
            <GoalForm free={props.value} min={1} withPactSettings busy={busy === "start"} cta="Lock"
              onSubmit={async ({ goal, stake, minutes, minStake }) => {
                if (await run("start", () => client.startCommitment(crew.address, `Pact: ${goal}`.slice(0, 80), minStake, minutes, goal, stake),
                  `Locked ${usd(stake)} on your goal. Invite the group to join.`)) setSheet(null);
              }} />
          )}
          {sheet.id === "join" && (
            <GoalForm free={props.value} min={sheet.pact.stakeUsd} busy={busy === "join"} cta="Lock"
              onSubmit={async ({ goal, stake }) => {
                if (await run("join", () => client.joinWithGoal(crew.address, sheet.pact.challenge.address, goal, stake), `Locked ${usd(stake)} on your goal.`)) setSheet(null);
              }} />
          )}
          {sheet.id === "appeal" && (
            <AppealSheet pact={sheet.pact} onClose={() => setSheet(null)}
              recordDispute={sheet.pact.mine ? () => client.openDispute(sheet.pact.challenge.address, sheet.pact.mine!.entry.owner) : undefined} />
          )}
          {sheet.id === "verify" && <VerifySheet pact={sheet.pact} onClose={() => setSheet(null)} />}
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function left(seconds: number) {
  if (seconds <= 0) return "Time is up";
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}:${String(s).padStart(2, "0")} left`;
}

function PactCard({ c, now, isMember, busy, onJoin, onConfirm, onAppeal, onVerify, onCollect }: {
  c: ChallengeView; now: number; isMember: boolean; busy: string | null;
  onJoin: () => void; onConfirm: (owner: PublicKey, kept: boolean) => void; onAppeal: () => void; onVerify: () => void; onCollect: () => void;
}) {
  const ch = c.challenge;
  const open = now < ch.endsAt;
  const settled = ch.participants > 0 && ch.decided === ch.participants;
  const amIn = !!c.mine;
  const need = Math.floor(Math.max(1, ch.participants - 1) / 2) + 1;
  const status = open ? "Open" : settled ? "Done" : "Confirming";
  const lost = c.entries.filter((e) => e.entry.status === hm.ENTRY.FAILED);
  const kept = c.entries.filter((e) => e.entry.status === hm.ENTRY.PASSED);

  return (
    <article className="card space-y-4 p-5" aria-label={`Pact, ${status.toLowerCase()}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Minimum {usd(c.stakeUsd)} · {ch.participants} in</p>
          {open && <p className="mt-1 flex items-center gap-1 text-sm text-forest"><Clock className="h-4 w-4" aria-hidden /> {left(ch.endsAt - now)}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-0.5 text-sm ${open ? "bg-mint text-forest" : settled ? "border border-stone text-muted" : "bg-forest text-white"}`}>{status}</span>
      </div>

      {open && amIn && ch.endsAt - now < 86400 && (
        <p role="status" className="rounded-xl border border-forest bg-mint px-4 py-3 text-sm text-forest">
          <span className="font-medium">Your goal is at risk.</span> Less than a day left. Do the thing, your friends will check.
        </p>
      )}

      <ul className="divide-y divide-stone" aria-label="Goals in this pact">
        {c.entries.map((e) => {
          const st = e.entry.status;
          return (
            <li key={e.entry.address.toBase58()} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.isMe ? "You" : e.name}</p>
                  <p className="text-sm text-muted">{e.goal ?? "Goal not set"}</p>
                </div>
                <div className="shrink-0 text-right">
                  {st === hm.ENTRY.PASSED ? (
                    <span className="text-sm font-medium text-forest">Kept it</span>
                  ) : st === hm.ENTRY.FAILED ? (
                    <span className="text-sm font-medium text-danger">Walked away</span>
                  ) : (
                    <span className="pill-locked">Locked {usd(e.stakeUsd)}</span>
                  )}
                </div>
              </div>
              {!open && st === hm.ENTRY.PENDING && (
                <div className="mt-2">
                  {e.isMe ? (
                    <p className="text-sm text-muted">Your friends are confirming.</p>
                  ) : e.myVote ? (
                    <p className="text-sm text-muted">You answered. {e.entry.passVotes + e.entry.failVotes} of {need} answers needed.</p>
                  ) : amIn ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button disabled={busy === "confirm"} onClick={() => onConfirm(e.entry.owner, true)} aria-label={`${e.name} kept their word`} className="btn btn-quiet min-h-11 text-sm"><Check className="h-4 w-4" aria-hidden /> Kept it</button>
                      <button disabled={busy === "confirm"} onClick={() => onConfirm(e.entry.owner, false)} aria-label={`${e.name} walked away`} className="btn btn-quiet min-h-11 text-sm"><X className="h-4 w-4" aria-hidden /> Didn&apos;t</button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Only people who put money in can confirm.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {c.entries.length === 0 && <li className="py-2 text-sm text-muted">Nobody has locked money yet.</li>}
      </ul>

      {open && isMember && !amIn && <button onClick={onJoin} className="btn btn-primary w-full">Lock money on my goal</button>}

      {!settled && amIn && <button onClick={onVerify} className="min-h-11 w-full text-sm text-muted underline">Public goal, like X followers? Verify with Grok</button>}

      {settled && <ResultBreakdown c={c} lostCount={lost.length} keptCount={kept.length} />}

      {settled && c.mine && !c.mine.entry.claimed && (
        <div className="space-y-2">
          <p className="font-medium">
            {c.mine.payoutUsd > c.mine.usd ? `You kept your word: ${usd(c.mine.usd)} becomes ${usd(c.mine.payoutUsd)}.` : c.mine.payoutUsd > 0 ? `You get ${usd(c.mine.payoutUsd)} back.` : `You lost ${usd(c.mine.usd)}.`}
          </p>
          <button disabled={busy === "collect"} onClick={onCollect} className="btn btn-primary w-full">{c.mine.payoutUsd > 0 ? `Collect ${usd(c.mine.payoutUsd)}` : "Close this pact"}</button>
          {c.mine.entry.status === hm.ENTRY.FAILED && <button onClick={onAppeal} className="min-h-11 w-full text-sm text-muted underline">Disagree with this result</button>}
        </div>
      )}
      {settled && c.mine?.entry.claimed && <p className="text-sm text-muted">Collected.</p>}
    </article>
  );
}

// Who gets what once a pact is settled. Your own line uses the exact payout from the program; the others
// use the same rule (stake back plus a pro rata share of the forfeits after the fee), so they are close
// to the cent but computed here.
function ResultBreakdown({ c, lostCount, keptCount }: { c: ChallengeView; lostCount: number; keptCount: number }) {
  const refundAll = lostCount === 0 || keptCount === 0;
  const keptStake = c.entries.filter((e) => e.entry.status === hm.ENTRY.PASSED).reduce((sum, e) => sum + e.stakeUsd, 0);
  const share = Math.max(0, c.forfeitUsd - c.feeUsd);
  const rows = c.entries.map((e) => {
    const kept = e.entry.status === hm.ENTRY.PASSED;
    const computed = refundAll ? e.stakeUsd : kept ? e.stakeUsd + (keptStake > 0 ? (share * e.stakeUsd) / keptStake : 0) : 0;
    const payout = e.isMe && c.mine ? c.mine.payoutUsd : computed;
    return { e, kept, payout };
  });
  const headline =
    lostCount === 0
      ? "Everyone kept their word. Everyone gets their money back."
      : keptCount === 0
        ? "Nobody kept their word, so everyone gets their money back. No fee is taken."
        : `${usd(c.forfeitUsd)} was left behind. ${usd(share)} goes to the friends who kept their word and ${usd(c.feeUsd)} to ${PROJECT_NAME}.`;

  return (
    <section aria-label="Who gets what" className="rounded-xl bg-mint p-4 text-sm">
      <p className="font-medium">{headline}</p>
      <ul className="mt-3 divide-y divide-stone">
        {rows.map(({ e, kept, payout }) => (
          <li key={e.entry.address.toBase58()} className="flex items-start justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block font-medium">{e.isMe ? "You" : e.name}</span>
              <span className={`block ${kept || refundAll ? "text-forest" : "text-danger"}`}>{refundAll ? "Money back" : kept ? "Kept it" : "Walked away"}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block text-muted">{usd(e.stakeUsd)} in</span>
              <span className="block font-medium">{usd(payout)} out</span>
            </span>
          </li>
        ))}
        {!refundAll && (
          <li className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium">{PROJECT_NAME}</span>
            <span className="tabular-nums"><span className="text-muted">{FEE_PERCENT}% fee</span> <span className="font-medium">{usd(c.feeUsd)}</span></span>
          </li>
        )}
      </ul>
    </section>
  );
}

function GoalForm({ free, min, busy, cta, withPactSettings, onSubmit }: {
  free: number; min: number; busy: boolean; cta: string; withPactSettings?: boolean;
  onSubmit: (v: { goal: string; stake: number; minutes: number; minStake: number }) => void;
}) {
  const [goal, setGoal] = useState("");
  const [coach, setCoach] = useState<ReturnType<typeof coachGoal> | null>(null);
  // No fixed chips: the amount is free, Grok suggests one. We start on the suggestion if you can afford it.
  const suggested = Math.max(min, coach?.stake ?? STAKE_SUGGESTED_MIN);
  const [stake, setStake] = useState(() => Math.max(min, Math.min(STAKE_SUGGESTED_MIN, Math.floor(free)) || min));
  const [minutes, setMinutes] = useState(10080);
  const [minStake, setMinStake] = useState(5);
  const [sure, setSure] = useState(false);
  const tooMuch = stake > free;
  const veryHigh = stake > suggested * STAKE_WARN_MULTIPLE;
  const blocked = !goal.trim() || busy || tooMuch || (veryHigh && !sure);
  const askGrok = () => {
    const c = coachGoal(goal);
    setCoach(c);
    if (c.measurable) {
      setGoal(c.goal.slice(0, 80));
      setStake((s) => (s === Math.max(min, STAKE_SUGGESTED_MIN) || s < c.stake ? Math.max(min, Math.min(c.stake, Math.max(min, Math.floor(free)))) : s));
    }
  };
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!blocked) onSubmit({ goal: goal.trim(), stake, minutes, minStake: Math.min(minStake, stake) }); }}>
      <label className="block">
        <span className="mb-2 block text-sm text-muted">Your goal</span>
        <input value={goal} onChange={(e) => { setGoal(e.target.value.slice(0, 80)); setCoach(null); }} placeholder="Run 21 km by Sunday"
          className="card w-full px-4 py-3 text-lg outline-none placeholder:text-muted/70 focus:border-forest" aria-describedby="goal-ideas" />
      </label>
      <div id="goal-ideas" className="flex flex-wrap gap-2" aria-label="Ideas">
        {GOAL_IDEAS.map((i) => <button type="button" key={i} onClick={() => { setGoal(i); setCoach(null); }} className="min-h-9 rounded-full bg-mint px-3 text-sm text-forest">{i}</button>)}
      </div>
      <div>
        <button type="button" onClick={askGrok} disabled={!goal.trim()} className="flex min-h-11 items-center gap-1.5 rounded-full border border-stone px-4 text-sm font-medium disabled:opacity-45">
          <Sparkles className="h-4 w-4 text-forest" aria-hidden /> Make it measurable with Grok <span className="rounded-md bg-stone px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">Demo</span>
        </button>
        {coach && (
          <p role="status" className={`mt-2 text-sm ${coach.measurable ? "text-forest" : "text-danger"}`}>
            {coach.note}
            {coach.measurable && <span className="mt-1 block text-muted">We count: {coach.metric.toLowerCase()}. Proof: {coach.proof.toLowerCase()}.</span>}
          </p>
        )}
      </div>
      <StakePicker value={stake} onChange={(v) => { setStake(v); setSure(false); }} min={min} max={Math.floor(free)} suggested={suggested} />
      {veryHigh && !tooMuch && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-5 w-5 accent-[#1F5F4A]" />
          <span>Yes, I want to lock {usd(stake)}. I understand I lose it if I walk away.</span>
        </label>
      )}
      {withPactSettings && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Time to do it</legend>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map(([label, m]) => <button type="button" key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className="tile min-h-11 py-2 text-sm">{label}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Minimum for friends who join</legend>
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 50].map((v) => <button type="button" key={v} onClick={() => setMinStake(v)} aria-pressed={minStake === v} className="tile min-h-11 py-2 text-sm">${v}</button>)}
            </div>
          </fieldset>
        </>
      )}
      <div className="space-y-2 rounded-xl bg-mint p-4 text-sm text-ink" aria-live="polite">
        <p className="font-medium">Before you lock {usd(stake)}</p>
        <p><span className="font-medium text-forest">Keep your word:</span> your {usd(stake)} comes back, plus a share of what others leave.</p>
        <p><span className="font-medium text-danger">Walk away:</span> you lose {usd(stake)}. {KEEPERS_PERCENT}% goes to the friends who kept theirs, {FEE_PERCENT}% to {PROJECT_NAME}.</p>
        <p className="text-muted">It stays locked until the people who put money in confirm the result.</p>
      </div>
      <button type="submit" disabled={blocked} className="btn btn-primary w-full py-4 text-lg">
        {tooMuch ? "Add money to this group first" : busy ? "Locking" : `${cta} ${usd(stake)}`}
      </button>
    </form>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 6) * 0.08, color: ["#1F5F4A", "#5FA98A", "#DDEFE5"][i % 3],
  })), []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[480px] overflow-hidden">
      {pieces.map((p, i) => <span key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s` }} />)}
    </div>
  );
}
