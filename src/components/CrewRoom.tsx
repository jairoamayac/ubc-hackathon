"use client";

// The crew room: your savings with the crew, bets on real-life moments and challenges where whoever fails pays.
// Everything is staked from your part of the crew pot, so stakes keep earning while they are locked.
import { ArrowLeft, Check, Clock, Gavel, Link2, Loader2, Plus, Swords, Trophy, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PublicKey } from "@solana/web3.js";
import type { BetView, ChallengeView, CrewDetail, CrewView, LiveClient, Snapshot } from "@/lib/house-money/solana/live";
import * as hm from "@/lib/house-money/solana/hm";
import { usd } from "./ui";

type Act = (label: string, fn: () => Promise<unknown>, done?: string) => Promise<boolean>;
type RoomSheet =
  | null
  | { id: "new-bet" }
  | { id: "new-challenge" }
  | { id: "stake"; bet: BetView; side: 1 | 2 };

const BET_IDEAS = ["Will Leo kiss the girl in red tonight?", "Does the trip finally leave the group chat?", "Will Alex make his 6 a.m. flight?", "Who's buying the first round? Maya?"];
const CHALLENGE_IDEAS = ["Gym 3 times this week", "No takeout for 7 days", "Save $50 this week", "In bed before midnight, all week"];
const DURATIONS: [string, number][] = [["1 min", 1], ["10 min", 10], ["1 hour", 60], ["Tonight", 360], ["1 day", 1440], ["1 week", 10080]];

