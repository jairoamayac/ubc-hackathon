// Live client: talks to the house_money program on Solana (devnet) through the app's edge API.
// People never see keys, SOL or signatures: the account key is created on the device and every
// fee is paid by the sponsor (/api/sponsor). In production the key would live in Privy.
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";
import { Buffer } from "buffer";
import * as hm from "./hm";
import { createRpcFetch } from "./rpc-fetch";
import { keypairSigner, type OwnerSigner } from "./signer";

export interface AppConfig { rpc: string; mint: string; sponsor: string; programId: string }

export interface CrewView extends hm.CrewAccount {
  vault: number; // dollars in the pot now
  growthPct: number; // yield paid / principal
  yieldPerDay: number; // at the current (demo) rate
  me?: { value: number; principal: number; playable: number; member: hm.MemberAccount; /** UI only: just joined, not on the network yet */ pending?: boolean };
  /** Dollars of mine locked on pact goals here (still mine until friends confirm), same formula as the group screen. */
  locked: number;
}

export interface Snapshot {
  cash: number; // dollars in the person's account (not in a crew)
  crews: CrewView[]; // every crew, ranked by growth
  call?: hm.CallAccount;
  callCrew?: PublicKey;
  sol: { price: number; publishTime: number };
  config: hm.ConfigAccount;
  now: number;
}


export interface PersonView { owner: PublicKey; name: string; value: number; isMe: boolean }
export interface BetView {
  bet: hm.BetAccount;
  subjectName?: string;
  creatorName: string;
  yesUsd: number;
  noUsd: number;
  mine?: { side: number; usd: number; claimed: boolean; payoutUsd: number };
  myVote?: number;
  canVote: boolean;
}
export interface EntryView { entry: hm.EntryAccount; name: string; isMe: boolean; myVote?: number; goal?: string; stakeUsd: number }
export interface ChallengeView {
  challenge: hm.ChallengeAccount;
  creatorName: string;
  stakeUsd: number;
  potUsd: number;
  entries: EntryView[];
  mine?: EntryView & { payoutUsd: number; usd: number };
  feeTaken: boolean;
  feeUsd: number;
  forfeitUsd: number;
  /** UI only: I just locked money here and the network has not shown it yet. */
  joinedPending?: boolean;
}
export interface CrewDetail { crew: PublicKey; people: PersonView[]; bets: BetView[]; challenges: ChallengeView[]; isMember: boolean }

const KEY = "hm.account.v1";

// Duplicate demo crews left on devnet by interrupted seed runs. Crews cannot be deleted on-chain,
// so the app hides them (their funds stay in their vaults).
const HIDDEN_CREWS = new Set([
  "4Q75qQMSECw5gZFKLVrQBDhT2gEBhfuxNMZ5uxfXQRH4",
  "CSWd2WW5HsqMDemMKvisVisUJ9Ad6Q3A3gdghLwRkegL",
  "GZVEhfyhC7b6T9vqucn9XiAekmsXWzfegvVqxVySWzaq",
  "AgxFcepgNhbDUDtwdzgATXzZgcTbrEpWJm5y5HeXbNn2", // e2e run before test crews were prefixed
  "2kyNt9T5XmXAZRMKvXvtgL67DHaSBBDyZbH4vPuL7RB1", // demo seed interrupted by a devnet timeout
]);

export function loadAccount(): Keypair {
  const raw = localStorage.getItem(KEY);
  if (raw) return Keypair.fromSecretKey(bs58.decode(raw));
  const kp = Keypair.generate();
  localStorage.setItem(KEY, bs58.encode(kp.secretKey));
  return kp;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok || data.error) throw new Error(friendly(data.error ?? `Request failed (${res.status})`));
  return data;
}

const TROUBLE = "We're having trouble connecting right now. Please try again in a moment.";

