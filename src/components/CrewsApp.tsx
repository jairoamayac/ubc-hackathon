"use client";

// Kept v5, wired to the live program. Tabs: Home (balance, goals, groups), Group (members and feed), Me.
// Pushed screens: goal detail, new goal wizard, vote, results. Sheets: add funds (simulated Apple Pay),
// withdraw, appeal (preview). Design: docs/brand/kept-lila and design/kept-v5.
import { ArrowRight, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PublicKey } from "@solana/web3.js";
import { LiveClient, friendlyError, type ChallengeView, type CrewDetail, type CrewView, type Snapshot } from "@/lib/house-money/solana/live";
import { FEE_PERCENT, KEEPERS_PERCENT, PROJECT_NAME } from "@/lib/brand";
import { usd } from "@/lib/format";
import { ENTRY } from "@/lib/house-money/solana/hm";
import { Onboarding } from "./Onboarding";
import { useAuth } from "./auth/AuthContext";
import { GroupScreen, GoalScreen, ResultsScreen, VoteScreen } from "./CrewRoom";
import { NewGoal } from "./kept/NewGoal";
import { AppealSheet } from "./AppealSheet";
import { VerifySheet } from "./VerifySheet";
import { myGoals, percentElapsed, roundTitle, type MyGoal } from "./kept/model";
import { Avatar, BottomNav, Dialog, Empty, ErrorNote, Header, Icon3D, LockedPill, Page, Shell, Spinner, StatePill, timeLeft, Wordmark, type Tab } from "./kept/ui";
import { entryState } from "./kept/model";

export type Act = (label: string, fn: () => Promise<unknown>, done?: string) => Promise<boolean>;
export type Route =
  | { id: "tab"; tab: Tab }
  | { id: "goal"; crew: string; ch: string }
  | { id: "vote"; crew: string; ch: string; owner: string }
  | { id: "results"; crew: string; ch: string }
  | { id: "new"; crew?: string; join?: string }
  | { id: "newGroup" };
type Sheet = null | { id: "addFunds" } | { id: "withdraw" } | { id: "appeal"; v: ChallengeView } | { id: "verify"; v: ChallengeView };

const YEAR = 31_536_000;
/** Background refresh. Slow on purpose (RPC credits and rate limits); actions refresh right away anyway. */
const POLL_MS = 45_000;

