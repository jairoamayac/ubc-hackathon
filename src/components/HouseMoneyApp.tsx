"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createMockClient } from "@/lib/house-money/client";
import type { Direction, HomeState, Play } from "@/lib/house-money/types";
import { CallItScreen } from "./CallItScreen";
import { DepositScreen } from "./DepositScreen";
import { HomeScreen } from "./HomeScreen";
import { LeagueScreen } from "./LeagueScreen";
import { LivePlayScreen } from "./LivePlayScreen";
import { Onboarding } from "./Onboarding";
import { ResultScreen } from "./ResultScreen";
import { BottomNav, Screen, usd, type Tab } from "./ui";

type View = "onboarding" | "deposit" | "home" | "call" | "live" | "result" | "league" | "profile";

export default function HouseMoneyApp() {
  const client = useMemo(() => createMockClient(), []);
  const [home, setHome] = useState<HomeState>(() => client.getHome());
  const [view, setView] = useState<View>("onboarding");
  const [result, setResult] = useState<Play | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Each screen starts at the top, like a native app.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const refresh = () => setHome(client.getHome());
  const market = client.getMarket();
  const league = client.getLeague();
  const showNav = ["home", "league", "profile"].includes(view);
  const tab: Tab = view === "league" ? "league" : view === "profile" ? "profile" : "home";

  const run = (fn: () => void) => {
    try {
      setError(null);
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-paper sm:my-6 sm:min-h-[860px] sm:rounded-[40px] sm:shadow-[0_0_0_1px_rgba(31,29,36,0.06),0_30px_80px_-30px_rgba(31,29,36,0.35)]">
      {error && (
        <div role="alert" className="mx-5 mt-4 rounded-2xl bg-ember-soft px-4 py-3 text-sm font-bold text-ember-text">
          {error}
        </div>
      )}

      {view === "onboarding" && (
        <Onboarding
          onDone={(email) => {
            client.signIn(email);
            refresh();
            setView("deposit");
          }}
        />
      )}

      {view === "deposit" && (
        <DepositScreen
          name={home.user.name}
          onDeposit={(amount) => {
            client.deposit(amount);
            refresh();
            setView("home");
          }}
        />
      )}

      {view === "home" && (
        <HomeScreen
          home={home}
          league={league}
          onCallIt={() => setView("call")}
          onOpenPlay={() => setView("live")}
          onLeague={() => setView("league")}
        />
      )}

      {view === "call" && (
        <CallItScreen
          market={market}
          houseMoney={home.houseMoney}
          vault={home.vault.principal}
          onBack={() => setView("home")}
          onLockIn={(d: Direction, boost: number, stake: number) =>
            run(() => {
              client.callIt(d, boost, stake);
              refresh();
              setView("live");
            })
          }
        />
      )}

      {view === "live" && home.openPlay && (
        <LivePlayScreen
          play={home.openPlay}
          market={market}
          onBack={() => setView("home")}
          onDemoSettle={(outcome) =>
            run(() => {
              const p = home.openPlay!;
              const sign = p.direction === "up" ? 1 : -1;
              // "win": a 4 % move your way. "knockout": a move against you just past 1/boost.
              const move = outcome === "win" ? 0.04 * sign : (-1.1 / p.boost) * sign;
              setResult(client.demoSettle(move));
              refresh();
              setView("result");
            })
          }
        />
      )}

      {view === "result" && result && (
        <ResultScreen
          play={result}
          vault={home.vault.principal}
          streak={home.streak}
          onContinue={() => {
            client.claimNewWeek();
            refresh();
            setView("home");
          }}
        />
      )}

      {view === "league" && <LeagueScreen league={league} />}

      {view === "profile" && (
        <Screen>
          <h1 className="text-[32px] font-extrabold tracking-tight">{home.user.name}</h1>
          <div className="card space-y-3 p-5 font-bold">
            <p className="flex justify-between">
              <span className="text-muted">Vault</span> {usd(home.vault.principal)}
            </p>
            <p className="flex justify-between">
              <span className="text-muted">House money</span> <span className="text-ember">{usd(home.houseMoney)}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-muted">
              <ShieldCheck className="h-4 w-4 text-ink" /> Withdraw your Vault anytime. House money can&apos;t be topped up.
            </p>
          </div>
        </Screen>
      )}

      {showNav && (
        <BottomNav
          tab={tab}
          onTab={(t) => setView(t === "call" ? (home.openPlay ? "live" : "call") : t)}
        />
      )}
    </div>
  );
}