function friendly(msg: string) {
  if (msg.includes("BetClosed")) return "That one is closed already.";
  if (msg.includes("BetStillOpen")) return "Voting opens when time is up.";
  if (msg.includes("SubjectCantVote")) return "You can't vote on yourself.";
  if (msg.includes("AlreadyDecided")) return "The crew already decided.";
  if (msg.includes("NotDecided")) return "The crew hasn't decided yet.";
  if (msg.includes("AlreadyClaimed")) return "Already collected.";
  if (msg.includes("NotEnoughShares")) return "Not enough money in this crew. Add more first.";
  if (msg.includes("already in use")) return "You already did that one.";
  if (msg.includes("NotAParticipant") || msg.includes("voter_entry")) return "Only people who put money in can verify.";
  if (msg.includes("StakeTooLow")) return "Put in at least the group's minimum.";
  if (msg.includes("PrincipalIsProtected")) return "That money is locked. Only free money can be used here.";
  if (msg.includes("CallNotExpired")) return "Your call is still running.";
  if (msg.includes("CallOpen")) return "Finish your open call first.";
  if (msg.includes("insufficient funds")) return "Not enough cash. Add money first.";
  // Infrastructure hiccups (rate limits, offline, timeouts): never show the raw server answer to people.
  if (/\b(429|50[234])\b|too many requests|rate limit|jsonrpc|failed to fetch|fetch failed|networkerror|network request failed|load failed|timed? ?out|econn|socket hang up|getlatestblockhash|failed to get/i.test(msg)) return TROUBLE;
  // Never show chain internals to people (brand rule: no crypto jargon).
  if (/transaction|blockhash|signature|lamport|account|program|instruction|simulation|0x[0-9a-f]/i.test(msg)) return "Something went wrong. Try again.";
  return msg;
}

/** Plain-language message for anything thrown by the client (safe to show in a toast). */
export function friendlyError(e: unknown): string {
  return friendly(e instanceof Error ? e.message : String(e));
}

export class LiveClient {
  readonly owner: OwnerSigner;
  private conn: Connection;
  readonly mint: PublicKey;
  private sponsor: PublicKey;

  private constructor(cfg: AppConfig, owner: OwnerSigner) {
    this.owner = owner;
    // Polite RPC: throttled, de-duplicated, shared 429 backoff (see rpc-fetch.ts). web3.js' own retry is off.
    this.conn = new Connection(cfg.rpc, { commitment: "confirmed", fetch: createRpcFetch(), disableRetryOnRateLimit: true });
    this.mint = new PublicKey(cfg.mint);
    this.sponsor = new PublicKey(cfg.sponsor);
  }

  /** Callers that ask for the same read at the same time (timers, refreshes after actions) share one round of requests. */
  private inflight = new Map<string, Promise<unknown>>();
  private once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let p = this.inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = fn()
        .catch((e) => {
          throw new Error(friendlyError(e));
        })
        .finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  /** `owner` is the signed-in account (Privy). Without one, the demo key stored on this device is used. */
  static async connect(owner?: OwnerSigner) {
    return new LiveClient(await api<AppConfig>("/api/config"), owner ?? keypairSigner(loadAccount()));
  }

