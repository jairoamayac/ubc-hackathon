// End to end through the real app stack: the app's own LiveClient (src/lib/house-money/solana/live.ts)
// talking to the Kept Worker (/api/config, /api/topup, /api/sponsor) and the chain behind it.
// Three friends, each with a fresh device key and no SOL, run a whole pact with money in Kamino.
//   APP_URL=http://localhost:8788 npx jiti scripts/app-e2e.mts
// The Worker decides the cluster (RPC_URL, MINT, KAMINO_* vars), so this runs against local or devnet.
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";

const APP = (process.env.APP_URL ?? "http://localhost:8788").replace(/\/$/, "");
const ROUND_SECS = Number(process.env.ROUND_SECS ?? 40);

// The app runs in a browser: give it a per-person localStorage and a fetch that knows the app's origin.
let store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(typeof input === "string" && input.startsWith("/") ? APP + input : input, init)) as typeof fetch;

const live = await import("../src/lib/house-money/solana/live.ts");
const hm = await import("../src/lib/house-money/solana/hm.ts");
type Client = Awaited<ReturnType<typeof live.LiveClient.connect>>;

let step = 0;
const ok = (msg: string) => console.log(`  ✓ ${++step}. ${msg}`);
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exit(1);
  }
}
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;
const $ = (n: number) => `$${n.toFixed(4)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = (await (await realFetch(`${APP}/api/config`)).json()) as { rpc: string; mint: string; kamino: { reserve: string } | null };
const conn = new Connection(cfg.rpc, "confirmed");
console.log(`Kept app e2e via ${APP}  (rpc ${cfg.rpc}, program ${hm.PROGRAM_ID.toBase58()}, Kamino ${cfg.kamino ? cfg.kamino.reserve : "off"})`);

/** A person on their own phone: a fresh key in their own storage. */
async function person(name: string): Promise<{ name: string; c: Client; storage: Map<string, string> }> {
  store = new Map();
  const c = await live.LiveClient.connect();
  return { name, c, storage: store };
}
const as = <T,>(p: { storage: Map<string, string> }, f: () => Promise<T>) => {
  store = p.storage;
  return f();
};
const cash = async (p: { c: Client }) => (await p.c.snapshot()).cash;
const pot = async (crew: PublicKey) => {
  const [ci, vi] = await conn.getMultipleAccountsInfo([crew, hm.crewVaultPda(crew)]);
  const k = hm.decodeCrewKamino(ci!.data);
  return { vault: vi ? hm.toUsd(vi.data.readBigUInt64LE(64)) : 0, kamino: hm.toUsd(k.principal), ctokens: k.ctokens };
};

// 1. Three people open the app and add money with (simulated) Apple Pay. Nobody holds SOL.
const maria = await person("Maria");
const leo = await person("Leo");
const sam = await person("Sam");
for (const p of [maria, leo, sam]) await as(p, () => p.c.topUp(30));
for (const p of [maria, leo, sam]) {
  assert(near(await cash(p), 30, 0.000001), `${p.name} has $30`);
  assert((await conn.getBalance(p.c.owner.publicKey)) === 0, `${p.name} holds no SOL`);
}
ok("Maria, Leo and Sam topped up $30 each through /api/topup; none of them holds SOL");

// 2. Maria creates a group; everyone puts $25 in (Leo and Sam join through the invite link).
const crewId = BigInt(Date.now());
await as(maria, () => maria.c.createCrew("[test] app e2e", "", crewId));
const crew = maria.c.crewAddress(crewId);
await as(maria, () => maria.c.deposit(crew, 25, true));
await as(leo, () => leo.c.deposit(crew, 25, false));
await as(sam, () => sam.c.deposit(crew, 25, false));
const p2 = await pot(crew);
assert(near(p2.vault + p2.kamino, 75, 0.00001), `pot holds $75 (${JSON.stringify(p2, (_k, v) => (typeof v === "bigint" ? String(v) : v))})`);
ok(`group ${crew.toBase58()} holds ${$(p2.vault + p2.kamino)}`);

// 3. Maria starts a round with her goal; Leo and Sam add theirs. Locked money goes to Kamino.
await as(maria, () => maria.c.startCommitment(crew, "This week", 5, ROUND_SECS / 60, "Run 21 km by Sunday", 20));
let detail = await as(maria, () => maria.c.crewDetail(crew));
const ch = detail.challenges[0].challenge.address;
await as(leo, () => leo.c.joinWithGoal(crew, ch, "Gym 3 times", 20));
await as(sam, () => sam.c.joinWithGoal(crew, ch, "No takeout for 7 days", 10));
const p3 = await pot(crew);
if (cfg.kamino) {
  assert(p3.vault === 0 && p3.ctokens > 0n, `the whole pot is in Kamino (${JSON.stringify(p3, (_k, v) => (typeof v === "bigint" ? String(v) : v))})`);
  ok(`3 goals locked ($20, $20, $10); the whole ${$(p3.kamino)} pot is lent on Kamino, the vault is empty`);
} else ok("3 goals locked ($20, $20, $10); Kamino is off");

// 4. Wait for the deadline, then the friends verify each other (Leo walked away).
detail = await as(maria, () => maria.c.crewDetail(crew));
const endsAt = detail.challenges[0].challenge.endsAt;
const waitMs = Math.max(0, endsAt * 1000 - Date.now()) + 3000;
console.log(`    waiting ${Math.round(waitMs / 1000)}s for the deadline (money earns interest meanwhile)...`);
await sleep(waitMs);
await as(maria, () => maria.c.voteEntry(crew, ch, leo.c.owner.publicKey, false));
await as(sam, () => sam.c.voteEntry(crew, ch, leo.c.owner.publicKey, false));
await as(leo, () => leo.c.voteEntry(crew, ch, maria.c.owner.publicKey, true));
await as(sam, () => sam.c.voteEntry(crew, ch, maria.c.owner.publicKey, true));
await as(maria, () => maria.c.voteEntry(crew, ch, sam.c.owner.publicKey, true));
await as(leo, () => leo.c.voteEntry(crew, ch, sam.c.owner.publicKey, true));
detail = await as(maria, () => maria.c.crewDetail(crew));
const st = Object.fromEntries(detail.challenges[0].entries.map((e) => [e.name || e.entry.owner.toBase58().slice(0, 4), e.entry.status]));
const byOwner = (o: PublicKey) => detail.challenges[0].entries.find((e) => e.entry.owner.equals(o))!.entry.status;
assert(byOwner(maria.c.owner.publicKey) === hm.ENTRY.PASSED && byOwner(sam.c.owner.publicKey) === hm.ENTRY.PASSED, `Maria and Sam passed (${JSON.stringify(st)})`);
assert(byOwner(leo.c.owner.publicKey) === hm.ENTRY.FAILED, "Leo failed");
ok("friends verified: Maria ✓, Sam ✓, Leo ✗ (each decided by the other two)");

// 5. Everyone collects. The first claim also moves the 5% fee (needs the pot back from Kamino, then re-lends it).
const treasury = hm.houseVaultPda();
const t0 = (await getAccount(conn, treasury)).amount;
for (const p of [maria, sam, leo]) {
  const v = (await as(p, () => p.c.crewDetail(crew))).challenges[0];
  await as(p, () => p.c.finalizeAndClaim(crew, v));
}
const fee = hm.toUsd((await getAccount(conn, treasury)).amount - t0);
assert(near(fee, 1, 0.0001), `fee is $1 (5% of Leo's $20), got ${fee}`);
const p5 = await pot(crew);
if (cfg.kamino) assert(p5.vault === 0 && p5.ctokens > 0n, "after the fee the pot went straight back to Kamino");
ok(`everyone collected; ${$(fee)} fee to Kept exactly once; the pot is back on Kamino (${$(p5.kamino)})`);

// 6. Everyone takes everything out. Each withdrawal brings the pot home, pays, and re-lends the rest.
for (const p of [maria, sam, leo]) {
  // Test groups ("[test]" names) are hidden from the app's lists, so build the view the Withdraw sheet would pass.
  const mAddr = hm.memberPda(crew, p.c.owner.publicKey);
  const member = hm.decodeMember(mAddr, (await conn.getAccountInfo(mAddr))!.data);
  const view = { address: crew, me: { member, value: 0, principal: 0, playable: 0 } } as unknown as Parameters<Client["withdraw"]>[0];
  await as(p, () => p.c.withdraw(view, "all"));
}
const [m, s, l] = [await cash(maria), await cash(sam), await cash(leo)];
// Maria: $5 never locked + $20 back + 95% of Leo's $20 × 20/30. Sam: $15 + $10 + 95% × 20 × 10/30. Leo: $5.
const em = 30 - 20 + 20 + 0.95 * 20 * (20 / 30);
const es = 30 - 10 + 10 + 0.95 * 20 * (10 / 30);
assert(m >= em - 0.001 && near(m, em), `Maria ends with ${$(m)} (expected ${$(em)} plus interest)`);
assert(s >= es - 0.001 && near(s, es), `Sam ends with ${$(s)} (expected ${$(es)} plus interest)`);
assert(near(l, 10, 0.001), `Leo ends with ${$(l)} (expected $10)`);
const left = await pot(crew);
const interest = m + s + l - (em + es + 10);
ok(`withdrawals: Maria ${$(m)}, Sam ${$(s)}, Leo ${$(l)}; Kamino interest earned $${interest.toFixed(6)}; left in pot ${$(left.vault + left.kamino)}`);
console.log(`\nAll ${step} app checks passed (${cfg.rpc}).`);
