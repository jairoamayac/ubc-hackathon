// Thin, dependency-light client for the house_money Anchor program (no IDL needed).
// Used by the app (browser) and by the devnet scripts (Node runs this .ts file directly).
import { ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, type AccountMeta, type Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Buffer } from "buffer";

export const PROGRAM_ID = new PublicKey("9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht");
/** Pyth SOL/USD PriceUpdateV2 account (sponsored feed, Solana devnet). */
export const SOL_USD_FEED = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
export const DECIMALS = 6;
/** Priority fee so transactions land when devnet is busy (paid by the sponsor). */
export const priorityIxs = () => [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
];

const IX = {
  init_config: [23, 235, 115, 232, 168, 96, 1, 231],
  update_config: [29, 158, 252, 191, 10, 83, 219, 99],
  create_crew: [176, 106, 87, 57, 118, 114, 236, 48],
  join_crew: [86, 114, 155, 5, 187, 60, 196, 223],
  accrue: [23, 76, 128, 149, 229, 247, 72, 228],
  deposit: [242, 35, 198, 137, 82, 225, 242, 182],
  withdraw: [183, 18, 70, 156, 148, 109, 161, 34],
  open_call: [153, 26, 89, 45, 252, 243, 183, 62],
  settle_call: [58, 230, 6, 58, 104, 245, 154, 227],
} as const;
export const ACCOUNT_DISC = {
  Config: [155, 12, 170, 224, 30, 250, 204, 130],
  Crew: [61, 122, 32, 216, 23, 193, 251, 83],
  Member: [54, 19, 162, 21, 29, 166, 17, 198],
  Call: [62, 231, 169, 58, 154, 150, 83, 196],
} as const;

// ---------------------------------------------------------------- borsh helpers
class W {
  private parts: Uint8Array[] = [];
  bytes(b: ArrayLike<number>) { this.parts.push(Uint8Array.from(b)); return this; }
  u8(n: number) { return this.bytes([n & 0xff]); }
  u16(n: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return this.bytes(b); }
  u32(n: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return this.bytes(b); }
  u64(n: bigint) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, n, true); return this.bytes(b); }
  i64(n: bigint) { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, n, true); return this.bytes(b); }
  str(s: string) { const e = new TextEncoder().encode(s); this.u32(e.length); return this.bytes(e); }
  done() {
    const out = new Uint8Array(this.parts.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of this.parts) { out.set(p, o); o += p.length; }
    return Buffer.from(out);
  }
}
class R {
  private o = 8; // skip discriminator
  private v: DataView;
  private d: Uint8Array;
  constructor(d: Uint8Array) { this.d = d; this.v = new DataView(d.buffer, d.byteOffset, d.byteLength); }
  pk() { const p = new PublicKey(this.d.subarray(this.o, this.o + 32)); this.o += 32; return p; }
  u8() { return this.d[this.o++]; }
  bool() { return this.u8() === 1; }
  u16() { const n = this.v.getUint16(this.o, true); this.o += 2; return n; }
  u32() { const n = this.v.getUint32(this.o, true); this.o += 4; return n; }
  i32() { const n = this.v.getInt32(this.o, true); this.o += 4; return n; }
  u64() { const n = this.v.getBigUint64(this.o, true); this.o += 8; return n; }
  i64() { const n = this.v.getBigInt64(this.o, true); this.o += 8; return n; }
  str() { const len = this.u32(); const s = new TextDecoder().decode(this.d.subarray(this.o, this.o + len)); this.o += len; return s; }
}
const isAccount = (d: Uint8Array, disc: readonly number[]) => disc.every((b, i) => d[i] === b);

