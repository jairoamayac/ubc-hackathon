"use client";

// A group: the people, their money, and pacts. In a pact each person locks money on their own goal;
// when time is up the people who put money in confirm who kept their word. Walk away and you lose it:
// the friends who kept theirs get the rest after a small platform fee (see FEE_PERCENT in lib/brand).
// Everything here is sponsored, with no wallet in sight.
import { Check, Clock, Link2, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const DETAIL_POLL_MS = 30_000;
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

  const [trouble, setTrouble] = useState(false); // pacts keep failing to load
  // What the person just did, shown right away. These only ever go one way (collected, answered, joined),
  // so they cannot double count: as soon as fresh data shows the same thing, it wins.
  // Pacts I just started: shown at once, replaced by the real one as soon as the network lists it.
  const [created, setCreated] = useState<ChallengeView[]>([]);
  const [done, setDone] = useState<{ claimed: string[]; voted: string[]; joined: string[] }>({ claimed: [], voted: [], joined: [] });
  const reloadTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = useCallback(async () => {
    try {
      setDetail(await client.crewDetail(crew.address));
      setTrouble(false);
      return true;
    } catch {
      setTrouble(true);
      return false;
    }
  }, [client, crew.address]);

  // Slow poll, backing off when it fails, paused while the tab is hidden.
  useEffect(() => {
    let stop = false;
    let fails = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      if (document.hidden) {
        timer = setTimeout(tick, 5_000);
        return;
      }
      const ok = await load();
      fails = ok ? 0 : fails + 1;
      if (!stop) timer = setTimeout(tick, ok ? DETAIL_POLL_MS : Math.min(30_000, 2_000 * 2 ** (fails - 1)));
    };
    timer = setTimeout(tick, 0);
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      timer = setTimeout(tick, 0);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);
  useEffect(() => {
    const timers = reloadTimers;
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // After an action: show it now, then re-read a few times while the network catches up.
  const run: Act = async (label, fn, done) => {
    const ok = await act(label, fn, done);
    if (ok) {
      reloadTimers.current.forEach(clearTimeout);
      reloadTimers.current = [0, 3000, 8000].map((d) => setTimeout(() => void load(), d));
    }
    return ok;
  };

  // Fresh data plus what was just done (see above).
  const shown = useMemo<CrewDetail | null>(() => {
    if (!detail) return null;
    const listed = new Set(detail.challenges.map((c) => c.challenge.address.toBase58()));
    const fresh = created.filter((c) => !listed.has(c.challenge.address.toBase58()));
    return {
      ...detail,
      challenges: [...fresh, ...detail.challenges].map((c) => {
        const addr = c.challenge.address.toBase58();
        let v = c;
        if (done.joined.includes(addr) && !v.mine) v = { ...v, joinedPending: true };
        if (done.claimed.includes(addr) && v.mine && !v.mine.entry.claimed) v = { ...v, mine: { ...v.mine, entry: { ...v.mine.entry, claimed: true } } };
        const entries = v.entries.map((e) => {
          const key = `${addr}:${e.entry.owner.toBase58()}`;
          if (!done.voted.includes(key) || e.myVote) return e;
          return { ...e, myVote: 1, entry: { ...e.entry, passVotes: e.entry.passVotes + 1 } };
        });
        return entries.some((e, i) => e !== v.entries[i]) ? { ...v, entries } : v;
      }),
    };
  }, [detail, done, created]);

  const me = crew.me;
  // Money locked on goals still counts as yours until your friends confirm. It comes from the same read as the
  // free money (snapshot), so the total never dips while one of the two catches up.
  const locked = crew.locked;
  const pacts = shown?.challenges ?? [];

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
        {shown && shown.people.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="People in this group">
            {shown.people.map((p) => (
              <li key={p.owner.toBase58()} className={`rounded-full border px-3 py-1 text-sm ${p.isMe ? "border-forest text-forest" : "border-stone"}`}>{p.name}</li>
            ))}
          </ul>
        )}
        {me ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={props.onDeposit} className="btn btn-primary">Add money</button>
            <button onClick={props.onWithdraw} disabled={me.pending} className="btn btn-quiet disabled:opacity-45">Take out</button>
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

      {!shown ? (
        <div className="space-y-2" role="status">
          <p className="flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading pacts</p>
          {trouble && (
            <>
              <p className="text-sm text-muted">We&apos;re having trouble connecting. Still trying.</p>
              <button onClick={() => void load()} className="btn btn-quiet">Try again</button>
            </>
          )}
        </div>
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
                onConfirm={async (owner, kept) => {
                  const ok = await run("confirm", () => client.voteEntry(crew.address, c.challenge.address, owner, kept), "Thanks. Your answer is in.");
                  if (ok) setDone((d) => ({ ...d, voted: [...d.voted, `${c.challenge.address.toBase58()}:${owner.toBase58()}`] }));
                }}
                onAppeal={() => setSheet({ id: "appeal", pact: c })}
                onVerify={() => setSheet({ id: "verify", pact: c })}
                onCollect={async () => {
                  const won = c.mine && c.mine.payoutUsd > c.mine.usd;
                  const ok = await run("collect", () => client.claimChallenge(crew.address, c.challenge.address, c.feeTaken),
                    c.mine && c.mine.payoutUsd > 0 ? `${usd(c.mine.payoutUsd)} is back in your money.` : "Settled.");
                  if (ok) setDone((d) => ({ ...d, claimed: [...d.claimed, c.challenge.address.toBase58()] }));
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
          {sheet.id === "start" && crew.members < 2 && (
            <div className="space-y-4">
              <p className="font-medium">A pact needs at least two people.</p>
              <p className="text-sm text-muted">You&apos;re the only one in this group. Invite a friend first; once they join, you can lock money on your goal together.</p>
              <button onClick={invite} className="btn btn-primary w-full"><Link2 className="h-4 w-4" aria-hidden /> {copied ? "Link copied" : "Invite a friend"}</button>
            </div>
          )}
          {sheet.id === "start" && crew.members >= 2 && (
            <GoalForm free={props.value} min={1} withPactSettings busy={busy === "start"} cta="Lock"
              note="Heads up: your friends have to lock money on this pact too. If you are the only one in when time is up, nobody can confirm it and your money stays locked."
              onSubmit={async ({ goal, stake, minutes, minStake }) => {
                const id = BigInt(Date.now());
                const title = `Pact: ${goal}`.slice(0, 80);
                if (await run("start", () => client.startCommitment(crew.address, title, minStake, minutes, goal, stake, id),
                  `Locked ${usd(stake)} on your goal. Invite the group to join.`)) {
                  setCreated((l) => [...l, optimisticPact(client, crew.address, id, title, goal, stake, minStake, minutes)]);
                  setSheet(null);
                }
              }} />
          )}
          {sheet.id === "join" && (
            <GoalForm free={props.value} min={sheet.pact.stakeUsd} busy={busy === "join"} cta="Lock"
              onSubmit={async ({ goal, stake }) => {
                if (await run("join", () => client.joinWithGoal(crew.address, sheet.pact.challenge.address, goal, stake), `Locked ${usd(stake)} on your goal.`)) {
                  setDone((d) => ({ ...d, joined: [...d.joined, sheet.pact.challenge.address.toBase58()] }));
                  setSheet(null);
                }
              }} />
          )}
          {sheet.id === "appeal" && <AppealSheet pact={sheet.pact} onClose={() => setSheet(null)} />}
          {sheet.id === "verify" && <VerifySheet pact={sheet.pact} onClose={() => setSheet(null)} />}
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

/** What a pact I just started looks like, before the network lists it (one person in, nothing decided). */
function optimisticPact(client: LiveClient, crew: PublicKey, id: bigint, title: string, goal: string, stake: number, minStake: number, minutes: number): ChallengeView {
  const me = client.owner.publicKey;
  const address = hm.challengePda(crew, id);
  const entry: hm.EntryAccount = {
    address: hm.entryPda(address, me), challenge: address, owner: me, shares: hm.fromUsd(stake), passVotes: 0, failVotes: 0, status: hm.ENTRY.PENDING, claimed: false,
  };
  const view = { entry, name: "You", isMe: true, goal, stakeUsd: stake };
  return {
    challenge: {
      address, crew, creator: me, challengeId: id, title, stake: hm.fromUsd(minStake), endsAt: Math.floor(Date.now() / 1000) + Math.round(minutes * 60),
      participants: 1, decided: 0, passedShares: 0n, failedShares: 0n,
    },
    creatorName: "You", stakeUsd: minStake, potUsd: stake, entries: [view], mine: { ...view, payoutUsd: 0, usd: stake },
    feeTaken: false, feeUsd: 0, forfeitUsd: 0,
  };
}

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
  const joining = !!c.joinedPending; // just locked, waiting for the network to show it
  const alone = ch.participants < 2; // nobody else can confirm a pact with one person in it
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
                    <p className="text-sm text-muted">{alone ? "Only you put money in, so nobody else can confirm this pact." : "Your friends are confirming."}</p>
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

      {open && isMember && !amIn && joining && <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Locking your money</p>}
      {open && isMember && !amIn && !joining && <button onClick={onJoin} className="btn btn-primary w-full">Lock money on my goal</button>}

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

function GoalForm({ free, min, busy, cta, withPactSettings, note, onSubmit }: {
  free: number; min: number; busy: boolean; cta: string; withPactSettings?: boolean; note?: string;
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
        {note && <p className="font-medium">{note}</p>}
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