  /** One round of reads: cash, every crew (for the leaderboard), my memberships, my open call, SOL price. */
  snapshot(): Promise<Snapshot> {
    return this.once("snapshot", () => this.readSnapshot());
  }
  private async readSnapshot(): Promise<Snapshot> {
    const me = this.owner.publicKey;
    const ata = getAssociatedTokenAddressSync(this.mint, me);
    const [crewAccs, memberAccs, entryAccs, infos] = await Promise.all([
      this.conn.getProgramAccounts(hm.PROGRAM_ID, { filters: [hm.discFilter(hm.ACCOUNT_DISC.Crew, bs58.encode)] }),
      this.conn.getProgramAccounts(hm.PROGRAM_ID, {
        filters: [hm.discFilter(hm.ACCOUNT_DISC.Member, bs58.encode), { memcmp: { offset: 40, bytes: me.toBase58() } }],
      }),
      // My pact entries: money locked on goals. Home must count it, or locking looks like losing it.
      this.conn.getProgramAccounts(hm.PROGRAM_ID, { filters: this.filter(hm.SOCIAL_ACCOUNT_DISC.Entry, 40, me) }),
      this.conn.getMultipleAccountsInfo([ata, hm.configPda(), hm.SOL_USD_FEED]),
    ]);
    const cash = infos[0] ? Number(infos[0].data.readBigUInt64LE(64)) / 1e6 : 0;
    const config = hm.decodeConfig(infos[1]!.data);
    const pyth = hm.decodePythPrice(infos[2]!.data);

    const crews = crewAccs
      .filter((a) => !HIDDEN_CREWS.has(a.pubkey.toBase58()))
      .map((a) => hm.decodeCrew(a.pubkey, a.account.data))
      .filter((c) => !c.name.startsWith("[test]")); // crews created by scripts/e2e.mts
    const myEntries = entryAccs.map((a) => hm.decodeEntry(a.pubkey, a.account.data)).filter((e) => !e.claimed);
    const challengeKeys = [...new Set(myEntries.map((e) => e.challenge.toBase58()))].map((k) => new PublicKey(k));
    const lookups = [...crews.map((c) => hm.crewVaultPda(c.address)), ...challengeKeys];
    const looked: (import("@solana/web3.js").AccountInfo<Buffer> | null)[] = [];
    for (let i = 0; i < lookups.length; i += 100) looked.push(...(await this.conn.getMultipleAccountsInfo(lookups.slice(i, i + 100))));
    const vaults = looked.slice(0, crews.length);
    const challenges = new Map<string, hm.ChallengeAccount>();
    challengeKeys.forEach((k, i) => {
      const inf = looked[crews.length + i];
      if (inf) challenges.set(k.toBase58(), hm.decodeChallenge(k, inf.data));
    });
    const members = new Map(memberAccs.map((a) => {
      const m = hm.decodeMember(a.pubkey, a.account.data);
      return [m.crew.toBase58(), m];
    }));
    const perDayRate = (config.apyBps / 10_000) * (config.timeWarp / 365);

    const views: CrewView[] = crews.map((c, i) => {
      const vaultUnits = vaults[i] ? vaults[i]!.data.readBigUInt64LE(64) : 0n;
      const principal = hm.toUsd(c.totalPrincipal);
      const view: CrewView = {
        ...c,
        vault: hm.toUsd(vaultUnits),
        growthPct: principal > 0 ? (hm.toUsd(c.yieldPaid) / principal) * 100 : 0,
        yieldPerDay: principal * perDayRate,
        locked: 0,
      };
      for (const e of myEntries) {
        const ch = challenges.get(e.challenge.toBase58());
        if (!ch || !ch.crew.equals(c.address)) continue;
        const settled = ch.participants > 0 && ch.decided === ch.participants;
        let units = e.shares;
        if (settled) units = ch.passedShares === 0n ? e.shares : e.status === hm.ENTRY.PASSED ? hm.commitmentPayout(e.shares, ch.passedShares, ch.failedShares) : 0n;
        view.locked += hm.toUsd(hm.assetsForShares(units, c.totalShares, vaultUnits));
      }
      const m = members.get(c.address.toBase58());
      if (m) {
        const value = hm.toUsd(hm.assetsForShares(m.shares, c.totalShares, vaultUnits));
        const p = hm.toUsd(m.principal);
        view.me = { value, principal: p, playable: Math.max(0, value - p), member: m };
      }
      return view;
    });
    views.sort((a, b) => b.growthPct - a.growthPct || b.vault - a.vault);

    let call: hm.CallAccount | undefined;
    const open = [...members.values()].find((m) => m.openCall);
    if (open) {
      const addr = hm.callPda(open.address);
      const info = await this.conn.getAccountInfo(addr);
      if (info) call = hm.decodeCall(addr, info.data);
    }
    return {
      cash, crews: views, call, callCrew: open?.crew, config, now: Date.now() / 1000,
      sol: { price: pyth.price, publishTime: pyth.publishTime },
    };
  }

