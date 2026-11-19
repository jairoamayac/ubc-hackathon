// Live client: talks to the house_money program on Solana (devnet) through the app's edge API.
// People never see keys, SOL or signatures: the account key is created on the device and every
// fee is paid by the sponsor (/api/sponsor). In production the key would live in Privy.
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";
import { Buffer } from "buffer";
import * as hm from "./hm";

export interface AppConfig { rpc: string; mint: string; sponsor: string; programId: string }

export interface CrewView extends hm.CrewAccount {
  vault: number; // dollars in the pot now
  growthPct: number; // yield paid / principal
  yieldPerDay: number; // at the current (demo) rate
  me?: { value: number; principal: number; playable: number; member: hm.MemberAccount };
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

const KEY = "hm.account.v1";

// Duplicate demo crews left on devnet by interrupted seed runs. Crews cannot be deleted on-chain,
// so the app hides them (their funds stay in their vaults).
const HIDDEN_CREWS = new Set([
  "4Q75qQMSECw5gZFKLVrQBDhT2gEBhfuxNMZ5uxfXQRH4",
  "CSWd2WW5HsqMDemMKvisVisUJ9Ad6Q3A3gdghLwRkegL",
  "GZVEhfyhC7b6T9vqucn9XiAekmsXWzfegvVqxVySWzaq",
  "AgxFcepgNhbDUDtwdzgATXzZgcTbrEpWJm5y5HeXbNn2", // e2e run before test crews were prefixed
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

function friendly(msg: string) {
  if (msg.includes("PrincipalIsProtected")) return "Only what your crew earned can be played. Your savings are protected.";
  if (msg.includes("CallNotExpired")) return "Your call is still running.";
  if (msg.includes("CallOpen")) return "Finish your open call first.";
  if (msg.includes("insufficient funds")) return "Not enough cash. Add money first.";
  return msg;
}

export class LiveClient {
  readonly owner: Keypair;
  private conn: Connection;
  readonly mint: PublicKey;
  private sponsor: PublicKey;

  private constructor(cfg: AppConfig) {
    this.owner = loadAccount();
    this.conn = new Connection(cfg.rpc, "confirmed");
    this.mint = new PublicKey(cfg.mint);
    this.sponsor = new PublicKey(cfg.sponsor);
  }

  static async connect() {
    return new LiveClient(await api<AppConfig>("/api/config"));
  }

  /** One round of reads: cash, every crew (for the leaderboard), my memberships, my open call, SOL price. */
  async snapshot(): Promise<Snapshot> {
    const me = this.owner.publicKey;
    const ata = getAssociatedTokenAddressSync(this.mint, me);
    const [crewAccs, memberAccs, infos] = await Promise.all([
      this.conn.getProgramAccounts(hm.PROGRAM_ID, { filters: [hm.discFilter(hm.ACCOUNT_DISC.Crew, bs58.encode)] }),
      this.conn.getProgramAccounts(hm.PROGRAM_ID, {
        filters: [hm.discFilter(hm.ACCOUNT_DISC.Member, bs58.encode), { memcmp: { offset: 40, bytes: me.toBase58() } }],
      }),
      this.conn.getMultipleAccountsInfo([ata, hm.configPda(), hm.SOL_USD_FEED]),
    ]);
    const cash = infos[0] ? Number(infos[0].data.readBigUInt64LE(64)) / 1e6 : 0;
    const config = hm.decodeConfig(infos[1]!.data);
    const pyth = hm.decodePythPrice(infos[2]!.data);

    const crews = crewAccs
      .filter((a) => !HIDDEN_CREWS.has(a.pubkey.toBase58()))
      .map((a) => hm.decodeCrew(a.pubkey, a.account.data))
      .filter((c) => !c.name.startsWith("[test]")); // crews created by scripts/e2e.mts
    const vaults = await this.conn.getMultipleAccountsInfo(crews.map((c) => hm.crewVaultPda(c.address)));
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
      };
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
    const { blockhash, lastValidBlockHeight } = await this.conn.getLatestBlockhash("confirmed");
    const { tx } = await api<{ tx: string }>("/api/topup", { owner: this.owner.publicKey.toBase58(), amount: usd, blockhash });
    return this.submit(tx, lastValidBlockHeight);
  }

  createCrew(name: string, emoji: string) {
    const id = BigInt(Date.now());
    return this.send([hm.createCrewIx(this.sponsor, this.owner.publicKey, this.mint, id, name, emoji)]);
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

  private async send(ixs: TransactionInstruction[]) {
    const { blockhash, lastValidBlockHeight } = await this.conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: this.sponsor, blockhash, lastValidBlockHeight }).add(...hm.priorityIxs(), ...ixs);
    const needsOwner = ixs.some((i) => i.keys.some((k) => k.isSigner && k.pubkey.equals(this.owner.publicKey)));
    if (needsOwner) tx.partialSign(this.owner);
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
