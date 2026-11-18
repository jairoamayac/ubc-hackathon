// Facade (GoF) + Indirection (GRASP): the UI only talks to this interface.
// Today it is backed by an in-memory mock; later a SolanaHouseMoneyClient will call the
// Anchor program (via Privy + the /api/relay fee payer) without touching any screen.

import { RULES, type Direction, type HomeState, type LeagueRow, type Market, type Play } from "./types";

export interface HouseMoneyClient {
  getHome(): HomeState;
  getMarket(): Market;
  getLeague(): LeagueRow[];
  signIn(email: string): HomeState;
  deposit(amount: number): HomeState;
  callIt(direction: Direction, boost: number, stake: number): Play;
  /** DEMO only: jumps to Friday's close with a simulated price move (e.g. +0.04 = +4 %). */
  demoSettle(move: number): Play;
  claimNewWeek(): HomeState;
}

/** Same settlement rule the on-chain program enforces (see invariants 2, 5 and 6). */
export function settle(play: Play, exitPrice: number): Play {
  const sign = play.direction === "up" ? 1 : -1;
  const movePct = ((exitPrice - play.entryPrice) / play.entryPrice) * sign;
  const result = play.stake * play.boost * movePct;
  if (result <= -play.stake) return { ...play, exitPrice, state: "knockout", payout: 0 };
  if (result < 0) return { ...play, exitPrice, state: "lost", payout: round(play.stake + result) };
  const gain = Math.min(result, play.stake * RULES.maxWinMultiple);
  return { ...play, exitPrice, state: "won", payout: round(play.stake + gain) };
}

export function maxLoss(stake: number) {
  return stake;
}

export function knockoutMovePct(boost: number) {
  // Price move against you that wipes the stake: 1 / boost
  return 100 / boost;
}

const round = (n: number) => Math.round(n * 100) / 100;

function nextFridayClose(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const add = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(16, 0, 0, 0);
  return d.getTime();
}

export function createMockClient(): HouseMoneyClient {
  // Last SOL/USD read from Pyth on Solana devnet (17/11/2026, 21:35 UTC): 73.87
  const PYTH_READ_AT = Date.UTC(2026, 10, 17, 21, 35); // fixed: no clock reads while rendering
  const market: Market = { symbol: "SOL", name: "Solana", price: 73.87, priceSource: "pyth", updatedAt: PYTH_READ_AT };

  const state: HomeState = {
    user: { name: "Ana", email: "" },
    vault: { principal: 0, apy: 0.05 },
    houseMoney: 0,
    weeklyInterest: 0,
    streak: 3,
    xp: 240,
    weekProgress: 0.6,
    openPlay: null,
    lastSettled: null,
  };

  const league: LeagueRow[] = [
    { name: "Leo", avatar: "LE", returnPct: 38.5, streak: 4 },
    { name: "Ana", avatar: "AN", returnPct: 21.0, streak: 3, isMe: true },
    { name: "Maya", avatar: "MA", returnPct: 12.4, streak: 1 },
    { name: "Josh", avatar: "JO", returnPct: -40.0, streak: 0 },
    { name: "Priya", avatar: "PR", returnPct: -100, streak: 0 },
  ];

  const snapshot = (): HomeState => structuredClone(state);

  return {
    getHome: snapshot,
    getMarket: () => ({ ...market }),
    getLeague: () => [...league].sort((a, b) => b.returnPct - a.returnPct),

    signIn(email) {
      state.user.email = email;
      state.user.name = email.split("@")[0]?.replace(/\W/g, "") || "Ana";
      return snapshot();
    },

    deposit(amount) {
      const first = state.vault.principal === 0;
      state.vault.principal = round(state.vault.principal + amount);
      state.weeklyInterest = round((state.vault.principal * state.vault.apy) / 52);
      if (first) state.houseMoney = round(state.houseMoney + RULES.welcomeBonus + state.weeklyInterest);
      return snapshot();
    },

    callIt(direction, boost, stake) {
      if (state.openPlay) throw new Error("You already have a call this week.");
      if (stake <= 0 || stake > state.houseMoney) throw new Error("You can only play with your house money.");
      if (boost < 1 || boost > RULES.maxBoost) throw new Error(`Boost goes from 1x to ${RULES.maxBoost}x.`);
      state.houseMoney = round(state.houseMoney - stake); // principal is never touched
      const play: Play = {
        id: crypto.randomUUID(),
        market: market.symbol,
        direction,
        boost,
        stake: round(stake),
        entryPrice: market.price,
        openedAt: Date.now(),
        expiresAt: nextFridayClose(),
        state: "open",
      };
      state.openPlay = play;
      return { ...play };
    },

    demoSettle(move) {
      if (!state.openPlay) throw new Error("No open call.");
      market.price = round(state.openPlay.entryPrice * (1 + move));
      market.priceSource = "demo";
      market.updatedAt = Date.now();
      const settled = settle(state.openPlay, market.price);
      state.houseMoney = round(state.houseMoney + (settled.payout ?? 0));
      state.streak = settled.state === "won" ? state.streak + 1 : 0;
      state.xp += settled.state === "won" ? 50 : 10;
      state.weekProgress = 1;
      state.openPlay = null;
      state.lastSettled = settled;
      const me = league.find((r) => r.isMe);
      if (me) {
        me.returnPct = round(((settled.payout ?? 0) - settled.stake) / settled.stake * 100);
        me.streak = state.streak;
      }
      return settled;
    },

    claimNewWeek() {
      state.houseMoney = round(state.houseMoney + state.weeklyInterest);
      state.weekProgress = 0.05;
      state.lastSettled = null;
      return snapshot();
    },
  };
}
