"use client";

// Group tab (members and feed), goal detail, vote and results, wired to the live program.
// Rules: after the deadline only people with money in the round vote, never on themselves. After the
// voting window (hm.VOTE_WINDOW_SECS) anything undecided is settled by plurality; a tie or no votes refunds.
// Money splits come from settle() with FEE_PERCENT (see kept/model.ts).
import { Check, ChevronRight, Link2, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChallengeView, CrewDetail, CrewView, LiveClient } from "@/lib/house-money/solana/live";
import { phaseOf } from "@/lib/house-money/solana/live";
import * as hm from "@/lib/house-money/solana/hm";
import { FEE_PERCENT, KEEPERS_PERCENT, PROJECT_NAME } from "@/lib/brand";
import { usd } from "@/lib/format";
import type { Act } from "./CrewsApp";
import { entryState, outcomeOf, percentElapsed, roundTitle } from "./kept/model";
import { Avatar, dateLabel, Empty, Header, Icon3D, LockedPill, Page, PreviewBadge, Ring, Spinner, StatePill, timeLeft } from "./kept/ui";

const TILE = ["bg-fit", "bg-butter", "bg-sky", "bg-lilac-pastel", "bg-peach"];

// ---------------------------------------------------------------- group

export function GroupScreen(props: {
  client: LiveClient; crew: CrewView; detail?: CrewDetail; groups: CrewView[]; now: number; busy: string | null; act: Act;
  free: number; cash: number;
  onSwitch: (k: string) => void; onNewGroup: () => void; onOpen: (v: ChallengeView, voteOn?: string) => void;
  onJoin: (v: ChallengeView) => void; onNewGoal: () => void; onAddFunds: () => void;
}) {
  const { crew, detail, now } = props;
  const [tab, setTab] = useState<"members" | "feed">("members");
  const [copied, setCopied] = useState(false);
  const rounds = detail?.challenges ?? [];
  const current = rounds.find((v) => phaseOf(v, now) !== "settled") ?? rounds[0];
  const past = rounds.filter((v) => v !== current);
  const isMember = !!crew.me || !!detail?.isMember;

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
    <Page>
      <header className="flex items-center justify-between gap-3">
        <h1 className="truncate text-[28px] font-medium leading-tight tracking-tight">{crew.name}</h1>
        <button onClick={invite} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium shadow-[0_8px_22px_rgba(26,26,24,.07)]">
          <Link2 className="h-4 w-4" aria-hidden /> {copied ? "Link copied" : "Invite"}
        </button>
      </header>
      {props.groups.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Your groups">
          {props.groups.map((g) => (
            <button key={g.address.toBase58()} onClick={() => props.onSwitch(g.address.toBase58())} aria-pressed={g.address.equals(crew.address)} className="tile min-h-10 shrink-0 rounded-full px-4 text-sm">{g.name}</button>
          ))}
          <button onClick={props.onNewGroup} className="tile flex min-h-10 shrink-0 items-center gap-1 rounded-full px-4 text-sm"><Plus className="h-4 w-4" aria-hidden /> New</button>
        </div>
      )}
      <div className="seg" role="tablist" aria-label="Group view">
        <button role="tab" aria-selected={tab === "members"} onClick={() => setTab("members")}>Members</button>
        <button role="tab" aria-selected={tab === "feed"} onClick={() => setTab("feed")}>Feed</button>
      </div>

      {!detail ? <Spinner label="Loading the group" /> : tab === "feed" ? <Feed detail={detail} now={now} /> : (
        <>
          <section className="hero-lilac p-5" aria-label="Group pot">
            <span className="pointer-events-none absolute -right-1 -top-1"><Icon3D name="money-bag" size={88} glow /></span>
            <p className="flex items-center gap-2 text-sm">Group pot {current && phaseOf(current, now) === "open" && <LockedPill />}</p>
            <p className="num mt-2 text-[48px] leading-none">{usd(current ? current.potUsd : crew.vault)}</p>
            <p className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span>{crew.members} {crew.members === 1 ? "person" : "people"}{current ? ` · ${phaseOf(current, now) === "open" ? `ends ${dateLabel(current.challenge.endsAt)}` : phaseOf(current, now) === "settled" ? "settled" : "voting"}` : ""}</span>
              <span className="flex -space-x-2" aria-hidden>{detail.people.slice(0, 5).map((p) => <Avatar key={p.owner.toBase58()} name={p.name} size={26} tone="bg-white" />)}</span>
            </p>
          </section>

          {!current ? (
            <Empty icon="padlock-key" title="Make the first promise" body="Lock money on your goal and invite the group. Everyone joins with their own goal.">
              {isMember ? <button onClick={props.onNewGoal} className="btn btn-primary w-full">New goal</button>
                : <JoinGroup {...props} />}
            </Empty>
          ) : (
            <Round v={current} now={now} isMember={isMember} onOpen={props.onOpen} onJoin={props.onJoin} />
          )}
          {current && !isMember && <JoinGroup {...props} />}
          {current && isMember && phaseOf(current, now) !== "open" && (
            <button onClick={props.onNewGoal} className="btn btn-quiet w-full"><Plus className="h-4 w-4" aria-hidden /> Start a new round</button>
          )}
          <button onClick={invite} className="btn btn-white w-full text-ink"><Link2 className="h-4 w-4" aria-hidden /> {copied ? "Link copied" : "Invite friends"}</button>

          {past.length > 0 && (
            <section aria-labelledby="past">
              <h2 id="past" className="mb-2 text-[17px] font-medium">Earlier rounds</h2>
              <ul className="space-y-2">
                {past.map((v) => (
                  <li key={v.challenge.address.toBase58()}>
                    <button onClick={() => props.onOpen(v)} className="card flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{roundTitle(v)}</span>
                        <span className="block text-xs text-muted">{v.challenge.participants} in · {usd(v.potUsd)}</span>
                      </span>
                      {v.mine ? <StatePill state={entryState(v.mine, phaseOf(v, now))} /> : null}
                      <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Page>
  );
}

function JoinGroup({ client, crew, act, busy }: { client: LiveClient; crew: CrewView; act: Act; busy: string | null }) {
  return (
    <button disabled={busy === "joinGroup"} onClick={() => act("joinGroup", () => client.join(crew.address), `You joined ${crew.name}.`)} className="btn btn-primary w-full">
      {busy === "joinGroup" ? "Joining" : "Join this group"}
    </button>
  );
}

function Round({ v, now, isMember, onOpen, onJoin }: { v: ChallengeView; now: number; isMember: boolean; onOpen: (v: ChallengeView, voteOn?: string) => void; onJoin: (v: ChallengeView) => void }) {
  const phase = phaseOf(v, now);
  const toVote = v.mine && phase !== "open" && phase !== "settled" ? v.entries.filter((e) => !e.isMe && e.entry.status === hm.ENTRY.PENDING && !e.myVote) : [];
  return (
    <section aria-labelledby="round" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="round" className="text-[17px] font-medium">{phase === "open" ? "This round" : phase === "settled" ? "Last round" : "Voting"}</h2>
        <span className="text-sm text-muted">
          {phase === "open" ? `${timeLeft(v.challenge.endsAt - now)} left` : phase === "voting" ? `Voting closes in ${timeLeft(v.challenge.endsAt + hm.VOTE_WINDOW_SECS - now)}` : phase === "finalizable" ? "Ready to settle" : `${v.challenge.participants} took part`}
        </span>
      </div>
      {toVote.length > 0 && (
        <button onClick={() => onOpen(v, toVote[0].entry.owner.toBase58())} className="flex w-full items-center gap-3 rounded-[24px] bg-ink p-4 text-left text-white">
          <span className="min-w-0 flex-1"><span className="block font-medium">Time is up. Your vote counts.</span><span className="block text-sm text-[#C9CCC4]">{toVote.length} {toVote.length === 1 ? "friend" : "friends"} to vote on</span></span>
          <span className="pill bg-mand text-ink">Vote</span>
        </button>
      )}
      {v.entries.length === 0 ? <p className="text-sm text-muted">Nobody has locked money yet.</p> : (
        <ul className="grid grid-cols-2 gap-3">
          {v.entries.map((e, i) => {
            const st = entryState(e, phase);
            const canVote = !!v.mine && !e.isMe && (phase === "voting" || phase === "finalizable") && e.entry.status === hm.ENTRY.PENDING;
            return (
              <li key={e.entry.address.toBase58()}>
                <button onClick={() => onOpen(v, canVote ? e.entry.owner.toBase58() : undefined)}
                  className={`flex min-h-[132px] w-full flex-col justify-between rounded-[24px] p-3.5 text-left ${TILE[i % TILE.length]}`}
                  aria-label={`${e.isMe ? "You" : e.name}: ${e.goal ?? "goal"}, ${usd(e.stakeUsd)}, ${st}`}>
                  <span className="flex items-start justify-between gap-1">
                    <Avatar name={e.name} size={32} tone="bg-white" />
                    <StatePill state={st} />
                  </span>
                  <span>
                    <span className="block font-medium">{e.isMe ? "You" : e.name}</span>
                    <span className="line-clamp-2 block text-xs text-ink/80">{e.goal ?? "Goal"} · {usd(e.stakeUsd)}</span>
                    {canVote && <span className="mt-1 block text-xs font-medium">{e.myVote ? "You voted" : "Tap to vote"}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {phase === "open" && isMember && !v.mine && (
        <button onClick={() => onJoin(v)} className="btn btn-primary w-full">Lock money on my goal</button>
      )}
      {phase !== "open" && (
        <button onClick={() => onOpen(v)} className="btn btn-ink w-full">See results</button>
      )}
    </section>
  );
}

function Feed({ detail, now }: { detail: CrewDetail; now: number }) {
  // The feed is built from what is on-chain: locks, deadlines, votes and results. Chat is not built yet.
  const items = useMemo(() => {
    const out: { key: string; who: string; text: string; at: number; tone?: "kept" | "missed" }[] = [];
    for (const v of detail.challenges) {
      const start = Number(v.challenge.challengeId) / 1000;
      for (const e of v.entries) {
        out.push({ key: `${e.entry.address.toBase58()}-l`, who: e.name, text: `${e.isMe ? "You" : e.name} locked ${usd(e.stakeUsd)} on “${e.goal ?? "a goal"}”.`, at: start });
        const st = entryState(e, "settled");
        if (st === "kept" || st === "missed" || st === "refunded") {
          out.push({ key: `${e.entry.address.toBase58()}-r`, who: e.name, at: v.challenge.endsAt + 1,
            text: st === "kept" ? `${e.isMe ? "You" : e.name} kept “${e.goal ?? "their goal"}”.` : st === "missed" ? `${e.isMe ? "You" : e.name} missed “${e.goal ?? "their goal"}”.` : `${e.isMe ? "Your" : `${e.name}'s`} stake was refunded: no clear vote.`,
            tone: st === "kept" ? "kept" : st === "missed" ? "missed" : undefined });
        } else if (now >= v.challenge.endsAt && e.entry.passVotes + e.entry.failVotes > 0) {
          out.push({ key: `${e.entry.address.toBase58()}-v`, who: e.name, at: v.challenge.endsAt, text: `${e.entry.passVotes + e.entry.failVotes} ${e.entry.passVotes + e.entry.failVotes === 1 ? "vote" : "votes"} in on ${e.isMe ? "your goal" : e.name}.` });
        }
      }
      if (now >= v.challenge.endsAt) out.push({ key: `${v.challenge.address.toBase58()}-d`, who: "Kept", at: v.challenge.endsAt, text: "Time is up. Friends with money in can vote now." });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 30);
  }, [detail, now]);
  return (
    <section aria-label="Group feed" className="space-y-3">
      {items.length === 0 ? <Empty icon="chat-check" title="Quiet so far" body="Locks, votes and results show up here." /> : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.key} className={`flex items-start gap-3 rounded-2xl p-3 text-sm ${it.tone === "kept" ? "bg-[#ddefe5]" : "card"}`}>
              <Avatar name={it.who} size={32} />
              <span className="min-w-0 flex-1"><span className="block">{it.text}</span><span className="block text-xs text-muted">{dateLabel(it.at)}</span></span>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center justify-center gap-2 rounded-2xl bg-stone2 px-4 py-3 text-sm text-muted">Group chat and photo check-ins are coming soon</p>
    </section>
  );
}

// ---------------------------------------------------------------- goal detail

export function GoalScreen({ v, crewName, now, onBack, onResults, onAppeal }: { v: ChallengeView; crewName: string; now: number; onBack: () => void; onResults: () => void; onAppeal: () => void }) {
  const me = v.mine;
  const phase = phaseOf(v, now);
  const others = v.entries.filter((e) => !e.isMe);
  if (!me) return <Page><Header title="Goal" onBack={onBack} /><p className="text-muted">You are not in this round.</p></Page>;
  const start = Number(v.challenge.challengeId) / 1000;
  const votes = me.entry.passVotes + me.entry.failVotes;
  return (
    <Page>
      <Header title="Your goal" onBack={onBack} />
      <section className="hero-lilac p-5">
        <span className="pointer-events-none absolute right-1 top-9"><Icon3D name="padlock-key" size={88} glow /></span>
        <p className="flex items-center justify-between gap-2"><LockedPill /><span className="text-sm">{usd(me.usd)} on the line</span></p>
        <p className="mt-3 max-w-[75%] text-[22px] font-medium leading-tight tracking-tight">{me.goal ?? roundTitle(v)}</p>
        <div className="mt-4 flex items-center gap-4">
          <Ring percent={percentElapsed(v, now)} />
          <div>
            <p className="text-sm">{phase === "open" ? "Time left" : "Status"}</p>
            <p className="num text-[34px] leading-tight">{phase === "open" ? timeLeft(v.challenge.endsAt - now) : phase === "settled" ? "Settled" : "Voting"}</p>
            <p className="text-sm">Ends {dateLabel(v.challenge.endsAt)}</p>
            <p className="text-sm">{crewName}</p>
          </div>
        </div>
        {phase === "open" ? (
          <button disabled className="btn btn-primary mt-5 w-full disabled:opacity-100" aria-describedby="proof-soon">
            Upload proof <span id="proof-soon" className="pill bg-white/70 text-ink">Coming soon</span>
          </button>
        ) : (
          <button onClick={onResults} className="btn btn-primary mt-5 w-full">See results</button>
        )}
      </section>
      {phase === "open" && v.challenge.endsAt - now < 86400 && (
        <p role="status" className="rounded-2xl bg-peach px-4 py-3 text-sm"><span className="font-medium">Less than a day left.</span> Do the thing. When time is up your friends vote.</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <section className="card p-4" aria-labelledby="tl">
          <h2 id="tl" className="mb-3 text-sm font-medium">Timeline</h2>
          <ol className="space-y-3 text-sm">
            <TL done title={`Locked ${usd(me.usd)}`} sub={start > 0 ? dateLabel(start) : ""} />
            <TL done={others.length > 0} title={`${others.length} ${others.length === 1 ? "friend" : "friends"} joined`} />
            <TL done={now >= v.challenge.endsAt} title="Deadline" sub={dateLabel(v.challenge.endsAt)} />
            <TL done={phase === "settled"} title="Voting closes" sub={dateLabel(v.challenge.endsAt + hm.VOTE_WINDOW_SECS)} />
          </ol>
        </section>
        <section className="card p-4" aria-labelledby="fr">
          <h2 id="fr" className="text-sm font-medium">Friends</h2>
          <p className="mb-3 text-xs text-muted">{phase === "open" ? "They vote when time is up" : `${me.entry.passVotes} approved, ${me.entry.failVotes} disputed`}</p>
          {others.length === 0 ? <p className="text-sm text-muted">Invite friends so someone can vote on your goal.</p> : (
            <ul className="space-y-2">
              {others.slice(0, 5).map((e) => (
                <li key={e.entry.address.toBase58()} className="flex items-center gap-2 text-sm"><Avatar name={e.name} size={26} /><span className="truncate">{e.name}</span></li>
              ))}
            </ul>
          )}
          {phase !== "open" && <p className="mt-2 text-xs text-muted">{votes} of {others.length} voted</p>}
        </section>
      </div>
      {me.entry.status === hm.ENTRY.FAILED && <button onClick={onAppeal} className="min-h-11 text-sm text-muted underline">Disagree with this result</button>}
    </Page>
  );
}

function TL({ done, title, sub }: { done?: boolean; title: string; sub?: string }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className={`mt-1 h-3 w-3 shrink-0 rounded-full ${done ? "bg-violet-deep" : "border-2 border-violet-deep bg-white"}`} />
      <span><span className="block">{title}</span>{sub && <span className="block text-xs text-muted">{sub}</span>}</span>
    </li>
  );
}

// ---------------------------------------------------------------- vote

export function VoteScreen({ v, owner, now, busy, onBack, onVote, onNext }: {
  v: ChallengeView; owner: string; now: number; busy: boolean; onBack: () => void; onVote: (kept: boolean) => Promise<boolean>; onNext: (owner: string) => void;
}) {
  const phase = phaseOf(v, now);
  const e = v.entries.find((x) => x.entry.owner.toBase58() === owner);
  const voters = v.entries.length - 1;
  const queue = v.entries.filter((x) => !x.isMe && x.entry.status === hm.ENTRY.PENDING && !x.myVote);
  const idx = Math.max(0, v.entries.filter((x) => !x.isMe).findIndex((x) => x.entry.owner.toBase58() === owner));
  if (!e) return <Page><Header title="Vote" onBack={onBack} /><Spinner label="Loading" /></Page>;
  const cast = e.entry.passVotes + e.entry.failVotes;
  const reason = e.isMe ? "You can't vote on your own goal." : !v.mine ? "Only people with money in this round can vote." : phase === "open" ? "Voting opens when time is up." : e.entry.status !== hm.ENTRY.PENDING ? "This one is decided." : e.myVote ? "Your vote is in." : null;
  const next = queue.find((x) => x.entry.owner.toBase58() !== owner);
  return (
    <Page>
      <Header title="Vote" onBack={onBack} right={<span className="text-sm text-muted">{idx + 1} of {voters}</span>} />
      <h1 className="text-[30px] font-medium leading-tight tracking-tight">Did {e.name} keep it?</h1>
      <p className="-mt-2 text-muted">{e.goal ?? "Their goal"} · {usd(e.stakeUsd)}</p>
      <section className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[24px] bg-sky p-6 text-center">
        <Icon3D name="camera" size={88} />
        <p className="font-medium">Proof in the app is coming soon</p>
        <p className="text-sm text-muted">Ask {e.name} for a screenshot in your group chat, then vote.</p>
      </section>
      <div>
        <p className="flex items-center justify-between text-sm"><span>{cast} of {voters} voted</span><span className="text-muted">{phase === "voting" ? `Closes in ${timeLeft(v.challenge.endsAt + hm.VOTE_WINDOW_SECS - now)}` : ""}</span></p>
        <div className="mt-2 flex gap-1.5" aria-hidden>{Array.from({ length: Math.max(1, voters) }, (_, i) => <i key={i} className={`h-1.5 flex-1 rounded-full ${i < cast ? "bg-violet-deep" : "bg-stone"}`} />)}</div>
      </div>
      {reason ? (
        <p role="status" className="rounded-2xl bg-stone2 px-4 py-3 text-sm">{reason}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button disabled={busy} onClick={() => onVote(true)} className="btn btn-forest" aria-label={`${e.name} kept their word`}><Check className="h-4 w-4" aria-hidden /> Approve</button>
          <button disabled={busy} onClick={() => onVote(false)} className="btn btn-quiet" aria-label={`${e.name} did not keep their word`}><X className="h-4 w-4" aria-hidden /> Dispute</button>
        </div>
      )}
      {busy && <Spinner label="Sending your vote" />}
      {e.myVote && next && <button onClick={() => onNext(next.entry.owner.toBase58())} className="btn btn-primary w-full">Next: {next.name}</button>}
      <p className="text-xs text-muted">Most votes decides. A tie, or no votes by the time voting closes, refunds the stake.</p>
    </Page>
  );
}

// ---------------------------------------------------------------- results

export function ResultsScreen({ v, crewName, now, busy, onBack, onVote, onCollect, onAppeal }: {
  v: ChallengeView; crewName: string; now: number; busy: string | null; onBack: () => void;
  onVote: (owner: string) => void; onCollect: () => Promise<boolean>; onAppeal: () => void;
}) {
  const phase = phaseOf(v, now);
  const me = v.mine;
  if (phase === "open") {
    return <Page><Header title="Results" onBack={onBack} /><Empty icon="clock" title="Still running" body={`Results come after the deadline, ${dateLabel(v.challenge.endsAt)}.`} /></Page>;
  }
  if (phase === "voting") {
    const toVote = me ? v.entries.filter((e) => !e.isMe && e.entry.status === hm.ENTRY.PENDING && !e.myVote) : [];
    return (
      <Page>
        <Header title="Results" onBack={onBack} />
        <Empty icon="chat-check" title={v.challenge.participants < 2 ? "Nobody else can vote" : "Friends are voting"} body={`${v.challenge.participants < 2 ? "You were the only one in this round, so your stake comes back. " : ""}Voting closes in ${timeLeft(v.challenge.endsAt + hm.VOTE_WINDOW_SECS - now)}. Anything still undecided then is settled by the votes cast, and a tie or no votes refunds.`}>
          {toVote.length > 0 && <button onClick={() => onVote(toVote[0].entry.owner.toBase58())} className="btn btn-primary w-full">Vote on {toVote[0].name}</button>}
        </Empty>
        <VoteList v={v} />
      </Page>
    );
  }
  // settled, or finalizable (the outcome is known once the pending entries are finalized)
  const o = outcomeOf(v);
  const myState = me ? (phase === "settled" ? entryState(me, "settled") : null) : null;
  const myRow = o.rows.find((r) => r.e.isMe);
  const headline = !me ? "Round results" : myState === "kept" ? "You kept it." : myState === "missed" ? "You missed it." : myState === "refunded" ? "Refunded." : "Voting is closed.";
  const hero = myState === "kept" ? "bg-mand text-ink" : myState === "missed" ? "bg-stone2 text-ink" : "hero-lilac";
  const share = myRow && me ? Math.max(0, myRow.payout - me.usd) : 0;
  return (
    <Page>
      <Header title="Results" onBack={onBack} right={<span className="text-xs text-muted">{crewName}</span>} />
      <section className={`relative overflow-hidden rounded-[24px] p-5 ${hero}`}>
        <span className="pointer-events-none absolute -right-1 -top-1"><Icon3D name={myState === "kept" ? "trophy" : myState === "missed" ? "coins-stack" : "cash"} size={88} glow={myState !== "kept"} /></span>
        <p className="text-[28px] font-medium leading-tight tracking-tight">{headline}</p>
        {me && <p className="mt-1 max-w-[70%] text-sm">{me.goal ?? roundTitle(v)}</p>}
        {phase === "settled" && me ? (
          <>
            <p className="num mt-4 text-[52px] leading-none">{usd(me.payoutUsd)}</p>
            <p className="mt-3 flex flex-wrap gap-2">
              <span className="pill bg-white text-ink">{usd(me.usd)} stake</span>
              {share > 0.004 && <span className="pill bg-ink text-white">+ {usd(share)} share</span>}
            </p>
          </>
        ) : phase === "finalizable" ? (
          <p className="mt-3 text-sm">Some goals got no clear vote. Settling counts the votes cast; a tie or no votes refunds that stake.</p>
        ) : null}
      </section>

      {phase === "settled" && (
        <div className="flex flex-col gap-3">
          <ul className="card divide-y divide-stone px-4 py-1" aria-label="Who gets what">
            {o.rows.map(({ e, state, payout }) => (
              <li key={e.entry.address.toBase58()} className="flex items-center gap-2 py-2.5">
                <Avatar name={e.name} size={28} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{e.isMe ? "You" : e.name}</span><span className="mono block whitespace-nowrap text-xs text-muted">{usd(e.stakeUsd)} in · {usd(payout)} out</span></span>
                <StatePill state={state} />
              </li>
            ))}
          </ul>
          <section className="flex w-full flex-col rounded-[24px] bg-ink p-4 text-white" aria-label="Forfeited money">
            <span className="text-xs text-[#C9CCC4]">Forfeited</span>
            <span className="num text-[28px] leading-tight">{usd(o.forfeited)}</span>
            {o.refundAll ? <span className="mt-auto text-xs text-[#C9CCC4]">Everyone gets their stake back. No fee.</span> : (
              <span className="mt-auto space-y-1 text-xs text-[#C9CCC4]">
                <span className="block">{KEEPERS_PERCENT}% · {usd(o.toKeepers)} to who kept it</span>
                <span className="block">{FEE_PERCENT}% · {usd(o.fee)} to {PROJECT_NAME}</span>
              </span>
            )}
          </section>
        </div>
      )}

      {me && !me.entry.claimed && (phase === "finalizable" || phase === "settled") && (
        <button disabled={busy === "collect"} onClick={onCollect} className="btn btn-primary w-full">
          {busy === "collect" ? "Settling" : phase === "finalizable" ? "Settle and collect" : me.payoutUsd > 0 ? `Collect ${usd(me.payoutUsd)}` : "Close this round"}
        </button>
      )}
      {busy === "collect" && <Spinner label="Settling on the shared ledger. This takes a few seconds." />}
      {me?.entry.claimed && <p className="text-center text-sm text-muted">Collected. It is in your balance.</p>}
      {myState === "missed" && (
        <button onClick={onAppeal} className="flex min-h-11 items-center justify-center gap-2 text-sm text-muted underline">Appeal with Grok <PreviewBadge /></button>
      )}
      <p className="text-center text-xs text-muted">Settled by code, not held by us.</p>
    </Page>
  );
}

function VoteList({ v }: { v: ChallengeView }) {
  return (
    <ul className="card divide-y divide-stone px-4 py-1">
      {v.entries.map((e) => (
        <li key={e.entry.address.toBase58()} className="flex items-center gap-2 py-2.5 text-sm">
          <Avatar name={e.name} size={28} />
          <span className="flex-1">{e.isMe ? "You" : e.name}</span>
          <span className="mono text-xs text-muted">{e.entry.passVotes} yes · {e.entry.failVotes} no</span>
        </li>
      ))}
    </ul>
  );
}
