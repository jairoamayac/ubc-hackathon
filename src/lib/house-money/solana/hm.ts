// Thin, dependency-light client for the house_money Anchor program (no IDL needed).
// Used by the app (browser) and by the devnet scripts (Node runs this .ts file directly).
import { PublicKey, SystemProgram, TransactionInstruction, type AccountMeta, type Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Buffer } from "buffer";

export const PROGRAM_ID = new PublicKey("9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht");
/** Pyth SOL/USD PriceUpdateV2 account (sponsored feed, Solana devnet). */
export const SOL_USD_FEED = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
export const DECIMALS = 6;

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
    if (st?.err) throw new Error(`Transaction failed: ${JSON.stringify(st.err)}`);
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
    if ((await conn.getBlockHeight("confirmed")) > lastValidBlockHeight) throw new Error("Transaction expired, try again.");
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Network is slow, try again.");
}
