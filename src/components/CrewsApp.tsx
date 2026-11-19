"use client";

import {
  ArrowDownRight, ArrowLeft, ArrowUpRight, Crown, Flame, Home, Loader2, Lock, Plus, ShieldCheck, Trophy, User, Users, X, Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LiveClient, type CrewView, type Snapshot } from "@/lib/house-money/solana/live";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { usd } from "./ui";

type View = { id: "home" } | { id: "rank" } | { id: "me" } | { id: "new" } | { id: "crew"; key: string };
type Sheet =
  | null
  | { id: "applepay" }
  | { id: "deposit"; crew: CrewView }
  | { id: "withdraw"; crew: CrewView }
  | { id: "tryhard"; crew: CrewView };

const EMOJIS = ["🤠", "🔥", "🏠", "🎓", "🏀", "✈️", "🌮", "💎"];
const YEAR = 31_536_000;

export default function CrewsApp() {
  const name = useSyncExternalStore(subscribeName, () => localStorage.getItem("hm.name") ?? "", () => null);
  const [client, setClient] = useState<LiveClient | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>({ id: "home" });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    LiveClient.connect().then(setClient).catch((e: Error) => setToast({ text: e.message, tone: "err" }));
  }, []);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      setSnap(await client.snapshot());
    } catch (e) {
      setToast({ text: (e as Error).message, tone: "err" });
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 12_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [client, refresh]);

  // A one-second clock drives the live earnings counters (the FOMO).
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const act = async (label: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(label);
    setToast(null);
    try {
      await fn();
      await refresh();
      if (done) setToast({ text: done, tone: "ok" });
      return true;
    } catch (e) {
      setToast({ text: (e as Error).message, tone: "err" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (name === null) return <Shell />;
  if (!name) {
    return (
      <Shell>
        <Onboarding
          onDone={(n) => {
            setName(n);
          }}
        />
      </Shell>
    );
  }

  const myCrews = snap?.crews.filter((c) => c.me) ?? [];
  const savings = myCrews.reduce((s, c) => s + liveValue(c, snap!, now), 0);
  const crew = view.id === "crew" ? snap?.crews.find((c) => c.address.toBase58() === view.key) : undefined;
  const tab = view.id === "rank" ? "rank" : view.id === "me" ? "me" : "home";

  return (
    <Shell>
      {toast && (
        <button
          role="alert"
          onClick={() => setToast(null)}
          className={`fixed left-1/2 top-4 z-50 w-[min(400px,90vw)] -translate-x-1/2 rounded-2xl px-4 py-3 text-left text-sm font-bold shadow-lg ${
            toast.tone === "ok" ? "bg-ink text-paper" : "bg-ember-soft text-ember-text"
          }`}
        >
          {toast.text}
        </button>
      )}

      {!snap ? (
        <div className="flex flex-1 items-center justify-center gap-2 font-bold text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your crews…
        </div>
      ) : view.id === "home" ? (
        <Page>
          <Top name={name} />
          <section className="sun relative overflow-hidden rounded-[28px] bg-ink p-6 text-paper">
            <p className="text-sm font-bold text-paper/70">Saved with your crews</p>
            <p className="mt-1 text-[44px] font-extrabold leading-none tracking-tight tabular-nums">{usd(savings)}</p>
            <p className="mt-3 flex items-center gap-2 text-sm font-bold text-paper/80">
              <ShieldCheck className="h-4 w-4" /> Cash ready to send: {usd(snap.cash)}
            </p>
            <button onClick={() => setSheet({ id: "applepay" })} aria-label="Add money with Apple Pay" className="btn mt-5 w-full bg-black py-4 text-lg text-white">
              Add money with <span className="font-extrabold"> Pay</span>
            </button>
          </section>

          <SectionTitle title="Your crews" action={<button onClick={() => setView({ id: "new" })} className="flex items-center gap-1 text-sm font-extrabold text-ember-text"><Plus className="h-4 w-4" /> New crew</button>} />
          {myCrews.length === 0 ? (
            <div className="card p-5 text-center">
              <p className="font-extrabold">You&apos;re not in a crew yet.</p>
              <p className="mt-1 text-sm font-semibold text-muted">Start one with friends or join a trending crew below.</p>
              <button onClick={() => setView({ id: "new" })} className="btn btn-primary mt-4 w-full py-3">Start a crew</button>
            </div>
          ) : (
            myCrews.map((c) => <CrewRow key={c.address.toBase58()} crew={c} snap={snap} now={now} rank={rankOf(snap, c)} onOpen={() => setView({ id: "crew", key: c.address.toBase58() })} mine />)
          )}

          <SectionTitle title="Trending now" action={<button onClick={() => setView({ id: "rank" })} className="text-sm font-extrabold text-muted">See all</button>} />
          {snap.crews.filter((c) => !c.me).slice(0, 3).map((c) => (
            <CrewRow key={c.address.toBase58()} crew={c} snap={snap} now={now} rank={rankOf(snap, c)} onOpen={() => setView({ id: "crew", key: c.address.toBase58() })} />
          ))}
          {snap.crews.filter((c) => !c.me).length === 0 && <p className="text-sm font-semibold text-muted">No other crews yet. Be the first one everyone wants to join.</p>}
        </Page>
      ) : view.id === "rank" ? (
        <Page>
          <h1 className="text-[34px] font-extrabold tracking-tight">Leaderboard</h1>
          <p className="-mt-2 font-semibold text-muted">Crews ranked by how much their savings grew.</p>
          {snap.crews.map((c, i) => (
            <button key={c.address.toBase58()} onClick={() => setView({ id: "crew", key: c.address.toBase58() })} className={`card flex items-center gap-3 p-4 text-left ${c.me ? "ring-2 ring-ember" : ""}`}>
              <span className={`w-6 text-center text-lg font-extrabold ${i === 0 ? "text-ember-text" : "text-muted"}`}>{i === 0 ? <Crown className="mx-auto h-5 w-5" /> : i + 1}</span>
              <span className="text-2xl">{c.emoji}</span>
              <span className="flex-1">
                <span className="block font-extrabold">{c.name}</span>
                <span className="text-xs font-bold text-muted">{plural(c.members)} · {usd(c.vault)} saved</span>
              </span>
              <span className="text-right font-extrabold text-gain">+{liveGrowth(c, snap, now).toFixed(3)}%</span>
            </button>
          ))}
        </Page>
      ) : view.id === "me" ? (
        <Page>
          <h1 className="text-[34px] font-extrabold tracking-tight">{name}</h1>
          <div className="card space-y-3 p-5 font-bold">
            <Row k="Saved in crews" v={usd(savings)} />
            <Row k="Cash" v={usd(snap.cash)} />
            <Row k="Crews" v={String(myCrews.length)} />
            <Row k="Calls played" v={String(myCrews.reduce((s, c) => s + c.me!.member.callsPlayed, 0))} />
          </div>
          <div className="card space-y-2 p-5 text-sm font-semibold text-muted">
            <p className="flex items-center gap-2 font-extrabold text-ink"><Lock className="h-4 w-4" /> How your money is protected</p>
            <p>Your savings sit in your crew&apos;s pot and only you can take your part out. Tryhard mode can only use what your crew earned, never what you put in. Those rules are enforced by the app&apos;s code, not by a promise.</p>
            <p className="pt-1 text-xs">Demo on test dollars. Earnings run at {snap.config.apyBps / 100}% a year, sped up {snap.config.timeWarp.toLocaleString()}x so you can watch them grow.</p>
          </div>
          <button onClick={() => setName("")} className="btn btn-quiet py-3">Change name</button>
        </Page>
      ) : view.id === "new" ? (
        <NewCrew
          busy={!!busy}
          onBack={() => setView({ id: "home" })}
          onCreate={async (n, e) => {
            const okay = await act("create", () => client!.createCrew(n, e), `${e} ${n} is live. Invite your friends.`);
            if (okay) setView({ id: "home" });
          }}
        />
      ) : crew ? (
        <CrewScreen
          crew={crew}
          snap={snap}
          now={now}
          rank={rankOf(snap, crew)}
          busy={busy}
          onBack={() => setView({ id: "home" })}
          onDeposit={() => setSheet({ id: "deposit", crew })}
          onWithdraw={() => setSheet({ id: "withdraw", crew })}
          onTryhard={() => setSheet({ id: "tryhard", crew })}
          onSettle={() => act("settle", () => client!.settle(crew.address), "Call settled. Your crew got the result.")}
        />
      ) : (
        <Page><p className="font-bold text-muted">Crew not found.</p></Page>
      )}

      {snap && ["home", "rank", "me"].includes(view.id) && (
        <nav className="glass sticky bottom-3 mx-4 mt-6 flex justify-around rounded-2xl p-1.5">
          {([["home", "Home", <Home key="h" className="h-5 w-5" />], ["rank", "Leaderboard", <Trophy key="t" className="h-5 w-5" />], ["me", "Me", <User key="u" className="h-5 w-5" />]] as const).map(([id, label, icon]) => (
            <button key={id} onClick={() => setView({ id })} aria-current={tab === id ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold transition ${tab === id ? "bg-ink text-paper" : "text-muted"}`}>
              {icon}{label}
            </button>
          ))}
        </nav>
      )}

      {sheet && snap && (
        <SheetFrame onClose={() => setSheet(null)}>
          {sheet.id === "applepay" && (
            <ApplePay busy={busy === "topup"} onPay={async (amt) => {
              if (await act("topup", () => client!.topUp(amt), `${usd(amt)} added to your cash.`)) setSheet(null);
            }} />
          )}
          {sheet.id === "deposit" && (
            <AmountSheet title={`Send to ${sheet.crew.emoji} ${sheet.crew.name}`} max={snap.cash} cta="Send" busy={busy === "deposit"}
              hint={snap.cash === 0 ? "Add money with Apple Pay first." : `You have ${usd(snap.cash)} in cash.`}
              onSubmit={async (amt) => {
                if (await act("deposit", () => client!.deposit(sheet.crew.address, amt, !!sheet.crew.me), `${usd(amt)} sent to ${sheet.crew.name}.`)) setSheet(null);
              }} />
          )}
          {sheet.id === "withdraw" && sheet.crew.me && (
            <AmountSheet title="Take money out" max={sheet.crew.me.value} cta="Take out" busy={busy === "withdraw"}
              hint={`Your part of the pot: ${usd(sheet.crew.me.value)}. It goes back to your cash.`}
              onSubmit={async (amt) => {
                const all = amt >= sheet.crew.me!.value - 0.000001;
                if (await act("withdraw", () => client!.withdraw(sheet.crew, all ? "all" : amt), `${usd(amt)} back in your cash.`)) setSheet(null);
              }} />
          )}
          {sheet.id === "tryhard" && sheet.crew.me && (
            <Tryhard crew={sheet.crew} snap={snap} busy={busy === "call"} onLock={async (dir, boost, stake) => {
              if (await act("call", () => client!.openCall(sheet.crew.address, dir, boost, stake), "Call locked in. Good luck.")) setSheet(null);
            }} />
          )}
        </SheetFrame>
      )}
    </Shell>
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

/** Pot value including earnings that accrue every second (paid on-chain at the next action). */
function pending(c: CrewView, snap: Snapshot, now: number) {
  const principal = Number(c.totalPrincipal) / 1e6;
  const elapsed = Math.max(0, now - c.lastAccrual);
  return (principal * (snap.config.apyBps / 10_000) * snap.config.timeWarp * elapsed) / YEAR;
}
function liveGrowth(c: CrewView, snap: Snapshot, now: number) {
  const principal = Number(c.totalPrincipal) / 1e6;
  return principal > 0 ? ((Number(c.yieldPaid) / 1e6 + pending(c, snap, now)) / principal) * 100 : 0;
}
const plural = (n: number) => `${n} ${n === 1 ? "member" : "members"}`;
function liveValue(c: CrewView, snap: Snapshot, now: number) {
  if (!c.me) return 0;
  const share = c.vault > 0 ? c.me.value / c.vault : 0;
  return c.me.value + pending(c, snap, now) * share;
}
const rankOf = (snap: Snapshot, c: CrewView) => snap.crews.findIndex((x) => x.address.equals(c.address)) + 1;

function Shell({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-paper sm:my-6 sm:min-h-[860px] sm:rounded-[40px] sm:shadow-[0_0_0_1px_rgba(31,29,36,0.06),0_30px_80px_-30px_rgba(31,29,36,0.35)]">
      {children}
    </div>
  );
}
function Page({ children }: { children: ReactNode }) {
  return <div className="enter flex flex-1 flex-col gap-4 px-5 pb-4 pt-6">{children}</div>;
}
function Top({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><Logo size={28} /> house money</span>
      <span className="text-sm font-extrabold text-muted">Hi, {name}</span>
    </div>
  );
}
function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <p className="flex justify-between"><span className="text-muted">{k}</span>{v}</p>;
}

function CrewRow({ crew, snap, now, rank, onOpen, mine }: { crew: CrewView; snap: Snapshot; now: number; rank: number; onOpen: () => void; mine?: boolean }) {
  const perMinute = crew.yieldPerDay / 1440;
  return (
    <button onClick={onOpen} className="card flex items-center gap-3 p-4 text-left">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone text-2xl">{crew.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-extrabold">
          <span className="truncate">{crew.name}</span>
          {rank === 1 && <Flame className="h-4 w-4 shrink-0 fill-ember text-ember" />}
        </span>
        <span className="block text-xs font-bold text-muted">
          #{rank} · {plural(crew.members)} · +${perMinute.toFixed(3)}/min
        </span>
      </span>
      <span className="text-right">
        <span className="block font-extrabold tabular-nums">{mine ? usd(liveValue(crew, snap, now)) : usd(crew.vault + pending(crew, snap, now))}</span>
        <span className="text-xs font-extrabold text-gain">+{liveGrowth(crew, snap, now).toFixed(3)}%</span>
      </span>
    </button>
  );
}

function CrewScreen(props: {
  crew: CrewView; snap: Snapshot; now: number; rank: number; busy: string | null;
  onBack: () => void; onDeposit: () => void; onWithdraw: () => void; onTryhard: () => void; onSettle: () => void;
}) {
  const { crew, snap, now, rank, busy } = props;
  const me = crew.me;
  const call = snap.call && snap.callCrew?.equals(crew.address) ? snap.call : undefined;
  const value = liveValue(crew, snap, now);
  const earned = me ? value - me.principal : 0;
  const playable = me ? Math.max(0, earned) : 0;
  const potNow = crew.vault + pending(crew, snap, now);
  return (
    <Page>
      <button onClick={props.onBack} className="flex items-center gap-1 self-start font-bold text-muted"><ArrowLeft className="h-5 w-5" /> Back</button>
      <section className="sun relative overflow-hidden rounded-[28px] bg-ink p-6 text-paper">
        <p className="text-4xl">{crew.emoji}</p>
        <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-tight">{crew.name}</h1>
        <p className="text-sm font-bold text-paper/70">#{rank} on the leaderboard · {plural(crew.members)}</p>
        <p className="mt-5 text-sm font-bold text-paper/70">{me ? "Your part" : "In the pot"}</p>
        <p className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums">{usd(me ? value : potNow)}</p>
        {me ? (
          <p className="mt-2 text-sm font-extrabold text-sun">+${earned.toFixed(6)} earned on {usd(me.principal)} saved</p>
        ) : (
          <p className="mt-2 text-sm font-extrabold text-sun">This crew earns ${(crew.yieldPerDay / 1440).toFixed(3)} every minute. You&apos;re not in it yet.</p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-xs font-bold text-muted">Crew pot</p><p className="text-lg font-extrabold tabular-nums">{usd(potNow)}</p></div>
        <div className="card p-4"><p className="text-xs font-bold text-muted">Grew</p><p className="text-lg font-extrabold text-gain">+{liveGrowth(crew, snap, now).toFixed(3)}%</p></div>
      </div>

      {me ? (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button onClick={props.onDeposit} className="btn btn-primary py-4 text-lg">Add to crew</button>
          <button onClick={props.onWithdraw} disabled={!!call} className="btn btn-quiet px-5 py-4">Take out</button>
        </div>
      ) : (
        <button onClick={props.onDeposit} className="btn btn-primary py-4 text-lg"><Users className="h-5 w-5" /> Join and add money</button>
      )}

      {me && call ? (
        <OpenCall call={call} snap={snap} now={now} busy={busy === "settle"} onSettle={props.onSettle} />
      ) : me ? (
        <button onClick={props.onTryhard} disabled={playable < 0.00001} className="card flex items-center gap-3 p-4 text-left disabled:opacity-60">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ember text-paper"><Zap className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block font-extrabold">Tryhard mode</span>
            <span className="text-xs font-bold text-muted">
              {playable >= 0.00001 ? `Play the $${playable.toFixed(4)} your crew earned you. Never your savings.` : "Unlocks once your crew earns something."}
            </span>
          </span>
        </button>
      ) : null}
    </Page>
  );
}

function OpenCall({ call, snap, now, busy, onSettle }: { call: NonNullable<Snapshot["call"]>; snap: Snapshot; now: number; busy: boolean; onSettle: () => void }) {
  const entry = Number(call.entryPrice) * 10 ** call.expo;
  const left = Math.max(0, Math.ceil(call.expiresAt - now));
  const sign = call.direction === 0 ? 1 : -1;
  const move = ((snap.sol.price - entry) / entry) * sign;
  const stake = Number(call.stake) / 1e6;
  const result = Math.max(-stake, Math.min(stake * snap.config.maxWinMultiple, stake * call.boost * move));
  return (
    <div className="card space-y-3 p-5">
      <p className="flex items-center gap-2 font-extrabold"><Zap className="h-4 w-4 text-ember" /> Your call: SOL {call.direction === 0 ? "up" : "down"} · {call.boost}x</p>
      <Row k="Played" v={`$${stake.toFixed(6)}`} />
      <Row k="SOL when you called" v={`$${entry.toFixed(2)}`} />
      <Row k="SOL now" v={`$${snap.sol.price.toFixed(2)}`} />
      <p className={`flex justify-between font-extrabold ${result >= 0 ? "text-gain" : "text-ember-text"}`}><span>Right now</span>{result >= 0 ? "+" : "−"}${Math.abs(result).toFixed(6)}</p>
      {left > 0 ? (
        <p className="text-sm font-bold text-muted">Settles in {left}s with the market price.</p>
      ) : (
        <button onClick={onSettle} disabled={busy} className="btn btn-ink w-full py-3">{busy ? "Settling…" : "Settle my call"}</button>
      )}
    </div>
  );
}

function NewCrew({ onCreate, onBack, busy }: { onCreate: (name: string, emoji: string) => void; onBack: () => void; busy: boolean }) {
  const [n, setN] = useState("");
  const [e, setE] = useState(EMOJIS[0]);
  return (
    <Page>
      <button onClick={onBack} className="flex items-center gap-1 self-start font-bold text-muted"><ArrowLeft className="h-5 w-5" /> Back</button>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Start a crew</h1>
      <p className="-mt-2 font-semibold text-muted">Roommates, your team, the group chat. Everyone saves in one pot and grows together.</p>
      <input value={n} onChange={(ev) => setN(ev.target.value)} maxLength={32} placeholder="Crew name" aria-label="Crew name"
        className="card w-full px-4 py-4 text-lg font-bold outline-none ring-ember placeholder:text-muted/60 focus:ring-2" />
      <div className="grid grid-cols-4 gap-2">
        {EMOJIS.map((x) => (
          <button key={x} onClick={() => setE(x)} aria-pressed={e === x} className="tile py-3 text-2xl">{x}</button>
        ))}
      </div>
      <button disabled={!n.trim() || busy} onClick={() => onCreate(n.trim(), e)} className="btn btn-primary mt-2 py-4 text-lg">
        {busy ? "Creating…" : `Create ${e} ${n.trim() || "crew"}`}
      </button>
    </Page>
  );
}

function SheetFrame({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div className="enter w-full max-w-[440px] rounded-t-[32px] bg-paper p-6 pb-8" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="float-right rounded-full bg-stone p-1.5"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>
  );
}

function ApplePay({ onPay, busy }: { onPay: (amt: number) => void; busy: boolean }) {
  const [amt, setAmt] = useState(50);
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold tracking-tight">Add money</h2>
      <div className="grid grid-cols-3 gap-2">
        {[25, 50, 100].map((a) => (
          <button key={a} onClick={() => setAmt(a)} aria-pressed={amt === a} className="tile py-4 text-xl font-extrabold">${a}</button>
        ))}
      </div>
      <div className="card space-y-2 p-4 text-sm font-bold">
        <Row k="Card" v="Apple Pay · Visa ••4242" />
        <Row k="Fee" v="$0.00" />
        <p className="flex justify-between text-base font-extrabold"><span>Total</span>{usd(amt)}</p>
      </div>
      <button onClick={() => onPay(amt)} disabled={busy} aria-label={`Pay ${usd(amt)} with Apple Pay`} className="btn w-full bg-black py-4 text-lg text-white">
        {busy ? "Processing…" : <>Pay with <span className="font-extrabold"> Pay</span></>}
      </button>
      <p className="text-center text-xs font-semibold text-muted">Demo: no card is charged. You get test dollars.</p>
    </div>
  );
}

function AmountSheet({ title, max, cta, hint, busy, onSubmit }: { title: string; max: number; cta: string; hint: string; busy: boolean; onSubmit: (amt: number) => void }) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const n = Number(v);
  const valid = n > 0 && n <= max + 1e-9;
  return (
    <div className="space-y-4">
      <h2 className="pr-8 text-2xl font-extrabold tracking-tight">{title}</h2>
      <div className="card flex items-center gap-1 px-4 py-3">
        <span className="text-3xl font-extrabold text-muted">$</span>
        <input ref={ref} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
          className="w-full bg-transparent text-4xl font-extrabold outline-none" aria-label="Amount" />
        <button onClick={() => setV(String(Math.floor(max * 1e6) / 1e6))} className="rounded-lg bg-stone px-2 py-1 text-xs font-extrabold">Max</button>
      </div>
      <p className="text-sm font-semibold text-muted">{hint}</p>
      <button disabled={!valid || busy} onClick={() => onSubmit(Math.min(n, max))} className="btn btn-primary w-full py-4 text-lg">{busy ? "Working…" : cta}</button>
    </div>
  );
}

function Tryhard({ crew, snap, busy, onLock }: { crew: CrewView; snap: Snapshot; busy: boolean; onLock: (dir: 0 | 1, boost: number, stake: number) => void }) {
  const [dir, setDir] = useState<0 | 1>(0);
  const [boost, setBoost] = useState(2);
  const [stake] = useState(() => {
    const earned = liveValue(crew, snap, Date.now() / 1000) - crew.me!.principal;
    return Math.floor(Math.max(0, earned) * 0.98 * 1e6) / 1e6; // leave dust for rounding
  });
  const ko = 100 / boost;
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-ember-text"><Zap className="h-4 w-4" /> Tryhard mode</p>
      <h2 className="text-2xl font-extrabold leading-tight tracking-tight">SOL is ${snap.sol.price.toFixed(2)}. Up or down in {snap.config.callDuration}s?</h2>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setDir(0)} aria-pressed={dir === 0} className="tile flex items-center justify-center gap-2 py-4 text-lg font-extrabold"><ArrowUpRight className="h-5 w-5" /> Up</button>
        <button onClick={() => setDir(1)} aria-pressed={dir === 1} className="tile flex items-center justify-center gap-2 py-4 text-lg font-extrabold"><ArrowDownRight className="h-5 w-5" /> Down</button>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-muted">Boost</p>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: snap.config.maxBoost }, (_, i) => i + 1).map((b) => (
            <button key={b} onClick={() => setBoost(b)} aria-pressed={boost === b} className="tile py-3 font-extrabold">{b}x</button>
          ))}
        </div>
      </div>
      <div className="card space-y-2 p-4 text-sm font-bold">
        <Row k="You play" v={`$${stake.toFixed(6)}`} />
        <Row k="Best case" v={`+$${(stake * snap.config.maxWinMultiple).toFixed(6)}`} />
        <Row k="Knocked out if SOL moves" v={`${ko.toFixed(0)}% against you`} />
        <p className="flex items-center gap-2 text-gain"><ShieldCheck className="h-4 w-4" /> Your {usd(crew.me!.principal)} saved can&apos;t be touched.</p>
      </div>
      <button disabled={busy || stake <= 0} onClick={() => onLock(dir, boost, stake)} className="btn btn-primary w-full py-4 text-lg">{busy ? "Locking…" : "Lock it in"}</button>
    </div>
  );
}