export function CrewRoom(props: {
  client: LiveClient;
  crew: CrewView;
  snap: Snapshot;
  now: number;
  rank: number;
  busy: string | null;
  value: number;
  act: Act;
  onBack: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { client, crew, now, busy, act } = props;
  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [tab, setTab] = useState<"bets" | "challenges">("bets");
  const [sheet, setSheet] = useState<RoomSheet>(null);
  const [celebrate, setCelebrate] = useState(0);

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
  // Money you have on bets and challenges still counts as yours until the crew decides.
  const inPlay = detail
    ? detail.bets.reduce((s, b) => s + (b.mine && !b.mine.claimed ? (b.bet.outcome === hm.OUTCOME.OPEN ? b.mine.usd : b.mine.payoutUsd) : 0), 0) +
      detail.challenges.reduce((s, c) => {
        if (!c.mine || c.mine.entry.claimed) return s;
        const settled = c.challenge.participants > 0 && c.challenge.decided === c.challenge.participants;
        return s + (settled ? c.mine.payoutUsd : c.mine.usd);
      }, 0)
    : 0;
  const total = props.value + inPlay;
  const members = detail?.people.length ?? crew.members;
  const live = detail ? detail.bets.filter((b) => b.bet.outcome === hm.OUTCOME.OPEN).length + detail.challenges.filter((c) => c.challenge.decided < c.challenge.participants || c.challenge.participants === 0).length : 0;

  const invite = async () => {
    const url = `${location.origin}/?crew=${crew.address.toBase58()}`;
    try {
      if (navigator.share) await navigator.share({ title: `Join ${crew.name} on House Money`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user closed the share sheet */
    }
  };

  return (
    <div className="enter flex flex-1 flex-col gap-4 px-5 pb-8 pt-6">
      {celebrate > 0 && <Confetti key={celebrate} />}
      <div className="flex items-center justify-between">
        <button onClick={props.onBack} className="flex items-center gap-1 font-bold text-muted"><ArrowLeft className="h-5 w-5" /> Back</button>
        <button onClick={invite} className="flex items-center gap-1.5 rounded-full bg-stone px-3 py-1.5 text-sm font-extrabold"><Link2 className="h-4 w-4" /> Invite</button>
      </div>

      <section className="sun relative overflow-hidden rounded-[28px] bg-ink p-6 text-paper">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-4xl">{crew.emoji}</p>
            <h1 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight">{crew.name}</h1>
            <p className="text-sm font-bold text-paper/70">#{props.rank} · {members} {members === 1 ? "member" : "members"} · {live} live</p>
          </div>
        </div>
        <p className="mt-5 text-sm font-bold text-paper/70">{me ? "Your part" : "In the pot"}</p>
        <p className="text-[38px] font-extrabold leading-none tracking-tight tabular-nums">{usd(me ? total : crew.vault)}</p>
        {me && (
          <p className="mt-2 text-sm font-extrabold text-sun">
            {total - me.principal >= 0 ? "+" : "−"}${Math.abs(total - me.principal).toFixed(4)} vs. what you put in
            {inPlay > 0 && <span className="text-paper/80"> · {usd(inPlay)} in play</span>}
          </p>
        )}
        {detail && <People people={detail.people} />}
      </section>

      {me ? (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button onClick={props.onDeposit} className="btn btn-primary py-4 text-lg">Add money</button>
          <button onClick={props.onWithdraw} className="btn btn-quiet px-5 py-4">Take out</button>
        </div>
      ) : (
        <button onClick={props.onDeposit} className="btn btn-primary py-4 text-lg"><Users className="h-5 w-5" /> Join and add money</button>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1">
        {(["bets", "challenges"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold transition ${tab === t ? "bg-card shadow-sm" : "text-muted"}`}>
            {t === "bets" ? <Gavel className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
            {t === "bets" ? "Bets" : "Challenges"}
            <span className="rounded-full bg-paper px-1.5 text-xs">{t === "bets" ? detail?.bets.length ?? 0 : detail?.challenges.length ?? 0}</span>
          </button>
        ))}
      </div>

      {me && (
        <button onClick={() => setSheet({ id: tab === "bets" ? "new-bet" : "new-challenge" })}
          className="card flex items-center gap-3 p-4 text-left">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ember text-paper"><Plus className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block font-extrabold">{tab === "bets" ? "New bet" : "New challenge"}</span>
            <span className="text-xs font-bold text-muted">
              {tab === "bets" ? "Call something that happens tonight. The crew votes what happened." : "Everyone puts in. Whoever doesn't do it pays the rest."}
            </span>
          </span>
        </button>
      )}

      {!detail ? (
        <p className="flex items-center gap-2 font-bold text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : tab === "bets" ? (
        detail.bets.length === 0 ? (
          <Empty text="No bets yet. Start one: something your crew will argue about tomorrow." />
        ) : (
          detail.bets.map((b) => (
            <BetCard key={b.bet.address.toBase58()} b={b} now={now} members={members} isMember={!!me} busy={busy}
              onPick={(side) => setSheet({ id: "stake", bet: b, side })}
              onVote={(choice) => run("vote", () => client.voteBet(crew.address, b.bet.address, choice), "Vote in. Majority decides.")}
              onClaim={async () => {
                if (await run("claim", () => client.claimBet(crew.address, b.bet.address), b.mine && b.mine.payoutUsd > 0 ? `${usd(b.mine.payoutUsd)} back in your part of the pot.` : "Settled.")) setCelebrate((x) => x + 1);
              }} />
          ))
        )
      ) : detail.challenges.length === 0 ? (
        <Empty text="No challenges yet. Put money on a habit: whoever skips it pays the rest." />
      ) : (
        detail.challenges.map((c) => (
          <ChallengeCard key={c.challenge.address.toBase58()} c={c} now={now} members={members} isMember={!!me} busy={busy}
            onJoin={() => run("join", () => client.joinChallenge(crew.address, c.challenge.address), "You're in. Don't be the one who pays.")}
            onJudge={(owner, passed) => run("judge", () => client.voteEntry(crew.address, c.challenge.address, owner, passed), "Vote in.")}
            onClaim={async () => {
              if (await run("claim", () => client.claimChallenge(crew.address, c.challenge.address), c.mine && c.mine.payoutUsd > 0 ? `${usd(c.mine.payoutUsd)} back in your part of the pot.` : "Settled.")) setCelebrate((x) => x + 1);
            }} />
        ))
      )}

      {sheet && (
        <RoomSheetFrame onClose={() => setSheet(null)}>
          {sheet.id === "new-bet" && detail && (
            <NewBet people={detail.people} busy={busy === "new-bet"} onCreate={async (q, subject, minutes) => {
              if (await run("new-bet", () => client.createBet(crew.address, q, subject, minutes), "Bet is live. Tell the crew.")) setSheet(null);
            }} />
          )}
          {sheet.id === "new-challenge" && (
            <NewChallenge busy={busy === "new-challenge"} max={props.value} onCreate={async (title, stake, minutes) => {
              if (await run("new-challenge", () => client.createChallenge(crew.address, title, stake, minutes, true), "Challenge is live and you're in.")) setSheet(null);
            }} />
          )}
          {sheet.id === "stake" && (
            <Stake b={sheet.bet} side={sheet.side} max={props.value} busy={busy === "stake"} onStake={async (amount) => {
              if (await run("stake", () => client.placeBet(crew.address, sheet.bet.bet.address, sheet.side, amount), `You're in: ${sheet.side === 1 ? "Yes" : "No"} for ${usd(amount)}.`)) setSheet(null);
            }} />
          )}
        </RoomSheetFrame>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function People({ people }: { people: CrewDetail["people"] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {people.slice(0, 8).map((p) => (
        <span key={p.owner.toBase58()} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${p.isMe ? "bg-ember text-paper" : "bg-paper/15 text-paper"}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-paper/25 text-[10px]">{p.name.slice(0, 1).toUpperCase()}</span>
          {p.name} · {usd(p.value)}
        </span>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="card p-5 text-center text-sm font-semibold text-muted">{text}</p>;
}

function left(seconds: number) {
  if (seconds <= 0) return "time's up";
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}:${String(s).padStart(2, "0")} left`;
}

function Pools({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  const pct = total > 0 ? Math.round((yes / total) * 100) : 50;
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 overflow-hidden rounded-full bg-ink/15">
        <span className="bg-ember transition-all" style={{ width: `${pct}%` }} />
        <span className="flex-1 bg-ink" />
      </div>
      <div className="flex justify-between text-xs font-extrabold">
        <span className="text-ember-text">YES {usd(yes)}</span>
        <span>NO {usd(no)}</span>
      </div>
    </div>
  );
}

function BetCard({ b, now, members, isMember, busy, onPick, onVote, onClaim }: {
  b: BetView; now: number; members: number; isMember: boolean; busy: string | null;
  onPick: (side: 1 | 2) => void; onVote: (choice: 1 | 2) => void; onClaim: () => void;
}) {
  const { bet } = b;
  const isOpen = bet.outcome === hm.OUTCOME.OPEN && now < bet.closesAt;
  const voting = bet.outcome === hm.OUTCOME.OPEN && now >= bet.closesAt;
  const decided = bet.outcome !== hm.OUTCOME.OPEN;
  const eligible = Math.max(1, members - (b.subjectName ? 1 : 0));
  const need = Math.floor(eligible / 2) + 1;
  const won = decided && b.mine && b.mine.payoutUsd > b.mine.usd;

  return (
    <article className={`card space-y-3 p-5 ${decided ? "" : "ring-1 ring-ink/5"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-extrabold leading-snug">{bet.question}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${isOpen ? "bg-ember-soft text-ember-text" : voting ? "bg-sun/40 text-ink" : "bg-stone text-muted"}`}>
          {isOpen ? "Live" : voting ? "Vote" : "Done"}
        </span>
      </div>
      <p className="flex items-center gap-3 text-xs font-bold text-muted">
        {b.subjectName && <span>About {b.subjectName}</span>}
        <span>By {b.creatorName}</span>
        <span>{bet.bettors} in</span>
        {isOpen && <span className="flex items-center gap-1 text-ember-text"><Clock className="h-3.5 w-3.5" />{left(bet.closesAt - now)}</span>}
      </p>
      <Pools yes={b.yesUsd} no={b.noUsd} />

      {isOpen && (b.mine ? (
        <p className="rounded-xl bg-paper px-3 py-2 text-sm font-extrabold">You&apos;re in: {b.mine.side === 1 ? "YES" : "NO"} · {usd(b.mine.usd)}</p>
      ) : isMember ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onPick(1)} className="btn btn-primary py-3">Yes</button>
          <button onClick={() => onPick(2)} className="btn btn-ink py-3">No</button>
        </div>
      ) : null)}

      {voting && (
        <div className="space-y-2">
          <p className="text-sm font-extrabold">What happened? <span className="font-bold text-muted">({bet.yesVotes + bet.noVotes} of {need} votes needed)</span></p>
          {!isMember ? null : !b.canVote ? (
            <p className="text-sm font-bold text-muted">It&apos;s about you, so the crew decides.</p>
          ) : b.myVote ? (
            <p className="text-sm font-bold text-muted">You said {b.myVote === 1 ? "YES" : "NO"}. Waiting for the crew.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button disabled={busy === "vote"} onClick={() => onVote(1)} className="btn btn-quiet py-3"><Check className="h-4 w-4" /> It happened</button>
              <button disabled={busy === "vote"} onClick={() => onVote(2)} className="btn btn-quiet py-3"><X className="h-4 w-4" /> It didn&apos;t</button>
            </div>
          )}
        </div>
      )}

      {decided && (
        <div className={`rounded-2xl p-4 ${bet.outcome === hm.OUTCOME.YES ? "bg-ember text-paper" : "bg-ink text-paper"}`}>
          <p className="text-xs font-extrabold uppercase tracking-widest opacity-80">The crew decided</p>
          <p className="text-2xl font-extrabold">{bet.outcome === hm.OUTCOME.YES ? "YES, it happened" : "NO, it didn't"}</p>
          {b.mine && (
            <p className="mt-1 text-sm font-bold opacity-90">
              {won ? `You won: ${usd(b.mine.usd)} → ${usd(b.mine.payoutUsd)}` : b.mine.payoutUsd > 0 ? `You get ${usd(b.mine.payoutUsd)} back` : `You lost ${usd(b.mine.usd)}`}
            </p>
          )}
          {b.mine && !b.mine.claimed && (
            <button disabled={busy === "claim"} onClick={onClaim} className="btn mt-3 w-full bg-paper py-3 text-ink">
              {b.mine.payoutUsd > 0 ? <><Trophy className="h-4 w-4" /> Collect {usd(b.mine.payoutUsd)}</> : "Settle"}
            </button>
          )}
          {b.mine?.claimed && <p className="mt-2 text-xs font-extrabold opacity-80">Collected</p>}
        </div>
      )}
    </article>
  );
}

function ChallengeCard({ c, now, members, isMember, busy, onJoin, onJudge, onClaim }: {
  c: ChallengeView; now: number; members: number; isMember: boolean; busy: string | null;
  onJoin: () => void; onJudge: (owner: PublicKey, passed: boolean) => void; onClaim: () => void;
}) {
  const ch = c.challenge;
  const running = now < ch.endsAt;
  const settled = ch.participants > 0 && ch.decided === ch.participants;
  const need = Math.floor(Math.max(1, members - 1) / 2) + 1;
  return (
    <article className="card space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-extrabold leading-snug">{ch.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${running ? "bg-ember-soft text-ember-text" : settled ? "bg-stone text-muted" : "bg-sun/40 text-ink"}`}>
          {running ? "On" : settled ? "Done" : "Judge"}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted">
        <span>{usd(c.stakeUsd)} each</span>
        <span>Pot {usd(c.potUsd)}</span>
        <span>By {c.creatorName}</span>
        {running && <span className="flex items-center gap-1 text-ember-text"><Clock className="h-3.5 w-3.5" />{left(ch.endsAt - now)}</span>}
      </p>

      <ul className="space-y-2">
        {c.entries.map((e) => {
          const st = e.entry.status;
          return (
            <li key={e.entry.address.toBase58()} className="flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2">
              <span className="text-sm font-extrabold">{e.name}</span>
              {st === hm.ENTRY.PASSED ? (
                <span className="text-sm font-extrabold text-gain">Did it ✓</span>
              ) : st === hm.ENTRY.FAILED ? (
                <span className="text-sm font-extrabold text-ember-text">Pays ✗</span>
              ) : running ? (
                <span className="text-xs font-bold text-muted">in</span>
              ) : e.isMe ? (
                <span className="text-xs font-bold text-muted">crew is judging you</span>
              ) : e.myVote ? (
                <span className="text-xs font-bold text-muted">you voted · {e.entry.passVotes + e.entry.failVotes}/{need}</span>
              ) : isMember ? (
                <span className="flex gap-1.5">
                  <button disabled={busy === "judge"} onClick={() => onJudge(e.entry.owner, true)} aria-label={`${e.name} did it`} className="rounded-lg bg-gain px-2.5 py-1 text-xs font-extrabold text-paper">Did it</button>
                  <button disabled={busy === "judge"} onClick={() => onJudge(e.entry.owner, false)} aria-label={`${e.name} didn't`} className="rounded-lg bg-ember px-2.5 py-1 text-xs font-extrabold text-paper">Didn&apos;t</button>
                </span>
              ) : null}
            </li>
          );
        })}
        {c.entries.length === 0 && <li className="text-sm font-bold text-muted">Nobody in yet.</li>}
      </ul>

      {running && isMember && !c.mine && (
        <button disabled={busy === "join"} onClick={onJoin} className="btn btn-primary w-full py-3">I&apos;m in · put {usd(c.stakeUsd)}</button>
      )}
      {settled && c.mine && !c.mine.entry.claimed && (
        <button disabled={busy === "claim"} onClick={onClaim} className="btn btn-ink w-full py-3">
          {c.mine.payoutUsd > 0 ? <><Trophy className="h-4 w-4" /> Collect {usd(c.mine.payoutUsd)}</> : "Settle (you pay this one)"}
        </button>
      )}
    </article>
  );
}

function RoomSheetFrame({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div className="enter max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[32px] bg-paper p-6 pb-8" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="float-right rounded-full bg-stone p-1.5"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>
  );
}

function Durations({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DURATIONS.map(([label, m]) => (
        <button key={m} onClick={() => onChange(m)} aria-pressed={value === m} className="tile py-2.5 text-sm font-extrabold">{label}</button>
      ))}
    </div>
  );
}

function NewBet({ people, busy, onCreate }: { people: CrewDetail["people"]; busy: boolean; onCreate: (q: string, subject: PublicKey, minutes: number) => void }) {
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [minutes, setMinutes] = useState(10);
  const others = useMemo(() => people.filter((p) => !p.isMe), [people]);
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold tracking-tight">New bet</h2>
      <textarea value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} rows={2} placeholder="Will Leo kiss the girl in red tonight?" aria-label="Question"
        className="card w-full resize-none px-4 py-3 text-lg font-bold outline-none ring-ember placeholder:text-muted/60 focus:ring-2" />
      <div className="flex flex-wrap gap-2">
        {BET_IDEAS.map((i) => <button key={i} onClick={() => setQ(i)} className="rounded-full bg-stone px-3 py-1 text-xs font-bold">{i}</button>)}
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-muted">Who is it about? (they can bet, not vote)</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSubject("")} aria-pressed={subject === ""} className="tile px-3 py-2 text-sm font-extrabold">Nobody</button>
          {others.map((p) => (
            <button key={p.owner.toBase58()} onClick={() => setSubject(p.owner.toBase58())} aria-pressed={subject === p.owner.toBase58()} className="tile px-3 py-2 text-sm font-extrabold">{p.name}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-muted">Bets close in</p>
        <Durations value={minutes} onChange={setMinutes} />
      </div>
      <button disabled={!q.trim() || busy} onClick={() => onCreate(q.trim(), subject ? new PublicKey(subject) : hm.NOBODY, minutes)} className="btn btn-primary w-full py-4 text-lg">
        {busy ? "Creating…" : "Start the bet"}
      </button>
    </div>
  );
}

function NewChallenge({ busy, max, onCreate }: { busy: boolean; max: number; onCreate: (title: string, stake: number, minutes: number) => void }) {
  const [title, setTitle] = useState("");
  const [stake, setStake] = useState(10);
  const [minutes, setMinutes] = useState(10080);
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold tracking-tight">New challenge</h2>
      <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="Gym 3 times this week" aria-label="Challenge"
        className="card w-full px-4 py-3 text-lg font-bold outline-none ring-ember placeholder:text-muted/60 focus:ring-2" />
      <div className="flex flex-wrap gap-2">
        {CHALLENGE_IDEAS.map((i) => <button key={i} onClick={() => setTitle(i)} className="rounded-full bg-stone px-3 py-1 text-xs font-bold">{i}</button>)}
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-muted">Everyone puts in</p>
        <div className="grid grid-cols-4 gap-2">
          {[1, 5, 10, 20].map((v) => <button key={v} onClick={() => setStake(v)} aria-pressed={stake === v} className="tile py-2.5 font-extrabold">${v}</button>)}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-muted">Ends in</p>
        <Durations value={minutes} onChange={setMinutes} />
      </div>
      <p className="rounded-xl bg-paper px-3 py-2 text-sm font-semibold text-muted">
        When time is up the crew votes on each person. Whoever didn&apos;t do it loses their {usd(stake)}, split among the ones who did. The money keeps earning while it&apos;s locked.
      </p>
      <button disabled={!title.trim() || busy || stake > max} onClick={() => onCreate(title.trim(), stake, minutes)} className="btn btn-primary w-full py-4 text-lg">
        {stake > max ? "Add money to this crew first" : busy ? "Creating…" : `Start it · I'm in for ${usd(stake)}`}
      </button>
    </div>
  );
}

function Stake({ b, side, max, busy, onStake }: { b: BetView; side: 1 | 2; max: number; busy: boolean; onStake: (amount: number) => void }) {
  const [amount, setAmount] = useState(Math.min(5, Math.floor(max)));
  const mine = side === 1 ? b.yesUsd : b.noUsd;
  const other = side === 1 ? b.noUsd : b.yesUsd;
  const ifWin = amount + (other * amount) / Math.max(0.000001, mine + amount);
  return (
    <div className="space-y-4">
      <p className="text-sm font-extrabold uppercase tracking-widest text-ember-text">You say {side === 1 ? "YES" : "NO"}</p>
      <h2 className="pr-8 text-2xl font-extrabold leading-tight tracking-tight">{b.bet.question}</h2>
      <div className="grid grid-cols-4 gap-2">
        {[1, 5, 10, 20].map((v) => <button key={v} disabled={v > max} onClick={() => setAmount(v)} aria-pressed={amount === v} className="tile py-3 font-extrabold disabled:opacity-40">${v}</button>)}
      </div>
      <div className="card space-y-2 p-4 text-sm font-bold">
        <p className="flex justify-between"><span className="text-muted">You put</span>{usd(amount)}</p>
        <p className="flex justify-between"><span className="text-muted">If you&apos;re right (so far)</span><span className="text-gain">{usd(ifWin)}</span></p>
        <p className="text-xs font-semibold text-muted">Comes from your part of the crew pot and keeps earning until the crew decides.</p>
      </div>
      <button disabled={busy || amount <= 0 || amount > max} onClick={() => onStake(amount)} className="btn btn-primary w-full py-4 text-lg">
        {amount > max ? "Add money to this crew first" : busy ? "Locking…" : `Lock ${usd(amount)} on ${side === 1 ? "YES" : "NO"}`}
      </button>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 7) * 0.08, color: ["#C4442E", "#FFD65C", "#16233F", "#2E7D50"][i % 4],
  })), []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[480px] overflow-hidden">
      {pieces.map((p, i) => <span key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s` }} />)}
    </div>
  );
}