export default function CrewsApp() {
  const auth = useAuth();
  const name = useSyncExternalStore(subscribeName, () => localStorage.getItem("hm.name") ?? "", () => null);
  const [client, setClient] = useState<LiveClient | null>(null);
  const [connectErr, setConnectErr] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [snapErr, setSnapErr] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, CrewDetail>>({});
  const [route, setRoute] = useState<Route>({ id: "tab", tab: "home" });
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "ok" ? 4000 : 8000);
    return () => clearTimeout(t);
  }, [toast]);

  // The signed-in account (Privy) signs; without one, the demo key kept on this device. Retries with backoff.
  const connect = useCallback(() => {
    setConnectErr(null);
    let attempt = 0;
    const tryOnce = () => {
      LiveClient.connect(auth.signer).then(setClient).catch((e) => {
        if (attempt++ < 3) setTimeout(tryOnce, 1500 * 2 ** attempt);
        else setConnectErr(friendlyError(e));
      });
    };
    tryOnce();
  }, [auth.signer]);

  useEffect(() => {
    const t = setTimeout(connect, 0);
    // Invite links: /?crew=<address> opens that group so a friend can join in one tap.
    const invited = new URLSearchParams(location.search).get("crew");
    if (invited) {
      try {
        const key = new PublicKey(invited).toBase58();
        setTimeout(() => {
          setGroupKey(key);
          setRoute({ id: "tab", tab: "group" });
        }, 0);
      } catch {
        /* not a group link */
      }
    }
    return () => clearTimeout(t);
  }, [connect]);

  // Names are stored on-chain (sponsored) so friends see "Leo", never an address.
  useEffect(() => {
    if (!client || !name || localStorage.getItem("hm.profile") === name) return;
    client.setProfile(name).then(() => localStorage.setItem("hm.profile", name)).catch(() => {});
  }, [client, name]);

  const groupKeyRef = useRef(groupKey);
  useEffect(() => {
    groupKeyRef.current = groupKey;
  }, [groupKey]);

  /** One read of everything. Returns false on failure; background failures keep the last good data on screen. */
  const refresh = useCallback(async () => {
    if (!client) return false;
    try {
      const s = await client.snapshot();
      setSnap(s);
      setSnapErr(null);
      const keys = new Set(s.crews.filter((c) => c.me).map((c) => c.address.toBase58()));
      if (groupKeyRef.current) keys.add(groupKeyRef.current);
      const loaded = await Promise.all([...keys].map(async (k) => {
        try {
          return [k, await client.crewDetail(new PublicKey(k))] as const;
        } catch {
          return null;
        }
      }));
      setDetails((prev) => {
        const next = { ...prev };
        for (const l of loaded) if (l) next[l[0]] = l[1];
        return next;
      });
      return true;
    } catch (e) {
      setSnapErr(friendlyError(e));
      return false;
    }
  }, [client]);

  // After an action: refresh now and again shortly, because a read can lag behind a confirmed change.
  const settleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const refreshSoon = useCallback(() => {
    settleTimers.current.forEach(clearTimeout);
    settleTimers.current = [0, 3000, 8000].map((d) => setTimeout(() => void refresh(), d));
  }, [refresh]);
  useEffect(() => {
    const timers = settleTimers;
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // Slow poll with backoff when it fails, paused while the tab is hidden, refreshed when you come back.
  useEffect(() => {
    if (!client) return;
    let stop = false;
    let fails = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      if (document.hidden) {
        timer = setTimeout(tick, 5_000);
        return;
      }
      const ok = await refresh();
      fails = ok ? 0 : fails + 1;
      if (!stop) timer = setTimeout(tick, ok ? POLL_MS : Math.min(30_000, 2_000 * 2 ** (fails - 1)));
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
  }, [client, refresh]);

  // Load an invited or newly opened group right away.
  useEffect(() => {
    if (!client || !groupKey || details[groupKey]) return;
    client.crewDetail(new PublicKey(groupKey)).then((d) => setDetails((p) => ({ ...p, [groupKey]: d }))).catch(() => {});
  }, [client, groupKey, details]);

  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  const busyRef = useRef(false);
  const act: Act = async (label, fn, done) => {
    if (busyRef.current) return false; // one action at a time: no double taps
    busyRef.current = true;
    setBusy(label);
    setToast(null);
    try {
      await fn();
      // Confirmed: close sheets and say so now, then catch the screen up in the background.
      refreshSoon();
      if (done) setToast({ text: done, tone: "ok" });
      return true;
    } catch (e) {
      setToast({ text: friendlyError(e), tone: "err" });
      return false;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const crewNames = useMemo(() => Object.fromEntries((snap?.crews ?? []).map((c) => [c.address.toBase58(), c.name])), [snap]);
  const goals = useMemo(() => myGoals(details, crewNames, now), [details, crewNames, now]);

  if (name === null) return <Shell />;
  if (!name) {
    return (
      <Shell>
        <Onboarding onDone={(n) => setName(n)} />
      </Shell>
    );
  }

  const myGroups = snap?.crews.filter((c) => c.me) ?? [];
  const free = myGroups.reduce((s, c) => s + liveValue(c, snap!, now), 0);
  const onLine = goals.filter((g) => !g.me.entry.claimed).reduce((s, g) => s + (g.phase === "settled" ? g.me.payoutUsd : g.me.usd), 0);
  const activeKey = groupKey ?? myGroups[0]?.address.toBase58() ?? null;
  const crewOf = (k: string) => snap?.crews.find((c) => c.address.toBase58() === k);
  const viewOf = (k: string, ch: string) => details[k]?.challenges.find((c) => c.challenge.address.toBase58() === ch);
  const go = (r: Route) => setRoute(r);
  const tab: Tab = route.id === "tab" ? route.tab : route.id === "vote" || route.id === "results" ? "group" : "home";

  const collect = async (crewKey: string, v: ChallengeView) => {
    const amount = v.mine?.payoutUsd ?? 0;
    return act("collect", () => client!.finalizeAndClaim(new PublicKey(crewKey), v, now),
      amount > 0 ? `${usd(amount)} is back in your balance.` : "Settled.");
  };

  let body: React.ReactNode;
  if (connectErr) {
    body = <Page><Wordmark /><ErrorNote text={`We could not reach ${PROJECT_NAME}. ${connectErr}`} onRetry={connect} /></Page>;
  } else if (!snap) {
    body = (
      <Page>
        <Wordmark />
        {snapErr ? <ErrorNote text={snapErr} onRetry={refresh} /> : <Spinner label="Loading your balance" />}
        <div className="h-[132px] animate-pulse rounded-[24px] bg-stone2" aria-hidden />
        <div className="h-[180px] animate-pulse rounded-[24px] bg-lilac-tint" aria-hidden />
      </Page>
    );
  } else if (route.id === "tab" && route.tab === "home") {
    body = <Home name={name} cash={snap.cash} free={free} onLine={onLine} goals={goals} groups={myGroups} details={details} now={now}
      onGoal={(g) => go(g.phase === "open" ? { id: "goal", crew: g.crew.crew.toBase58(), ch: g.v.challenge.address.toBase58() } : { id: "results", crew: g.crew.crew.toBase58(), ch: g.v.challenge.address.toBase58() })}
      onGroup={(k) => { setGroupKey(k); go({ id: "tab", tab: "group" }); }}
      onNewGoal={() => go(myGroups.length ? { id: "new" } : { id: "newGroup" })}
      onNewGroup={() => go({ id: "newGroup" })}
      onAddFunds={() => setSheet({ id: "addFunds" })} />;
  } else if (route.id === "tab" && route.tab === "me") {
    body = <Me name={name} cash={snap.cash} free={free} goals={goals} groups={myGroups.length}
      onAddFunds={() => setSheet({ id: "addFunds" })} onWithdraw={() => setSheet({ id: "withdraw" })} onRename={() => setName("")} />;
  } else if (route.id === "tab" && route.tab === "group") {
    const crew = activeKey ? crewOf(activeKey) : undefined;
    body = !activeKey ? (
      <Page>
        <Header title="Group" />
        <Empty icon="friends" title="Start with your people" body="A group is you and a few friends, each with money on a goal. Create one and share the invite link.">
          <button onClick={() => go({ id: "newGroup" })} className="btn btn-primary w-full">Start a group</button>
        </Empty>
      </Page>
    ) : !crew ? (
      <Page><Header title="Group" /><Spinner label="Opening the group" /></Page>
    ) : (
      <GroupScreen client={client!} crew={crew} detail={details[activeKey]} groups={myGroups} now={now} busy={busy} act={act}
        free={liveValue(crew, snap, now)} cash={snap.cash}
        onSwitch={(k) => setGroupKey(k)} onNewGroup={() => go({ id: "newGroup" })}
        onOpen={(v, owner) => {
          const k = activeKey, ch = v.challenge.address.toBase58();
          if (owner) go({ id: "vote", crew: k, ch, owner });
          else go(v.mine && v.challenge.endsAt > now ? { id: "goal", crew: k, ch } : { id: "results", crew: k, ch });
        }}
        onJoin={(v) => go({ id: "new", crew: activeKey, join: v.challenge.address.toBase58() })}
        onNewGoal={() => go({ id: "new", crew: activeKey })}
        onAddFunds={() => setSheet({ id: "addFunds" })} />
    );
  } else if (route.id === "goal" || route.id === "vote" || route.id === "results") {
    const v = viewOf(route.crew, route.ch);
    const crew = crewOf(route.crew);
    const back = () => go({ id: "tab", tab: route.id === "goal" ? "home" : "group" });
    if (!v || !crew) body = <Page><Header onBack={back} /><Spinner label="Loading" /></Page>;
    else if (route.id === "goal") body = <GoalScreen v={v} crewName={crew.name} now={now} onBack={back} onResults={() => go({ id: "results", crew: route.crew, ch: route.ch })} onAppeal={() => setSheet({ id: "appeal", v })} onVerify={() => setSheet({ id: "verify", v })} />;
    else if (route.id === "vote") {
      body = <VoteScreen v={v} owner={route.owner} now={now} busy={busy === "vote"} onBack={back}
        onVote={(kept) => act("vote", () => client!.voteEntry(new PublicKey(route.crew), v.challenge.address, new PublicKey(route.owner), kept), "Thanks. Your vote is in.")}
        onNext={(owner) => go({ id: "vote", crew: route.crew, ch: route.ch, owner })} />;
    } else body = <ResultsScreen v={v} crewName={crew.name} now={now} busy={busy} onBack={back}
      onVote={(owner) => go({ id: "vote", crew: route.crew, ch: route.ch, owner })}
      onCollect={() => collect(route.crew, v)} onAppeal={() => setSheet({ id: "appeal", v })} />;
  } else if (route.id === "new") {
    const crewKey = route.crew ?? activeKey ?? myGroups[0]?.address.toBase58();
    const crew = crewKey ? crewOf(crewKey) : undefined;
    const join = route.join && crewKey ? viewOf(crewKey, route.join) : undefined;
    body = (
      <NewGoal groups={myGroups} crew={crew} join={join} cash={snap.cash} now={now} busy={busy}
        freeIn={(c) => liveValue(c, snap, now)}
        onPickGroup={(k) => setGroupKey(k)}
        onBack={() => go({ id: "tab", tab: route.join ? "group" : "home" })}
        onAddFunds={() => setSheet({ id: "addFunds" })}
        onLock={async ({ crew: c, goal, stake, minutes, minStake }) => {
          const freeHere = liveValue(c, snap, now);
          const short = Math.max(0, Math.ceil((stake - freeHere) * 100) / 100);
          const ok = await act("lock", async () => {
            if (short > 0) await client!.deposit(c.address, short, !!c.me);
            if (join) await client!.joinWithGoal(c.address, join.challenge.address, goal, stake);
            else await client!.startCommitment(c.address, `Pact: ${goal}`.slice(0, 80), minStake, minutes, goal, stake);
          }, `Locked ${usd(stake)}. Invite your friends to join.`);
          if (ok) {
            setGroupKey(c.address.toBase58());
            go({ id: "tab", tab: "group" });
          }
          return ok;
        }} />
    );
  } else {
    body = <NewGroup busy={busy === "create"} onBack={() => go({ id: "tab", tab: "home" })}
      onCreate={async (n) => {
        const id = BigInt(Date.now());
        const ok = await act("create", () => client!.createCrew(n, "", id), `${n} is ready. Share the invite link with your friends.`);
        if (ok) {
          setGroupKey(client!.crewAddress(id).toBase58());
          go({ id: "tab", tab: "group" });
        }
      }} />;
  }

  return (
    <Shell>
      <div aria-live="polite" role="status" className="sr-only">{toast?.tone === "ok" ? toast.text : ""}</div>
      {toast && (
        <div role={toast.tone === "err" ? "alert" : undefined}
          className={`fixed left-1/2 top-4 z-50 flex w-[min(400px,92vw)] -translate-x-1/2 items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-[0_14px_30px_rgba(46,34,96,.25)] ${toast.tone === "ok" ? "bg-forest text-white" : "border border-danger bg-white text-danger"}`}>
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss message" className="-m-2 flex h-11 w-11 items-center justify-center">×</button>
        </div>
      )}
      {busy && <div className="fixed inset-x-0 top-0 z-50 h-1 animate-pulse bg-mand" role="progressbar" aria-label="Working" />}
      {body}
      {snap && (route.id === "tab" || route.id === "vote" || route.id === "results" || route.id === "goal") && (
        <BottomNav tab={tab} onTab={(t) => go({ id: "tab", tab: t })} />
      )}

      {sheet && snap && (
        <Dialog title={sheet.id === "addFunds" ? "Add funds" : sheet.id === "withdraw" ? "Withdraw" : sheet.id === "verify" ? "Verify with Grok" : "Appeal"} onClose={() => setSheet(null)}>
          {sheet.id === "addFunds" && (
            <ApplePaySheet busy={busy === "topup"} onPay={async (amt) => {
              if (await act("topup", () => client!.topUp(amt), `${usd(amt)} added.`)) setSheet(null);
            }} />
          )}
          {sheet.id === "withdraw" && (
            <WithdrawSheet groups={myGroups} busy={busy === "withdraw"} valueOf={(c) => liveValue(c, snap, now)}
              onWithdraw={async (c, amt) => {
                const all = amt >= liveValue(c, snap, now) - 0.000001;
                if (await act("withdraw", () => client!.withdraw(c, all ? "all" : amt), `${usd(amt)} moved to your balance.`)) setSheet(null);
              }} />
          )}
          {sheet.id === "appeal" && <AppealSheet pact={sheet.v} onClose={() => setSheet(null)} />}
          {sheet.id === "verify" && <VerifySheet pact={sheet.v} onClose={() => setSheet(null)} />}
        </Dialog>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- tabs

const PASTELS = ["bg-fit", "bg-sky", "bg-butter", "bg-lilac-pastel", "bg-peach"];

function Home({ name, cash, free, onLine, goals, groups, details, now, onGoal, onGroup, onNewGoal, onNewGroup, onAddFunds }: {
  name: string; cash: number; free: number; onLine: number; goals: MyGoal[]; groups: CrewView[]; details: Record<string, CrewDetail>; now: number;
  onGoal: (g: MyGoal) => void; onGroup: (k: string) => void; onNewGoal: () => void; onNewGroup: () => void; onAddFunds: () => void;
}) {
  const active = goals.filter((g) => !g.me.entry.claimed);
  return (
    <Page>
      <header className="flex items-center justify-between">
        <Wordmark />
        <Avatar name={name} size={40} />
      </header>
      <h1 className="text-[30px] font-medium leading-tight tracking-tight">Hi, {name}</h1>
      <section className="grid grid-cols-2 gap-3" aria-label="Your money">
        <button onClick={onAddFunds} className="flex min-h-[112px] flex-col justify-between rounded-[24px] bg-ink p-4 text-left text-white shadow-[0_12px_28px_rgba(26,26,24,.28)]" aria-label={`Balance ${usd(cash + free)}. Add funds`}>
          <span className="text-sm text-[#C9CCC4]">Balance</span>
          <span className="num text-[30px] leading-none">{usd(cash + free)}</span>
          <span className="text-xs text-[#C9CCC4]">Add funds</span>
        </button>
        <div className="flex min-h-[112px] flex-col justify-between rounded-[24px] bg-peach p-4">
          <span className="text-sm">On the line</span>
          <span className="num text-[30px] leading-none">{usd(onLine)}</span>
          <span className="text-xs text-muted">{active.length} {active.length === 1 ? "goal" : "goals"}</span>
        </div>
      </section>

      <div className="mt-1 flex items-center justify-between">
        <h2 className="text-[17px] font-medium">Active goals</h2>
        <button onClick={onNewGoal} className="btn btn-primary min-h-10 px-4 text-sm" style={{ borderBottomWidth: 3 }}><Plus className="h-4 w-4" aria-hidden /> New goal</button>
      </div>
      {active.length === 0 ? (
        <Empty icon="padlock-key" title="Nothing on the line yet" body="Pick a goal you can measure, lock money on it, and your friends keep you honest.">
          <button onClick={onNewGoal} className="btn btn-primary w-full">{groups.length ? "New goal" : "Start a group"}</button>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {active.map((g) => {
            const st = entryState(g.me, g.phase);
            const pct = percentElapsed(g.v, now);
            return (
              <li key={g.me.entry.address.toBase58()}>
                <button onClick={() => onGoal(g)} className="hero-lilac block w-full p-5 text-left" aria-label={`Open goal: ${g.me.goal ?? roundTitle(g.v)}`}>
                  <span className="pointer-events-none absolute -right-2 -top-1"><Icon3D name={g.phase === "open" ? "padlock-key" : g.phase === "settled" ? "trophy" : "chat-check"} size={80} glow /></span>
                  <span className="flex flex-wrap items-center gap-2">
                    {g.phase === "open" ? <LockedPill /> : <StatePill state={st} />}
                    <span className="pill bg-white/60 text-violet-deep">{g.crewName}</span>
                  </span>
                  <span className="mt-3 block max-w-[78%] text-[22px] font-medium leading-tight tracking-tight">{g.me.goal ?? roundTitle(g.v)}</span>
                  <span className="mt-3 flex items-center gap-3">
                    <span className="num text-[36px] leading-none">{usd(g.me.usd)}</span>
                    <span className="pill bg-white text-ink">{g.phase === "open" ? `${timeLeft(g.v.challenge.endsAt - now)} left` : g.phase === "settled" ? "See results" : g.v.challenge.participants < 2 ? "Refund on the way" : "Friends are voting"}</span>
                  </span>
                  {g.phase === "open" && (
                    <span className="mt-4 block">
                      <span className="block h-2.5 overflow-hidden rounded-full bg-[rgba(46,34,96,.16)]" aria-hidden><span className="block h-full rounded-full bg-violet-deep" style={{ width: `${Math.max(3, pct)}%` }} /></span>
                      <span className="mt-1 flex justify-between text-xs"><span>Time used</span><span>{Math.round(pct)}%</span></span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1 flex items-center justify-between">
        <h2 className="text-[17px] font-medium">Groups</h2>
        <button onClick={onNewGroup} className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-violet-deep"><Plus className="h-4 w-4" aria-hidden /> New group</button>
      </div>
      {groups.length === 0 ? (
        <Empty icon="friends" title="No groups yet" body="Create a group and share the invite link in your group chat.">
          <button onClick={onNewGroup} className="btn btn-quiet w-full">Start a group</button>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {groups.map((c, i) => {
            const k = c.address.toBase58();
            const people = details[k]?.people ?? [];
            return (
              <li key={k}>
                <button onClick={() => onGroup(k)} className="card flex min-h-16 w-full items-center gap-3 p-4 text-left">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${PASTELS[i % PASTELS.length]} font-medium`} aria-hidden>{c.name[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block text-sm text-muted">{c.members} {c.members === 1 ? "person" : "people"} · {usd(c.vault)} pot</span>
                  </span>
                  <span className="flex -space-x-2" aria-hidden>{people.slice(0, 4).map((p) => <Avatar key={p.owner.toBase58()} name={p.name} size={26} />)}</span>
                  <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

function Me({ name, cash, free, goals, groups, onAddFunds, onWithdraw, onRename }: {
  name: string; cash: number; free: number; goals: MyGoal[]; groups: number; onAddFunds: () => void; onWithdraw: () => void; onRename: () => void;
}) {
  const decided = goals.filter((g) => g.phase === "settled");
  const kept = decided.filter((g) => entryState(g.me, "settled") === "kept").length;
  const judged = decided.filter((g) => ["kept", "missed"].includes(entryState(g.me, "settled"))).length;
  return (
    <Page>
      <header className="flex items-center gap-4">
        <Avatar name={name} size={64} />
        <div>
          <h1 className="text-[26px] font-medium leading-tight tracking-tight">{name}</h1>
          <p className="text-sm text-muted">{groups} {groups === 1 ? "group" : "groups"}</p>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-3">
        <div className="hero-lilac row-span-2 flex min-h-[200px] flex-col justify-end p-4">
          <span className="pointer-events-none absolute -right-3 -top-2"><Icon3D name="piggy-bank" size={96} glow /></span>
          <span className="text-sm">Balance</span>
          <span className="num text-[34px] leading-none">{usd(cash + free)}</span>
        </div>
        <div className="flex min-h-[94px] flex-col justify-between rounded-[24px] bg-ink p-4 text-white">
          <span className="num text-[28px] leading-none">{judged ? `${Math.round((kept / judged) * 100)}%` : "None yet"}</span>
          <span className="text-sm text-[#C9CCC4]">Kept rate</span>
        </div>
        <div className="flex min-h-[94px] flex-col justify-between rounded-[24px] bg-peach p-4">
          <span className="num text-[28px] leading-none">{kept} of {judged}</span>
          <span className="text-sm">Goals kept</span>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onAddFunds} className="btn btn-ink"><Plus className="h-4 w-4" aria-hidden /> Add funds</button>
        <button onClick={onWithdraw} className="btn btn-quiet" disabled={free < 0.01}>Withdraw</button>
      </div>
      <p className="-mt-2 text-center text-xs text-muted">Add funds with a card or Apple Pay. Test dollars in this preview.</p>

      <section className="card p-5" aria-labelledby="hist">
        <h2 id="hist" className="font-medium">History</h2>
        {goals.length === 0 ? <p className="mt-2 text-sm text-muted">Your locked and collected goals show up here.</p> : (
          <ul className="mt-2 divide-y divide-stone">
            {[...goals].reverse().slice(0, 8).map((g) => {
              const st = g.phase === "settled" ? entryState(g.me, "settled") : null;
              const collected = g.me.entry.claimed;
              const delta = collected ? g.me.payoutUsd - g.me.usd : -g.me.usd;
              // A refund nets $0: say the stake came back instead of "+$0.00". No dollar figure, because shares
              // are priced at today's pot, which drifts once people take their money out.
              const refunded = collected && st !== "missed" && (g.me.entry.status === ENTRY.REFUNDED || g.v.challenge.passedShares === 0n);
              const label = !collected ? "Locked" : st === "missed" ? "Missed" : refunded ? "Refunded" : "Collected";
              return (
                <li key={g.me.entry.address.toBase58()} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{label} · {g.me.goal ?? roundTitle(g.v)}</span>
                    <span className="block text-xs text-muted">{g.crewName}</span>
                  </span>
                  <span className={`mono shrink-0 text-sm ${delta > 0 ? "text-forest" : ""}`}>{refunded ? "Stake back" : usd(delta, { sign: true })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="safe-title" className="card space-y-2 p-5 text-sm text-muted">
        <h2 id="safe-title" className="flex items-center gap-2 font-medium text-ink">Who holds your money</h2>
        <p>Not us, and not your friends. Money sits in your group&apos;s pot, held by code nobody can change. Locked money moves only after the people who put money in vote on the result.</p>
        <p>When someone misses, {KEEPERS_PERCENT}% of their stake goes to the friends who kept their word and {FEE_PERCENT}% to {PROJECT_NAME}.</p>
      </section>
      <button onClick={onRename} className="btn btn-quiet">Change name</button>
    </Page>
  );
}

// ---------------------------------------------------------------- helpers

const nameListeners = new Set<() => void>();
function subscribeName(cb: () => void) {
  nameListeners.add(cb);
  return () => {
    nameListeners.delete(cb);
  };
}
function setName(n: string) {
  if (n) localStorage.setItem("hm.name", n);
  else localStorage.removeItem("hm.name");
  nameListeners.forEach((cb) => cb());
}

function pending(c: CrewView, snap: Snapshot, now: number) {
  const principal = Number(c.totalPrincipal) / 1e6;
  const elapsed = Math.max(0, now - c.lastAccrual);
  return (principal * (snap.config.apyBps / 10_000) * snap.config.timeWarp * elapsed) / YEAR;
}
/** Your free (not locked) money in a group, including what accrues every second. */
export function liveValue(c: CrewView, snap: Snapshot, now: number) {
  if (!c.me) return 0;
  const share = c.vault > 0 ? c.me.value / c.vault : 0;
  return c.me.value + pending(c, snap, now) * share;
}

function ApplePaySheet({ onPay, busy }: { onPay: (amt: number) => void; busy: boolean }) {
  const [amt, setAmt] = useState(50);
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Amount</legend>
        <div className="grid grid-cols-3 gap-2">
          {[20, 50, 100].map((a) => <button key={a} onClick={() => setAmt(a)} aria-pressed={amt === a} className="tile min-h-12 py-3 text-xl font-medium">${a}</button>)}
        </div>
      </fieldset>
      <div className="card space-y-2 p-4 text-sm">
        <p className="flex justify-between"><span className="text-muted">Pay with</span><span>Apple Pay · Visa ••4242</span></p>
        <p className="flex justify-between"><span className="text-muted">Fee</span><span>$0.00</span></p>
        <p className="flex justify-between text-base font-medium"><span>Total</span><span className="tabular-nums">{usd(amt)}</span></p>
      </div>
      <button disabled={busy} onClick={() => onPay(amt)} className="btn w-full bg-black py-4 text-lg text-white">{busy ? "Processing" : `Pay ${usd(amt)} with Apple Pay`}</button>
      <p className="text-center text-xs text-muted">Preview: no card is charged. You get test dollars right away.</p>
    </div>
  );
}

function WithdrawSheet({ groups, busy, valueOf, onWithdraw }: { groups: CrewView[]; busy: boolean; valueOf: (c: CrewView) => number; onWithdraw: (c: CrewView, amt: number) => void }) {
  const withMoney = groups.filter((g) => valueOf(g) >= 0.01);
  const [k, setK] = useState(withMoney[0]?.address.toBase58() ?? "");
  const [v, setV] = useState("");
  const c = withMoney.find((g) => g.address.toBase58() === k);
  if (!c) return <p className="text-sm text-muted">Nothing free to withdraw. Money locked on a goal stays until your friends vote.</p>;
  const max = valueOf(c);
  const n = Number(v);
  const valid = n > 0 && n <= max + 1e-9;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) onWithdraw(c, Math.min(n, max)); }}>
      {withMoney.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm text-muted">From</legend>
          <div className="flex flex-wrap gap-2">
            {withMoney.map((g) => <button type="button" key={g.address.toBase58()} aria-pressed={g.address.toBase58() === k} onClick={() => setK(g.address.toBase58())} className="tile min-h-11 px-3 text-sm">{g.name}</button>)}
          </div>
        </fieldset>
      )}
      <label className="card flex items-center gap-1 px-4 py-3">
        <span className="sr-only">Amount in dollars</span>
        <span aria-hidden className="text-3xl text-muted">$</span>
        <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" className="w-full bg-transparent text-4xl font-medium outline-none" aria-describedby="wd-hint" />
        <button type="button" onClick={() => setV(String(Math.floor(max * 100) / 100))} className="min-h-11 rounded-full border border-stone px-3 text-sm font-medium">Max</button>
      </label>
      <p id="wd-hint" className="text-sm text-muted">Free in {c.name}: {usd(max)}. Money locked on a goal stays until your friends vote.</p>
      <button type="submit" disabled={!valid || busy} className="btn btn-primary w-full">{busy ? "Working" : "Withdraw"}</button>
    </form>
  );
}

function NewGroup({ onCreate, onBack, busy }: { onCreate: (name: string) => void; onBack: () => void; busy: boolean }) {
  const [n, setN] = useState("");
  return (
    <Page>
      <Header title="New group" onBack={onBack} />
      <div className="flex justify-center"><Icon3D name="friends" size={120} /></div>
      <h1 className="text-[30px] font-medium leading-tight tracking-tight">Start a group</h1>
      <p className="-mt-2 text-muted">Your friends, your goals, money on the line. Next you get an invite link for the group chat.</p>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (n.trim() && !busy) onCreate(n.trim()); }}>
        <label className="block">
          <span className="mb-2 block text-sm text-muted">Group name</span>
          <input value={n} onChange={(ev) => setN(ev.target.value.slice(0, 32))} placeholder="Sunday runners"
            className="card w-full rounded-2xl px-4 py-4 text-lg outline-none placeholder:text-muted/70" />
        </label>
        <button type="submit" disabled={!n.trim() || busy} className="btn btn-primary w-full">
          {busy ? "Creating" : <>Create group <ArrowRight className="h-5 w-5" aria-hidden /></>}
        </button>
      </form>
      <p className="text-xs text-muted">No fees to think about. We cover them.</p>
    </Page>
  );
}