// ---------------------------------------------------------------- PDAs
const enc = (s: string) => new TextEncoder().encode(s);
const pda = (seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const le64 = (n: bigint) => new W().u64(n).done();
export const configPda = () => pda([enc("config")]);
export const yieldVaultPda = () => pda([enc("yield_vault")]);
export const houseVaultPda = () => pda([enc("house_vault")]);
export const crewPda = (creator: PublicKey, crewId: bigint) => pda([enc("crew"), creator.toBytes(), le64(crewId)]);
export const crewVaultPda = (crew: PublicKey) => pda([enc("crew_vault"), crew.toBytes()]);
export const memberPda = (crew: PublicKey, owner: PublicKey) => pda([enc("member"), crew.toBytes(), owner.toBytes()]);
export const callPda = (member: PublicKey) => pda([enc("call"), member.toBytes()]);

// ---------------------------------------------------------------- types
export interface ConfigArgs {
  apyBps: number; timeWarp: number; callDuration: number; maxBoost: number; maxWinMultiple: number; maxPriceAge: number;
}
export interface ConfigAccount extends ConfigArgs { admin: PublicKey; mint: PublicKey; priceFeed: PublicKey }
export interface CrewAccount {
  address: PublicKey; creator: PublicKey; crewId: bigint; name: string; emoji: string;
  totalShares: bigint; totalPrincipal: bigint; yieldPaid: bigint; members: number; createdAt: number; lastAccrual: number;
}
export interface MemberAccount {
  address: PublicKey; crew: PublicKey; owner: PublicKey; shares: bigint; principal: bigint;
  openCall: boolean; callsPlayed: number; callsWon: number; joinedAt: number;
}
export interface CallAccount {
  address: PublicKey; member: PublicKey; crew: PublicKey; owner: PublicKey; direction: 0 | 1; boost: number;
  stake: bigint; entryPrice: bigint; expo: number; openedAt: number; expiresAt: number;
}

export function decodeConfig(d: Uint8Array): ConfigAccount {
  if (!isAccount(d, ACCOUNT_DISC.Config)) throw new Error("not a Config account");
  const r = new R(d);
  return {
    admin: r.pk(), mint: r.pk(), priceFeed: r.pk(), apyBps: r.u16(), timeWarp: r.u32(), callDuration: Number(r.i64()),
    maxBoost: r.u8(), maxWinMultiple: r.u8(), maxPriceAge: Number(r.i64()),
  };
}
export function decodeCrew(address: PublicKey, d: Uint8Array): CrewAccount {
  if (!isAccount(d, ACCOUNT_DISC.Crew)) throw new Error("not a Crew account");
  const r = new R(d);
  return {
    address, creator: r.pk(), crewId: r.u64(), name: r.str(), emoji: r.str(), totalShares: r.u64(), totalPrincipal: r.u64(),
    yieldPaid: r.u64(), members: r.u32(), createdAt: Number(r.i64()), lastAccrual: Number(r.i64()),
  };
}
export function decodeMember(address: PublicKey, d: Uint8Array): MemberAccount {
  if (!isAccount(d, ACCOUNT_DISC.Member)) throw new Error("not a Member account");
  const r = new R(d);
  return {
    address, crew: r.pk(), owner: r.pk(), shares: r.u64(), principal: r.u64(), openCall: r.bool(),
    callsPlayed: r.u32(), callsWon: r.u32(), joinedAt: Number(r.i64()),
  };
}
export function decodeCall(address: PublicKey, d: Uint8Array): CallAccount {
  if (!isAccount(d, ACCOUNT_DISC.Call)) throw new Error("not a Call account");
  const r = new R(d);
  return {
    address, member: r.pk(), crew: r.pk(), owner: r.pk(), direction: r.u8() as 0 | 1, boost: r.u8(), stake: r.u64(),
    entryPrice: r.i64(), expo: r.i32(), openedAt: Number(r.i64()), expiresAt: Number(r.i64()),
  };
}

/** Reads a Pyth PriceUpdateV2 account (same layout the program parses). */
export function decodePythPrice(d: Uint8Array) {
  let o = 40;
  o += d[o] === 1 ? 1 : 2;
  o += 32;
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const price = v.getBigInt64(o, true);
  const expo = v.getInt32(o + 16, true);
  const publishTime = Number(v.getBigInt64(o + 20, true));
  return { price: Number(price) * 10 ** expo, raw: price, expo, publishTime };
}

// ---------------------------------------------------------------- math (mirrors the program)
const VIRTUAL_SHARES = 1000n;
const VIRTUAL_ASSETS = 1n;
export const assetsForShares = (shares: bigint, totalShares: bigint, vault: bigint) =>
  (shares * (vault + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES);
export const toUsd = (units: bigint) => Number(units) / 10 ** DECIMALS;
export const fromUsd = (usd: number) => BigInt(Math.round(usd * 10 ** DECIMALS));

// ---------------------------------------------------------------- instructions
const m = (pubkey: PublicKey, isWritable = false, isSigner = false): AccountMeta => ({ pubkey, isWritable, isSigner });
const ix = (keys: AccountMeta[], data: Buffer) => new TransactionInstruction({ programId: PROGRAM_ID, keys, data });

function configArgs(w: W, a: ConfigArgs) {
  return w.u16(a.apyBps).u32(a.timeWarp).i64(BigInt(a.callDuration)).u8(a.maxBoost).u8(a.maxWinMultiple).i64(BigInt(a.maxPriceAge));
}

export function initConfigIx(admin: PublicKey, mint: PublicKey, args: ConfigArgs, priceFeed = SOL_USD_FEED) {
  return ix(
    [m(admin, true, true), m(configPda(), true), m(mint), m(yieldVaultPda(), true), m(houseVaultPda(), true), m(priceFeed),
      m(TOKEN_PROGRAM_ID), m(SystemProgram.programId)],
    configArgs(new W().bytes(IX.init_config), args).done(),
  );
}
export function updateConfigIx(admin: PublicKey, args: ConfigArgs) {
  return ix([m(admin, false, true), m(configPda(), true)], configArgs(new W().bytes(IX.update_config), args).done());
}
export function createCrewIx(payer: PublicKey, owner: PublicKey, mint: PublicKey, crewId: bigint, name: string, emoji: string) {
  const crew = crewPda(owner, crewId);
  return ix(
    [m(payer, true, true), m(owner, false, true), m(configPda()), m(mint), m(crew, true), m(crewVaultPda(crew), true),
      m(memberPda(crew, owner), true), m(TOKEN_PROGRAM_ID), m(SystemProgram.programId)],
    new W().bytes(IX.create_crew).u64(crewId).str(name).str(emoji).done(),
  );
}
export function joinCrewIx(payer: PublicKey, owner: PublicKey, crew: PublicKey) {
  return ix(
    [m(payer, true, true), m(owner, false, true), m(crew, true), m(memberPda(crew, owner), true), m(SystemProgram.programId)],
    new W().bytes(IX.join_crew).done(),
  );
}
export function accrueIx(mint: PublicKey, crew: PublicKey) {
  return ix(
    [m(configPda()), m(mint), m(crew, true), m(crewVaultPda(crew), true), m(yieldVaultPda(), true), m(TOKEN_PROGRAM_ID)],
    new W().bytes(IX.accrue).done(),
  );
}
function moneyKeys(owner: PublicKey, mint: PublicKey, crew: PublicKey) {
  return [m(owner, false, true), m(configPda()), m(mint), m(crew, true), m(crewVaultPda(crew), true), m(yieldVaultPda(), true),
    m(memberPda(crew, owner), true), m(getAssociatedTokenAddressSync(mint, owner), true), m(TOKEN_PROGRAM_ID)];
}
export function depositIx(owner: PublicKey, mint: PublicKey, crew: PublicKey, amount: bigint) {
  return ix(moneyKeys(owner, mint, crew), new W().bytes(IX.deposit).u64(amount).done());
}
export function withdrawIx(owner: PublicKey, mint: PublicKey, crew: PublicKey, shares: bigint) {
  return ix(moneyKeys(owner, mint, crew), new W().bytes(IX.withdraw).u64(shares).done());
}
export function openCallIx(payer: PublicKey, owner: PublicKey, mint: PublicKey, crew: PublicKey, direction: 0 | 1, boost: number, stake: bigint) {
  const member = memberPda(crew, owner);
  return ix(
    [m(payer, true, true), m(owner, false, true), m(configPda()), m(mint), m(crew, true), m(crewVaultPda(crew), true),
      m(yieldVaultPda(), true), m(houseVaultPda(), true), m(member, true), m(callPda(member), true), m(SOL_USD_FEED),
      m(TOKEN_PROGRAM_ID), m(SystemProgram.programId)],
    new W().bytes(IX.open_call).u8(direction).u8(boost).u64(stake).done(),
  );
}
export function settleCallIx(payer: PublicKey, mint: PublicKey, crew: PublicKey, owner: PublicKey) {
  const member = memberPda(crew, owner);
  return ix(
    [m(payer, true, true), m(configPda()), m(mint), m(crew, true), m(crewVaultPda(crew), true), m(yieldVaultPda(), true),
      m(houseVaultPda(), true), m(member, true), m(callPda(member), true), m(SOL_USD_FEED), m(TOKEN_PROGRAM_ID)],
    new W().bytes(IX.settle_call).done(),
  );
}

/** Account filter for getProgramAccounts by Anchor discriminator (base58 of the 8 bytes). */
export function discFilter(disc: readonly number[], bs58encode: (b: Uint8Array) => string) {
  return { memcmp: { offset: 0, bytes: bs58encode(Uint8Array.from(disc)) } };
}

/** Confirms by polling (no websockets: works in Workers, browsers and behind proxies). */
export async function confirm(conn: Connection, signature: string, lastValidBlockHeight: number, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await conn.getSignatureStatuses([signature]);
    const st = value[0];
    if (st?.err) throw new Error(`Could not save that, try again. (${JSON.stringify(st.err)})`);
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
    if ((await conn.getBlockHeight("confirmed")) > lastValidBlockHeight) throw new Error("That took too long, try again.");
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("This is taking longer than usual, try again.");
}

// ================================================================ social layer (programs/house_money/src/social.rs)

const SOCIAL_IX = {
  set_profile: [221, 221, 195, 121, 133, 71, 113, 170],
  create_bet: [197, 42, 153, 2, 59, 63, 143, 246],
  place_bet: [222, 62, 67, 220, 63, 166, 126, 33],
  vote_bet: [192, 213, 112, 35, 108, 39, 253, 142],
  claim_bet: [60, 61, 185, 215, 180, 119, 174, 126],
  create_challenge: [170, 244, 47, 1, 1, 15, 173, 239],
  join_challenge: [41, 104, 214, 73, 32, 168, 76, 79],
  vote_entry: [153, 149, 139, 2, 39, 46, 186, 44],
  claim_challenge: [132, 167, 9, 45, 203, 244, 30, 171],
  join_with_goal: [164, 7, 145, 205, 198, 59, 220, 112],
  take_fee: [78, 179, 29, 200, 7, 172, 106, 91],
} as const;
export const SOCIAL_ACCOUNT_DISC = {
  Profile: [184, 101, 165, 188, 95, 63, 127, 188],
  Bet: [147, 23, 35, 59, 15, 75, 155, 32],
  Position: [170, 188, 143, 228, 122, 64, 247, 208],
  Challenge: [119, 250, 161, 121, 119, 81, 22, 208],
  Entry: [63, 18, 152, 113, 215, 246, 221, 250],
  Vote: [96, 91, 104, 57, 145, 35, 172, 155],
  GoalNote: [159, 11, 5, 248, 151, 135, 70, 170],
  FeeTaken: [231, 203, 37, 243, 74, 2, 31, 230],
} as const;
/** Discriminators of social instructions where account #0 only pays rent (used by the edge API). */
export const SOCIAL_PAYER_IXS = [
  SOCIAL_IX.set_profile, SOCIAL_IX.create_bet, SOCIAL_IX.place_bet, SOCIAL_IX.vote_bet,
  SOCIAL_IX.create_challenge, SOCIAL_IX.join_challenge, SOCIAL_IX.vote_entry,
  SOCIAL_IX.join_with_goal, SOCIAL_IX.take_fee,
].map((d) => d.join(","));

export const OUTCOME = { OPEN: 0, YES: 1, NO: 2 } as const;
export const ENTRY = { PENDING: 0, PASSED: 1, FAILED: 2 } as const;
export const NOBODY = PublicKey.default;

export const profilePda = (owner: PublicKey) => pda([enc("profile"), owner.toBytes()]);
export const betPda = (crew: PublicKey, betId: bigint) => pda([enc("bet"), crew.toBytes(), le64(betId)]);
export const positionPda = (bet: PublicKey, owner: PublicKey) => pda([enc("position"), bet.toBytes(), owner.toBytes()]);
export const challengePda = (crew: PublicKey, id: bigint) => pda([enc("challenge"), crew.toBytes(), le64(id)]);
export const entryPda = (challenge: PublicKey, owner: PublicKey) => pda([enc("entry"), challenge.toBytes(), owner.toBytes()]);
export const votePda = (target: PublicKey, voter: PublicKey) => pda([enc("vote"), target.toBytes(), voter.toBytes()]);
export const goalPda = (entry: PublicKey) => pda([enc("goal"), entry.toBytes()]);
export const feePda = (challenge: PublicKey) => pda([enc("fee"), challenge.toBytes()]);
/** Platform share of forfeits (mirrors social::PLATFORM_FEE_BPS). */
export const PLATFORM_FEE_BPS = 500n;
export function platformFee(passed: bigint, failed: bigint) {
  return passed === 0n ? 0n : (failed * PLATFORM_FEE_BPS) / 10_000n;
}
/** Mirrors social::commitment_payout: stake + pro-rata share of 95% of the forfeits. */
export function commitmentPayout(own: bigint, passed: bigint, failed: bigint) {
  return winnerPayout(own, passed, failed - platformFee(passed, failed));
}
export function decodeGoal(d: Uint8Array) {
  if (!isAccount(d, SOCIAL_ACCOUNT_DISC.GoalNote)) throw new Error("not a GoalNote account");
  const r = new R(d);
  return { entry: r.pk(), goal: r.str() };
}

export interface ProfileAccount { address: PublicKey; owner: PublicKey; name: string }
export interface BetAccount {
  address: PublicKey; crew: PublicKey; creator: PublicKey; betId: bigint; question: string; subject: PublicKey;
  closesAt: number; yesShares: bigint; noShares: bigint; bettors: number; yesVotes: number; noVotes: number; outcome: number;
}
export interface PositionAccount { address: PublicKey; bet: PublicKey; owner: PublicKey; side: number; shares: bigint; claimed: boolean }
export interface ChallengeAccount {
  address: PublicKey; crew: PublicKey; creator: PublicKey; challengeId: bigint; title: string; stake: bigint; endsAt: number;
  participants: number; decided: number; passedShares: bigint; failedShares: bigint;
}
export interface EntryAccount {
  address: PublicKey; challenge: PublicKey; owner: PublicKey; shares: bigint; passVotes: number; failVotes: number; status: number; claimed: boolean;
}

export function decodeProfile(address: PublicKey, d: Uint8Array): ProfileAccount {
  if (!isAccount(d, SOCIAL_ACCOUNT_DISC.Profile)) throw new Error("not a Profile account");
  const r = new R(d);
  return { address, owner: r.pk(), name: r.str() };
}
export function decodeBet(address: PublicKey, d: Uint8Array): BetAccount {
  if (!isAccount(d, SOCIAL_ACCOUNT_DISC.Bet)) throw new Error("not a Bet account");
  const r = new R(d);
  return {
    address, crew: r.pk(), creator: r.pk(), betId: r.u64(), question: r.str(), subject: r.pk(), closesAt: Number(r.i64()),
    yesShares: r.u64(), noShares: r.u64(), bettors: r.u16(), yesVotes: r.u16(), noVotes: r.u16(), outcome: r.u8(),
  };
}
export function decodePosition(address: PublicKey, d: Uint8Array): PositionAccount {
  if (!isAccount(d, SOCIAL_ACCOUNT_DISC.Position)) throw new Error("not a Position account");
  const r = new R(d);
  return { address, bet: r.pk(), owner: r.pk(), side: r.u8(), shares: r.u64(), claimed: r.bool() };
}
export function decodeChallenge(address: PublicKey, d: Uint8Array): ChallengeAccount {
  if (!isAccount(d, SOCIAL_ACCOUNT_DISC.Challenge)) throw new Error("not a Challenge account");
  const r = new R(d);
  return {
    address, crew: r.pk(), creator: r.pk(), challengeId: r.u64(), title: r.str(), stake: r.u64(), endsAt: Number(r.i64()),
    participants: r.u16(), decided: r.u16(), passedShares: r.u64(), failedShares: r.u64(),
  };
}
export function decodeEntry(address: PublicKey, d: Uint8Array): EntryAccount {
  if (!isAccount(d, SOCIAL_ACCOUNT_DISC.Entry)) throw new Error("not an Entry account");
  const r = new R(d);
  return {
    address, challenge: r.pk(), owner: r.pk(), shares: r.u64(), passVotes: r.u16(), failVotes: r.u16(), status: r.u8(), claimed: r.bool(),
  };
}

/** Mirrors social::winner_payout. */
export function winnerPayout(own: bigint, winnersTotal: bigint, losersTotal: bigint) {
  return winnersTotal === 0n ? own : own + (losersTotal * own) / winnersTotal;
}

export function setProfileIx(payer: PublicKey, owner: PublicKey, name: string) {
  return ix([m(payer, true, true), m(owner, false, true), m(profilePda(owner), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.set_profile).str(name).done());
}
export function createBetIx(payer: PublicKey, owner: PublicKey, crew: PublicKey, betId: bigint, question: string, subject: PublicKey, closesAt: number) {
  return ix([m(payer, true, true), m(owner, false, true), m(crew), m(memberPda(crew, owner)), m(betPda(crew, betId), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.create_bet).u64(betId).str(question).bytes(subject.toBytes()).i64(BigInt(closesAt)).done());
}
export function placeBetIx(payer: PublicKey, owner: PublicKey, crew: PublicKey, bet: PublicKey, side: 1 | 2, shares: bigint) {
  return ix([m(payer, true, true), m(owner, false, true), m(crew), m(memberPda(crew, owner), true), m(bet, true),
    m(positionPda(bet, owner), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.place_bet).u8(side).u64(shares).done());
}
export function voteBetIx(payer: PublicKey, owner: PublicKey, crew: PublicKey, bet: PublicKey, choice: 1 | 2) {
  return ix([m(payer, true, true), m(owner, false, true), m(crew), m(memberPda(crew, owner)), m(bet, true),
    m(votePda(bet, owner), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.vote_bet).u8(choice).done());
}
export function claimBetIx(owner: PublicKey, crew: PublicKey, bet: PublicKey) {
  return ix([m(owner, false, true), m(crew), m(memberPda(crew, owner), true), m(bet), m(positionPda(bet, owner), true)],
    new W().bytes(SOCIAL_IX.claim_bet).done());
}
export function createChallengeIx(payer: PublicKey, owner: PublicKey, crew: PublicKey, id: bigint, title: string, stake: bigint, endsAt: number) {
  return ix([m(payer, true, true), m(owner, false, true), m(crew), m(memberPda(crew, owner)), m(challengePda(crew, id), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.create_challenge).u64(id).str(title).u64(stake).i64(BigInt(endsAt)).done());
}
export function joinChallengeIx(payer: PublicKey, owner: PublicKey, crew: PublicKey, challenge: PublicKey) {
  return ix([m(payer, true, true), m(owner, false, true), m(crew), m(crewVaultPda(crew)), m(memberPda(crew, owner), true),
    m(challenge, true), m(entryPda(challenge, owner), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.join_challenge).done());
}
export function voteEntryIx(payer: PublicKey, owner: PublicKey, crew: PublicKey, challenge: PublicKey, entryOwner: PublicKey, passed: boolean) {
  const entry = entryPda(challenge, entryOwner);
  return ix([m(payer, true, true), m(owner, false, true), m(crew), m(memberPda(crew, owner)), m(challenge, true), m(entry, true),
    m(entryPda(challenge, owner)), m(votePda(entry, owner), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.vote_entry).u8(passed ? 1 : 0).done());
}
export function claimChallengeIx(owner: PublicKey, crew: PublicKey, challenge: PublicKey) {
  return ix([m(owner, false, true), m(crew), m(memberPda(crew, owner), true), m(challenge), m(entryPda(challenge, owner), true)],
    new W().bytes(SOCIAL_IX.claim_challenge).done());
}

export function joinWithGoalIx(payer: PublicKey, owner: PublicKey, crew: PublicKey, challenge: PublicKey, goal: string, stake: bigint) {
  const entry = entryPda(challenge, owner);
  return ix([m(payer, true, true), m(owner, false, true), m(crew), m(crewVaultPda(crew)), m(memberPda(crew, owner), true),
    m(challenge, true), m(entry, true), m(goalPda(entry), true), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.join_with_goal).str(goal).u64(stake).done());
}
export function takeFeeIx(payer: PublicKey, mint: PublicKey, crew: PublicKey, challenge: PublicKey) {
  return ix([m(payer, true, true), m(configPda()), m(mint), m(crew, true), m(crewVaultPda(crew), true), m(houseVaultPda(), true),
    m(challenge), m(feePda(challenge), true), m(TOKEN_PROGRAM_ID), m(SystemProgram.programId)],
    new W().bytes(SOCIAL_IX.take_fee).done());
}
