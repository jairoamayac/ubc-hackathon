"use client";

// Screens: onboarding → home (your money, your groups) → group (CrewRoom: pacts, goals, confirmations) → me.
// Sheets: Apple Pay (simulated), add to a group, take out. Brand: branding kit v0.1 ("Forest").
import { ArrowLeft, ChevronRight, Home, Loader2, Plus, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PublicKey } from "@solana/web3.js";
import { LiveClient, type CrewView, type Snapshot } from "@/lib/house-money/solana/live";
import { PROJECT_NAME } from "@/lib/brand";
import { CrewRoom } from "./CrewRoom";
import { Onboarding } from "./Onboarding";
import { usd } from "@/lib/format";

type View = { id: "home" } | { id: "me" } | { id: "new" } | { id: "group"; key: string };
type Sheet = null | { id: "applepay"; then?: CrewView } | { id: "deposit"; crew: CrewView } | { id: "withdraw"; crew: CrewView };
export type Act = (label: string, fn: () => Promise<unknown>, done?: string) => Promise<boolean>;

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
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "ok" ? 4000 : 8000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    LiveClient.connect().then(setClient).catch((e: Error) => setToast({ text: e.message, tone: "err" }));
    // Invite links: /?crew=<address> opens that group so a friend can join in one tap.
    const invited = new URLSearchParams(location.search).get("crew");
    if (invited) {
      try {
        const key = new PublicKey(invited).toBase58();
        setTimeout(() => setView({ id: "group", key }), 0);
      } catch {
        /* not a group link */
      }
    }
  }, []);

  // Names are stored onchain (sponsored) so friends see "Leo", never an address.
  useEffect(() => {
    if (!client || !name || localStorage.getItem("hm.profile") === name) return;
    client.setProfile(name).then(() => localStorage.setItem("hm.profile", name)).catch(() => {});
  }, [client, name]);

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

  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const act: Act = async (label, fn, done) => {
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
        <Onboarding onDone={(n) => setName(n)} />
      </Shell>
    );
  }

  const myGroups = snap?.crews.filter((c) => c.me) ?? [];
  const inGroups = myGroups.reduce((s, c) => s + liveValue(c, snap!, now), 0);
  const group = view.id === "group" ? snap?.crews.find((c) => c.address.toBase58() === view.key) : undefined;
  const tab = view.id === "me" ? "me" : "home";

  return (
    <Shell>
      <div aria-live="polite" role="status" className="sr-only">{toast?.tone === "ok" ? toast.text : ""}</div>
      {toast && (
        <div
          role={toast.tone === "err" ? "alert" : undefined}
          className={`fixed left-1/2 top-4 z-50 flex w-[min(400px,92vw)] -translate-x-1/2 items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            toast.tone === "ok" ? "border-forest bg-forest text-white" : "border-danger bg-paper text-danger"
          }`}
        >
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss message" className="-m-2 flex h-11 w-11 items-center justify-center"><X className="h-4 w-4" aria-hidden /></button>
        </div>
      )}

      {!snap ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading
        </div>
      ) : view.id === "home" ? (
        <Page>
          <Top name={name} />
          <section aria-labelledby="money-title" className="card p-6">
            <h2 id="money-title" className="text-sm text-muted">Your money</h2>
            <p className="mt-1 text-[40px] font-medium leading-none tracking-tight tabular-nums">{usd(snap.cash + inGroups)}</p>
            <p className="mt-3 text-sm text-muted">{usd(inGroups)} in your groups · {usd(snap.cash)} ready to use</p>
            <ApplePayButton className="mt-5 w-full" onClick={() => setSheet({ id: "applepay" })} label="Add money with Apple Pay" />
          </section>

          <div className="mt-2 flex items-center justify-between">
            <h2 className="text-lg font-medium">Your groups</h2>
            <button onClick={() => setView({ id: "new" })} className="flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-forest"><Plus className="h-4 w-4" aria-hidden /> New group</button>
          </div>
          {myGroups.length === 0 ? (
            <div className="card p-5">
              <p className="font-medium">Start with your people.</p>
              <p className="mt-1 text-sm text-muted">A group is you and a few friends, each with money on a goal. Create one and share the invite link.</p>
              <button onClick={() => setView({ id: "new" })} className="btn btn-primary mt-4 w-full">Start a group</button>
            </div>
          ) : (
            <ul className="space-y-3">
              {myGroups.map((c) => (
                <li key={c.address.toBase58()}>
                  <button onClick={() => setView({ id: "group", key: c.address.toBase58() })} className="card flex min-h-16 w-full items-center gap-3 p-4 text-left">
                    <span className="dot" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block text-sm text-muted">{c.members} {c.members === 1 ? "person" : "people"}</span>
                    </span>
                    <span className="text-right tabular-nums">{usd(liveValue(c, snap, now))}</span>
                    <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section aria-labelledby="how-title" className="card mt-2 space-y-3 p-5">
            <h2 id="how-title" className="font-medium">How it works</h2>
            <ol className="space-y-2 text-sm text-muted">
              <li>1. Lock money on your own goal, for example run 21 km by Sunday, $20.</li>
              <li>2. Friends join with their own goals and money.</li>
              <li>3. When time is up, the people who put money in confirm who kept their word.</li>
              <li>4. Kept it: your money comes back with a share of what others left. Walked away: you lose it, 95% to the friends who kept theirs, 5% to us.</li>
            </ol>
          </section>
        </Page>
      ) : view.id === "me" ? (
        <Page>
          <h1 className="text-[32px] font-medium tracking-tight">{name}</h1>
          <div className="card space-y-3 p-5">
            <Row k="In your groups" v={usd(inGroups)} />
            <Row k="Ready to use" v={usd(snap.cash)} />
            <Row k="Groups" v={String(myGroups.length)} />
          </div>
          <section aria-labelledby="safe-title" className="card space-y-2 p-5 text-sm text-muted">
            <h2 id="safe-title" className="font-medium text-ink">Who holds your money</h2>
            <p>Not us, and not your friends. Money sits in your group&apos;s pot, held by code nobody can change. Only you can take out your part, and locked money moves only after the people who put money in confirm a result.</p>
            <p>When someone walks away, 95% of their money goes to the friends who kept their word and 5% to {PROJECT_NAME}. Nothing goes anywhere else.</p>
            <p className="pt-1 text-xs">Demo with test dollars. Apple Pay is simulated; no card is charged.</p>
          </section>
          <button onClick={() => setName("")} className="btn btn-quiet">Change name</button>
        </Page>
      ) : view.id === "new" ? (
        <NewGroup
          busy={busy === "create"}
          onBack={() => setView({ id: "home" })}
          onCreate={async (n) => {
            const id = BigInt(Date.now());
            const okay = await act("create", () => client!.createCrew(n, "", id), `${n} is ready. Share the invite link with your friends.`);
            if (okay) setView({ id: "group", key: client!.crewAddress(id).toBase58() });
          }}
        />
      ) : group && client ? (
        <CrewRoom
          client={client}
          crew={group}
          snap={snap}
          now={now}
          busy={busy}
          value={liveValue(group, snap, now)}
          act={act}
          onBack={() => {
            history.replaceState(null, "", location.pathname);
            setView({ id: "home" });
          }}
          onDeposit={() => setSheet(snap.cash < 0.01 ? { id: "applepay", then: group } : { id: "deposit", crew: group })}
          onWithdraw={() => setSheet({ id: "withdraw", crew: group })}
        />
      ) : (
        <Page>
          <BackButton onClick={() => setView({ id: "home" })} />
          <p className="flex items-center gap-2 text-muted" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening the group</p>
        </Page>
      )}

      {snap && (view.id === "home" || view.id === "me") && (
        <nav aria-label="Main" className="glass sticky bottom-3 mx-4 mt-6 flex justify-around rounded-xl p-1.5">
          {([["home", "Home", <Home key="h" className="h-5 w-5" aria-hidden />], ["me", "Me", <User key="u" className="h-5 w-5" aria-hidden />]] as const).map(([id, label, icon]) => (
            <button key={id} onClick={() => setView({ id })} aria-current={tab === id ? "page" : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-xs transition ${tab === id ? "bg-forest text-white" : "text-muted"}`}>
              {icon}{label}
            </button>
          ))}
        </nav>
      )}

      {sheet && snap && (
        <Dialog
          title={sheet.id === "applepay" ? "Add money" : sheet.id === "deposit" ? `Add to ${sheet.crew.name}` : "Take money out"}
          onClose={() => setSheet(null)}
        >
          {sheet.id === "applepay" && (
            <ApplePaySheet busy={busy === "topup"} onPay={async (amt) => {
              const ok = await act("topup", () => client!.topUp(amt), `${usd(amt)} added.`);
              if (ok) setSheet(sheet.then ? { id: "deposit", crew: sheet.then } : null);
            }} />
          )}
          {sheet.id === "deposit" && (
            <AmountForm max={snap.cash} cta={sheet.crew.me ? "Add money" : "Join group"} busy={busy === "deposit"}
              hint={`You have ${usd(snap.cash)} ready to use. Money in a group stays yours until you lock it on a goal.`}
              onSubmit={async (amt) => {
                if (await act("deposit", () => client!.deposit(sheet.crew.address, amt, !!sheet.crew.me), `${usd(amt)} added to ${sheet.crew.name}.`)) setSheet(null);
              }} />
          )}
          {sheet.id === "withdraw" && sheet.crew.me && (
            <AmountForm max={sheet.crew.me.value} cta="Take out" busy={busy === "withdraw"}
              hint={`Free to take out: ${usd(sheet.crew.me.value)}. Money locked on a goal stays until your friends confirm.`}
              onSubmit={async (amt) => {
                const all = amt >= sheet.crew.me!.value - 0.000001;
                if (await act("withdraw", () => client!.withdraw(sheet.crew, all ? "all" : amt), `${usd(amt)} back in your money.`)) setSheet(null);
              }} />
          )}
        </Dialog>
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

function pending(c: CrewView, snap: Snapshot, now: number) {
  const principal = Number(c.totalPrincipal) / 1e6;
  const elapsed = Math.max(0, now - c.lastAccrual);
  return (principal * (snap.config.apyBps / 10_000) * snap.config.timeWarp * elapsed) / YEAR;
}
/** Your free money in a group, including what accrues every second. */
export function liveValue(c: CrewView, snap: Snapshot, now: number) {
  if (!c.me) return 0;
  const share = c.vault > 0 ? c.me.value / c.vault : 0;
  return c.me.value + pending(c, snap, now) * share;
}

function Shell({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-paper sm:my-6 sm:min-h-[860px] sm:rounded-2xl sm:border sm:border-stone">
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
function Page({ children }: { children: ReactNode }) {
  return <div className="enter flex flex-1 flex-col gap-4 px-5 pb-4 pt-6">{children}</div>;
}
function Top({ name }: { name: string }) {
  return (
    <header className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-lg font-medium"><span className="dot" aria-hidden /> {PROJECT_NAME}</span>
      <span className="text-sm text-muted">Hi, {name}</span>
    </header>
  );
}
export function BackButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-11 items-center gap-1 self-start text-muted"><ArrowLeft className="h-5 w-5" aria-hidden /> Back</button>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <p className="flex justify-between"><span className="text-muted">{k}</span><span className="tabular-nums">{v}</span></p>;
}

export function ApplePayButton({ onClick, label, className = "", disabled }: { onClick: () => void; label: string; className?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className={`btn bg-black py-4 text-lg text-white ${className}`}>
      <span aria-hidden>{label.startsWith("Pay") ? "Pay with" : "Add money with"}</span>
      <span aria-hidden className="font-medium"> Pay</span>
    </button>
  );
}

/** Accessible modal sheet: labelled, focus moves in and back, Escape closes. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}
        className="enter max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl border border-stone bg-paper p-6 pb-8 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="dialog-title" className="text-2xl font-medium leading-tight tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ApplePaySheet({ onPay, busy }: { onPay: (amt: number) => void; busy: boolean }) {
  const [amt, setAmt] = useState(50);
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Amount</legend>
        <div className="grid grid-cols-3 gap-2">
          {[20, 50, 100].map((a) => (
            <button key={a} onClick={() => setAmt(a)} aria-pressed={amt === a} className="tile min-h-12 py-3 text-xl font-medium">${a}</button>
          ))}
        </div>
      </fieldset>
      <div className="card space-y-2 p-4 text-sm">
        <Row k="Pay with" v="Apple Pay · Visa ••4242" />
        <Row k="Fee" v="$0.00" />
        <p className="flex justify-between text-base font-medium"><span>Total</span><span className="tabular-nums">{usd(amt)}</span></p>
      </div>
      <ApplePayButton className="w-full" disabled={busy} onClick={() => onPay(amt)} label={`Pay ${usd(amt)} with Apple Pay`} />
      {busy && <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Processing</p>}
      <p className="text-center text-xs text-muted">Demo: no card is charged. You get test dollars right away.</p>
    </div>
  );
}

function AmountForm({ max, cta, hint, busy, onSubmit }: { max: number; cta: string; hint: string; busy: boolean; onSubmit: (amt: number) => void }) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const n = Number(v);
  const valid = n > 0 && n <= max + 1e-9;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) onSubmit(Math.min(n, max)); }}>
      <label className="card flex items-center gap-1 px-4 py-3">
        <span className="sr-only">Amount in dollars</span>
        <span aria-hidden className="text-3xl text-muted">$</span>
        <input ref={ref} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
          className="w-full bg-transparent text-4xl font-medium outline-none" aria-describedby="amount-hint" />
        <button type="button" onClick={() => setV(String(Math.floor(max * 100) / 100))} className="min-h-11 rounded-lg border border-stone px-3 text-sm font-medium">Max</button>
      </label>
      <p id="amount-hint" className="text-sm text-muted">{hint}</p>
      <button type="submit" disabled={!valid || busy} className="btn btn-primary w-full py-4 text-lg">{busy ? "Working" : cta}</button>
    </form>
  );
}

function NewGroup({ onCreate, onBack, busy }: { onCreate: (name: string) => void; onBack: () => void; busy: boolean }) {
  const [n, setN] = useState("");
  return (
    <Page>
      <BackButton onClick={onBack} />
      <h1 className="text-[32px] font-medium leading-tight tracking-tight">Start a group</h1>
      <p className="-mt-2 text-muted">Your friends, your goals, real money on the line. Next you get an invite link for the group chat.</p>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (n.trim() && !busy) onCreate(n.trim()); }}>
        <label className="block">
          <span className="mb-2 block text-sm text-muted">Group name</span>
          <input value={n} onChange={(ev) => setN(ev.target.value.slice(0, 32))} placeholder="Sunday runners"
            className="card w-full px-4 py-4 text-lg outline-none placeholder:text-muted/70 focus:border-forest" />
        </label>
        <button type="submit" disabled={!n.trim() || busy} className="btn btn-primary w-full py-4 text-lg">
          {busy ? "Creating" : "Create group"}
        </button>
      </form>
      <p className="text-xs text-muted">No wallet, no fees. We cover them.</p>
    </Page>
  );
}