  // ------------------------------------------------------------ actions
  async topUp(usd: number) {
    try {
      const { blockhash, lastValidBlockHeight } = await this.conn.getLatestBlockhash("confirmed");
      const { tx } = await api<{ tx: string }>("/api/topup", { owner: this.owner.publicKey.toBase58(), amount: usd, blockhash });
      return await this.submit(tx, lastValidBlockHeight);
    } catch (e) {
      throw new Error(friendlyError(e));
    }
  }

  createCrew(name: string, emoji: string, id: bigint = BigInt(Date.now())) {
    return this.send([hm.createCrewIx(this.sponsor, this.owner.publicKey, this.mint, id, name, emoji)]);
  }
  /** Address of a group this person creates with the given id. */
  crewAddress(id: bigint) {
    return hm.crewPda(this.owner.publicKey, id);
  }
  join(crew: PublicKey) {
    return this.send([hm.joinCrewIx(this.sponsor, this.owner.publicKey, crew)]);
  }
  /** Joins first when needed, then moves dollars from the person's account into the crew. */
  async deposit(crew: PublicKey, usd: number, isMember: boolean) {
    const ixs = isMember ? [] : [hm.joinCrewIx(this.sponsor, this.owner.publicKey, crew)];
    ixs.push(hm.depositIx(this.owner.publicKey, this.mint, crew, hm.fromUsd(usd)));
    return this.send(ixs);
  }
  /** Takes out a dollar amount (or everything) by burning the matching shares. */
  withdraw(crew: CrewView, usd: number | "all") {
    const m = crew.me!.member;
    const shares = usd === "all" || usd >= crew.me!.value
      ? m.shares
      : (m.shares * hm.fromUsd(usd)) / hm.fromUsd(crew.me!.value);
    return this.send([hm.withdrawIx(this.owner.publicKey, this.mint, crew.address, shares)]);
  }
  openCall(crew: PublicKey, direction: 0 | 1, boost: number, usd: number) {
    return this.send([hm.openCallIx(this.sponsor, this.owner.publicKey, this.mint, crew, direction, boost, hm.fromUsd(usd))]);
  }
  settle(crew: PublicKey) {
    return this.send([hm.settleCallIx(this.sponsor, this.mint, crew, this.owner.publicKey)]);
  }

  // ------------------------------------------------------------ social layer
  private filter(disc: readonly number[], offset?: number, key?: PublicKey) {
    const f: ({ memcmp: { offset: number; bytes: string } })[] = [hm.discFilter(disc, bs58.encode)];
    if (key && offset !== undefined) f.push({ memcmp: { offset, bytes: key.toBase58() } });
    return f;
  }

