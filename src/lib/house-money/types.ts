// Domain types shared by the UI and the client facade.
// They mirror the on-chain accounts described in docs/architecture.md

export type Direction = "up" | "down";

/** State pattern: lifecycle of a weekly play (mirrors the on-chain PlayState enum). */
export type PlayState = "open" | "won" | "lost" | "knockout" | "refunded";

export interface Market {
  symbol: "SOL";
  name: string;
  price: number; // USD, from Pyth (simulated in the mock)
  priceSource: "pyth" | "demo";
  updatedAt: number; // ms
}

export interface Play {
  id: string;
  market: Market["symbol"];
  direction: Direction;
  boost: number; // 1..5
  stake: number; // USD of house money at risk
  entryPrice: number;
  exitPrice?: number;
  openedAt: number;
  expiresAt: number; // Friday 4 PM
  state: PlayState;
  payout?: number; // what comes back to house money when settled
}

export interface HomeState {
  user: { name: string; email: string };
  vault: { principal: number; apy: number };
  houseMoney: number;
  weeklyInterest: number; // what the vault paid this week
  streak: number; // good calls in a row
  xp: number;
  weekProgress: number; // 0..1 until Friday close
  openPlay: Play | null;
  lastSettled: Play | null;
  roundUps: RoundUp[]; // this week's spare change, already in the Vault
  stack: { btc: number; usdIn: number }; // BTC bought with house money (Stack)
}

/** A card purchase rounded up to the next dollar; the difference goes to the Vault. */
export interface RoundUp {
  merchant: string;
  amount: number;
  spare: number;
}

export interface LeagueRow {
  name: string;
  avatar: string; // initials
  returnPct: number; // % on house money this season
  streak: number;
  isMe?: boolean;
}

export const RULES = {
  maxBoost: 5,
  maxWinMultiple: 2, // max profit per play = stake × 2 (protects the house pool)
  welcomeBonus: 10,
} as const;
