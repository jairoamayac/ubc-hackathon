"use client";

// A group: the people, their money, and pacts. In a pact each person locks money on their own goal;
// when time is up the people who put money in confirm who kept their word. Walk away and you lose it:
// 95% to the friends who kept theirs, 5% to the platform. Everything here is a Solana transaction,
// sponsored, with no wallet in sight.
import { Check, Clock, Link2, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { ChallengeView, CrewDetail, CrewView, LiveClient, Snapshot } from "@/lib/house-money/solana/live";
import * as hm from "@/lib/house-money/solana/hm";
import { PROJECT_NAME } from "@/lib/brand";
import { BackButton, Dialog, type Act } from "./CrewsApp";
import { usd } from "@/lib/format";

type RoomSheet = null | { id: "start" } | { id: "join"; pact: ChallengeView } | { id: "appeal" };

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
                onAppeal={() => setSheet({ id: "appeal" })}
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
          title={sheet.id === "start" ? "Start a pact" : sheet.id === "join" ? "Lock money on your goal" : "Disagree with a result"}
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
            <div className="space-y-4 text-muted">
              <p>If you think your friends got it wrong, you will be able to send proof, such as a screenshot of your run. An AI check reviews distance, date and route, and its decision is recorded with the result.</p>
              <p className="text-ink">This part is not built yet. For now, results are decided by the people who put money in.</p>
              <button onClick={() => setSheet(null)} className="btn btn-quiet w-full">Close</button>
            </div>
          )}
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

function PactCard({ c, now, isMember, busy, onJoin, onConfirm, onAppeal, onCollect }: {
  c: ChallengeView; now: number; isMember: boolean; busy: string | null;
  onJoin: () => void; onConfirm: (owner: PublicKey, kept: boolean) => void; onAppeal: () => void; onCollect: () => void;
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

      {settled && (
        <div className="rounded-xl bg-mint p-4 text-sm">
          {lost.length === 0 ? (
            <p>Everyone kept their word. Everyone gets their money back.</p>
          ) : kept.length === 0 ? (
            <p>Nobody kept their word, so everyone gets their money back. No fee is taken.</p>
          ) : (
            <p>
              {lost.map((e) => (e.isMe ? "You" : e.name)).join(", ")} walked away with {usd(c.forfeitUsd)} locked. {usd(c.forfeitUsd - c.feeUsd)} goes to the friends who kept their word and {usd(c.feeUsd)} to {PROJECT_NAME}.
            </p>
          )}
        </div>
      )}

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

function GoalForm({ free, min, busy, cta, withPactSettings, onSubmit }: {
  free: number; min: number; busy: boolean; cta: string; withPactSettings?: boolean;
  onSubmit: (v: { goal: string; stake: number; minutes: number; minStake: number }) => void;
}) {
  const [goal, setGoal] = useState("");
  const options = useMemo(() => [5, 10, 20, 50].filter((v) => v >= min), [min]);
  const [stake, setStake] = useState(Math.max(min, Math.min(20, Math.floor(free))));
  const [minutes, setMinutes] = useState(10080);
  const [minStake, setMinStake] = useState(5);
  const tooMuch = stake > free;
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (goal.trim() && !busy && !tooMuch) onSubmit({ goal: goal.trim(), stake, minutes, minStake: Math.min(minStake, stake) }); }}>
      <label className="block">
        <span className="mb-2 block text-sm text-muted">Your goal</span>
        <input value={goal} onChange={(e) => setGoal(e.target.value.slice(0, 80))} placeholder="Run 21 km by Sunday"
          className="card w-full px-4 py-3 text-lg outline-none placeholder:text-muted/70 focus:border-forest" aria-describedby="goal-ideas" />
      </label>
      <div id="goal-ideas" className="flex flex-wrap gap-2" aria-label="Ideas">
        {GOAL_IDEAS.map((i) => <button type="button" key={i} onClick={() => setGoal(i)} className="min-h-9 rounded-full bg-mint px-3 text-sm text-forest">{i}</button>)}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Money you lock{min > 1 ? ` (at least ${usd(min)})` : ""}</legend>
        <div className="grid grid-cols-4 gap-2">
          {options.map((v) => <button type="button" key={v} onClick={() => setStake(v)} aria-pressed={stake === v} className="tile min-h-12 py-2 font-medium">${v}</button>)}
        </div>
      </fieldset>
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
              {[1, 5, 10, 20].map((v) => <button type="button" key={v} onClick={() => setMinStake(v)} aria-pressed={minStake === v} className="tile min-h-11 py-2 text-sm">${v}</button>)}
            </div>
          </fieldset>
        </>
      )}
      <p className="rounded-xl bg-mint p-3 text-sm text-ink">
        Locked until your friends confirm. Keep your word and it comes back, plus a share of what others leave. Walk away and you lose it: 95% to the friends who kept theirs, 5% to {PROJECT_NAME}.
      </p>
      <button type="submit" disabled={!goal.trim() || busy || tooMuch} className="btn btn-primary w-full py-4 text-lg">
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