  /** Everything the crew screen needs: people with names, bets and challenges with my position and votes. */
  crewDetail(crew: PublicKey): Promise<CrewDetail> {
    return this.once(`detail:${crew.toBase58()}`, () => this.readCrewDetail(crew));
  }
  private async readCrewDetail(crew: PublicKey): Promise<CrewDetail> {
    const me = this.owner.publicKey;
    const [members, bets, challenges, crewInfo, vaultInfo] = await Promise.all([
      this.conn.getProgramAccounts(hm.PROGRAM_ID, { filters: this.filter(hm.ACCOUNT_DISC.Member, 8, crew) }),
      this.conn.getProgramAccounts(hm.PROGRAM_ID, { filters: this.filter(hm.SOCIAL_ACCOUNT_DISC.Bet, 8, crew) }),
      this.conn.getProgramAccounts(hm.PROGRAM_ID, { filters: this.filter(hm.SOCIAL_ACCOUNT_DISC.Challenge, 8, crew) }),
      this.conn.getAccountInfo(crew),
      this.conn.getAccountInfo(hm.crewVaultPda(crew)),
    ]);
    if (!crewInfo) throw new Error("That group could not be found.");
    const c = hm.decodeCrew(crew, crewInfo.data);
    const vault = vaultInfo ? vaultInfo.data.readBigUInt64LE(64) : 0n;
    const usd = (shares: bigint) => hm.toUsd(hm.assetsForShares(shares, c.totalShares, vault));
    const ms = members.map((a) => hm.decodeMember(a.pubkey, a.account.data));

    const bs = bets.map((a) => hm.decodeBet(a.pubkey, a.account.data)).sort((x, y) => Number(y.betId - x.betId));
    const cs = challenges.map((a) => hm.decodeChallenge(a.pubkey, a.account.data)).sort((x, y) => Number(y.challengeId - x.challengeId));
    const entryAccs = cs.length
      ? (await Promise.all(cs.map((ch) => this.conn.getProgramAccounts(hm.PROGRAM_ID, { filters: this.filter(hm.SOCIAL_ACCOUNT_DISC.Entry, 8, ch.address) })))).flat()
      : [];
    const entries = entryAccs.map((a) => hm.decodeEntry(a.pubkey, a.account.data));

    // Names, my positions and my votes in a few batched reads.
    const owners = [...new Set([...ms.map((m) => m.owner.toBase58()), ...bs.map((b) => b.subject.toBase58())])].map((k) => new PublicKey(k));
    const lookups = [
      ...owners.map((o) => hm.profilePda(o)),
      ...bs.map((b) => hm.positionPda(b.address, me)),
      ...bs.map((b) => hm.votePda(b.address, me)),
      ...entries.map((e) => hm.votePda(e.address, me)),
      ...entries.map((e) => hm.goalPda(e.address)),
      ...cs.map((ch) => hm.feePda(ch.address)),
    ];
    const infos: (import("@solana/web3.js").AccountInfo<Buffer> | null)[] = [];
    for (let i = 0; i < lookups.length; i += 100) infos.push(...(await this.conn.getMultipleAccountsInfo(lookups.slice(i, i + 100))));
    let k = 0;
    const names = new Map<string, string>();
    for (const o of owners) {
      const inf = infos[k++];
      names.set(o.toBase58(), inf ? hm.decodeProfile(hm.profilePda(o), inf.data).name : "Someone");
    }
    names.set(me.toBase58(), "You");
    const nameOf = (p: PublicKey) => names.get(p.toBase58()) ?? "Someone";
    const voteChoice = (inf: (typeof infos)[number]) => (inf ? inf.data[8 + 32] : undefined);

    const betViews: BetView[] = bs.map((b) => {
      const posInfo = infos[k + bs.indexOf(b)];
      const pos = posInfo ? hm.decodePosition(hm.positionPda(b.address, me), posInfo.data) : undefined;
      let payout = 0n;
      if (pos && b.outcome !== hm.OUTCOME.OPEN) {
        const [w, l] = b.outcome === hm.OUTCOME.YES ? [b.yesShares, b.noShares] : [b.noShares, b.yesShares];
        payout = w === 0n ? pos.shares : pos.side === b.outcome ? hm.winnerPayout(pos.shares, w, l) : 0n;
      }
      return {
        bet: b,
        subjectName: b.subject.equals(hm.NOBODY) ? undefined : nameOf(b.subject),
        creatorName: nameOf(b.creator),
        yesUsd: usd(b.yesShares),
        noUsd: usd(b.noShares),
        mine: pos ? { side: pos.side, usd: usd(pos.shares), claimed: pos.claimed, payoutUsd: usd(payout) } : undefined,
        myVote: voteChoice(infos[k + bs.length + bs.indexOf(b)]),
        canVote: !b.subject.equals(me),
      };
    });
    k += bs.length * 2;
    const entryVotes = new Map(entries.map((e, i) => [e.address.toBase58(), voteChoice(infos[k + i])]));
    k += entries.length;
    const goals = new Map(entries.map((e, i) => {
      const inf = infos[k + i];
      return [e.address.toBase58(), inf ? hm.decodeGoal(inf.data).goal : undefined];
    }));
    k += entries.length;
    const fees = new Map(cs.map((ch, i) => [ch.address.toBase58(), !!infos[k + i]]));

    const chViews: ChallengeView[] = cs.map((ch) => {
      const es: EntryView[] = entries
        .filter((e) => e.challenge.equals(ch.address))
        .map((e) => ({
          entry: e, name: nameOf(e.owner), isMe: e.owner.equals(me), myVote: entryVotes.get(e.address.toBase58()),
          goal: goals.get(e.address.toBase58()), stakeUsd: usd(e.shares),
        }));
      const mine = es.find((e) => e.isMe);
      let payout = 0n;
      if (mine && ch.participants > 0 && ch.decided === ch.participants) {
        payout = ch.passedShares === 0n ? mine.entry.shares : mine.entry.status === hm.ENTRY.PASSED ? hm.commitmentPayout(mine.entry.shares, ch.passedShares, ch.failedShares) : 0n;
      }
      return {
        challenge: ch,
        creatorName: nameOf(ch.creator),
        stakeUsd: hm.toUsd(ch.stake),
        potUsd: usd(es.reduce((s, e) => s + e.entry.shares, 0n)),
        entries: es,
        mine: mine ? { ...mine, payoutUsd: usd(payout), usd: usd(mine.entry.shares) } : undefined,
        feeTaken: fees.get(ch.address.toBase58()) ?? false,
        feeUsd: usd(hm.platformFee(ch.passedShares, ch.failedShares)),
        forfeitUsd: usd(ch.failedShares),
      };
    });

    const people: PersonView[] = ms
      .map((m) => ({ owner: m.owner, name: nameOf(m.owner), value: usd(m.shares), isMe: m.owner.equals(me) }))
      .sort((a, b) => b.value - a.value);
    return { crew, people, bets: betViews, challenges: chViews, isMember: ms.some((m) => m.owner.equals(me)) };
  }

  private async usdToShares(crew: PublicKey, usdAmount: number) {
    const [ci, vi] = await this.conn.getMultipleAccountsInfo([crew, hm.crewVaultPda(crew)]);
    const c = hm.decodeCrew(crew, ci!.data);
    const vault = vi ? vi.data.readBigUInt64LE(64) : 0n;
    return (hm.fromUsd(usdAmount) * (c.totalShares + 1000n)) / (vault + 1n);
  }

  setProfile(name: string) {
    return this.send([hm.setProfileIx(this.sponsor, this.owner.publicKey, name)]);
  }
  createBet(crew: PublicKey, question: string, subject: PublicKey, minutes: number) {
    const closesAt = Math.floor(Date.now() / 1000) + Math.round(minutes * 60);
    return this.send([hm.createBetIx(this.sponsor, this.owner.publicKey, crew, BigInt(Date.now()), question, subject, closesAt)]);
  }
  async placeBet(crew: PublicKey, bet: PublicKey, side: 1 | 2, usdAmount: number) {
    const shares = await this.usdToShares(crew, usdAmount);
    return this.send([hm.placeBetIx(this.sponsor, this.owner.publicKey, crew, bet, side, shares)]);
  }
  voteBet(crew: PublicKey, bet: PublicKey, choice: 1 | 2) {
    return this.send([hm.voteBetIx(this.sponsor, this.owner.publicKey, crew, bet, choice)]);
  }
  claimBet(crew: PublicKey, bet: PublicKey) {
    return this.send([hm.claimBetIx(this.owner.publicKey, crew, bet)]);
  }
  createChallenge(crew: PublicKey, title: string, stakeUsd: number, minutes: number, join: boolean) {
    const id = BigInt(Date.now());
    const endsAt = Math.floor(Date.now() / 1000) + Math.round(minutes * 60);
    const ixs = [hm.createChallengeIx(this.sponsor, this.owner.publicKey, crew, id, title, hm.fromUsd(stakeUsd), endsAt)];
    if (join) ixs.push(hm.joinChallengeIx(this.sponsor, this.owner.publicKey, crew, hm.challengePda(crew, id)));
    return this.send(ixs);
  }
  joinChallenge(crew: PublicKey, challenge: PublicKey) {
    return this.send([hm.joinChallengeIx(this.sponsor, this.owner.publicKey, crew, challenge)]);
  }
  /** Put money on your own goal. */
  joinWithGoal(crew: PublicKey, challenge: PublicKey, goal: string, stakeUsd: number) {
    return this.send([hm.joinWithGoalIx(this.sponsor, this.owner.publicKey, crew, challenge, goal, hm.fromUsd(stakeUsd))]);
  }
  /** Start a commitment round and put money on your goal in the same tap. */
  startCommitment(crew: PublicKey, title: string, minStakeUsd: number, minutes: number, goal: string, stakeUsd: number, id: bigint = BigInt(Date.now())) {
    const endsAt = Math.floor(Date.now() / 1000) + Math.round(minutes * 60);
    const ch = hm.challengePda(crew, id);
    return this.send([
      hm.createChallengeIx(this.sponsor, this.owner.publicKey, crew, id, title, hm.fromUsd(minStakeUsd), endsAt),
      hm.joinWithGoalIx(this.sponsor, this.owner.publicKey, crew, ch, goal, hm.fromUsd(stakeUsd)),
    ]);
  }
  voteEntry(crew: PublicKey, challenge: PublicKey, entryOwner: PublicKey, passed: boolean) {
    return this.send([hm.voteEntryIx(this.sponsor, this.owner.publicKey, crew, challenge, entryOwner, passed)]);
  }
  /** Collect your result. The first person to collect also moves the platform's 5% (sponsored, once). */
  claimChallenge(crew: PublicKey, challenge: PublicKey, feeTaken: boolean) {
    const ixs = feeTaken ? [] : [hm.takeFeeIx(this.sponsor, this.mint, crew, challenge)];
    ixs.push(hm.claimChallengeIx(this.owner.publicKey, crew, challenge));
    return this.send(ixs);
  }

  private async send(ixs: TransactionInstruction[]) {
    try {
      return await this.sendOnce(ixs);
    } catch (e) {
      // Whatever went wrong underneath (rate limits, offline, a rejected request), people get plain words.
      throw new Error(friendlyError(e));
    }
  }

  private async sendOnce(ixs: TransactionInstruction[]) {
    const { blockhash, lastValidBlockHeight } = await this.conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: this.sponsor, blockhash, lastValidBlockHeight }).add(...hm.priorityIxs(), ...ixs);
    const needsOwner = ixs.some((i) => i.keys.some((k) => k.isSigner && k.pubkey.equals(this.owner.publicKey)));
    if (needsOwner) await this.owner.sign(tx);
    const b64 = tx.serialize({ requireAllSignatures: false }).toString("base64");
    const { tx: signed } = await api<{ tx: string }>("/api/sponsor", { tx: b64 });
    return this.submit(signed, lastValidBlockHeight);
  }

  /** Sends a fully signed transaction from the device and waits for confirmation. */
  private async submit(b64: string, lastValidBlockHeight: number) {
    let signature: string;
    try {
      signature = await this.conn.sendRawTransaction(Buffer.from(b64, "base64"), { preflightCommitment: "confirmed" });
    } catch (e) {
      const logs = (e as { logs?: string[] }).logs ?? [];
      const msg = logs.find((l) => l.includes("Error Message:"))?.split("Error Message: ")[1];
      throw new Error(friendly(msg ?? (e as Error).message));
    }
    try {
      await hm.confirm(this.conn, signature, lastValidBlockHeight);
    } catch (e) {
      throw new Error(friendly((e as Error).message));
    }
    return signature;
  }
}
