// Makes the seeded friends of a demo crew act: vote on closed bets and judge finished challenges,
// following a script (VOTE=yes|no for bets; FAIL=<name> marks who skipped the challenge). Also claims for them.
//   RPC_URL=... node scripts/demo-act.mts <crewAddress>
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "node:fs";
import { loadOrCreate } from "./keys.mjs";
import * as hm from "../src/lib/house-money/solana/hm.ts";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const conn = new Connection(RPC, "confirmed");
const cluster = RPC.includes("127.0.0.1") || RPC.includes("localhost") ? "local" : "devnet";
const sponsor = loadOrCreate("sponsor");
const crew = new PublicKey(process.argv[2]);
const saved = JSON.parse(fs.readFileSync(new URL(`../keys/demo-${cluster}.json`, import.meta.url), "utf8"))[crew.toBase58()];
const friends = Object.entries(saved.friends as Record<string, number[]>).map(([n, sk]) => [n, Keypair.fromSecretKey(Uint8Array.from(sk))] as const);
const MINT = new PublicKey(JSON.parse(fs.readFileSync(new URL(`../keys/${cluster}.json`, import.meta.url), "utf8")).mint);
const VOTE = (process.env.VOTE ?? "yes") === "yes" ? 1 : 2;
const FAIL = (process.env.FAIL ?? "Josh").split(",");

async function send(ixs: TransactionInstruction[], signers: Keypair[]) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: sponsor.publicKey, blockhash, lastValidBlockHeight }).add(...hm.priorityIxs(), ...ixs);
  tx.sign(sponsor, ...signers);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await hm.confirm(conn, sig, lastValidBlockHeight);
}
const tryDo = async (label: string, ixs: TransactionInstruction[], s: Keypair[]) => {
  try { await send(ixs, s); console.log(`  ✓ ${label}`); } catch (e) { console.log(`  · ${label}: ${String((e as Error).message).slice(0, 80)}`); }
};
const filter = (disc: readonly number[]) => [hm.discFilter(disc, bs58.encode), { memcmp: { offset: 8, bytes: crew.toBase58() } }];
const now = Math.floor(Date.now() / 1000);

const bets = (await conn.getProgramAccounts(hm.PROGRAM_ID, { filters: filter(hm.SOCIAL_ACCOUNT_DISC.Bet) })).map((a) => hm.decodeBet(a.pubkey, a.account.data));
for (const b of bets.filter((x) => x.outcome === hm.OUTCOME.OPEN && now >= x.closesAt)) {
  for (const [n, kp] of friends) {
    if (kp.publicKey.equals(b.subject)) continue;
    if (await conn.getAccountInfo(hm.votePda(b.address, kp.publicKey))) continue;
    await tryDo(`${n} votes ${VOTE === 1 ? "YES" : "NO"} on "${b.question}"`, [hm.voteBetIx(sponsor.publicKey, kp.publicKey, crew, b.address, VOTE as 1 | 2)], [kp]);
  }
}
const chs = (await conn.getProgramAccounts(hm.PROGRAM_ID, { filters: filter(hm.SOCIAL_ACCOUNT_DISC.Challenge) })).map((a) => hm.decodeChallenge(a.pubkey, a.account.data));
// JOIN=1: friends lock money on their own goals in any open pact they're not in yet
if (process.env.JOIN) {
  const ideas = ["Gym 3 times this week", "No takeout for 7 days", "Read 50 pages", "In bed before midnight"];
  for (const ch of chs.filter((c) => now < c.endsAt)) {
    for (const [i, [n, kp]] of friends.entries()) {
      if (await conn.getAccountInfo(hm.entryPda(ch.address, kp.publicKey))) continue;
      const stake = ch.stake > hm.fromUsd(10) ? ch.stake : hm.fromUsd(10);
      await tryDo(`${n} locks $${hm.toUsd(stake)} on "${ideas[i % ideas.length]}"`, [hm.joinWithGoalIx(sponsor.publicKey, kp.publicKey, crew, ch.address, ideas[i % ideas.length], stake)], [kp]);
    }
  }
}
for (const ch of chs.filter((c) => now >= c.endsAt)) {
  const entries = (await conn.getProgramAccounts(hm.PROGRAM_ID, {
    filters: [hm.discFilter(hm.SOCIAL_ACCOUNT_DISC.Entry, bs58.encode), { memcmp: { offset: 8, bytes: ch.address.toBase58() } }],
  })).map((a) => hm.decodeEntry(a.pubkey, a.account.data));
  for (const e of entries.filter((x) => x.status === hm.ENTRY.PENDING)) {
    const who = friends.find(([, kp]) => kp.publicKey.equals(e.owner))?.[0] ?? "you";
    const passed = !FAIL.includes(who);
    for (const [n, kp] of friends) {
      if (kp.publicKey.equals(e.owner)) continue;
      if (!(await conn.getAccountInfo(hm.entryPda(ch.address, kp.publicKey)))) continue; // only people with money in confirm
      if (await conn.getAccountInfo(hm.votePda(e.address, kp.publicKey))) continue;
      await tryDo(`${n} says ${who} ${passed ? "did it" : "didn't"} ("${ch.title}")`, [hm.voteEntryIx(sponsor.publicKey, kp.publicKey, crew, ch.address, e.owner, passed)], [kp]);
    }
  }
}
// Claims for the friends (the human claims in the app)
for (const b of bets) {
  for (const [n, kp] of friends) {
    const pos = await conn.getAccountInfo(hm.positionPda(b.address, kp.publicKey));
    if (pos && !hm.decodePosition(hm.positionPda(b.address, kp.publicKey), pos.data).claimed) await tryDo(`${n} collects "${b.question}"`, [hm.claimBetIx(kp.publicKey, crew, b.address)], [kp]);
  }
}
for (const ch of chs) {
  const fresh = hm.decodeChallenge(ch.address, (await conn.getAccountInfo(ch.address))!.data);
  if (fresh.participants > 0 && fresh.decided === fresh.participants && !(await conn.getAccountInfo(hm.feePda(ch.address)))) {
    await tryDo(`platform takes its 5% of "${ch.title}"`, [hm.takeFeeIx(sponsor.publicKey, saved.mint ? new PublicKey(saved.mint) : MINT, crew, ch.address)], []);
  }
  for (const [n, kp] of friends) {
    const en = await conn.getAccountInfo(hm.entryPda(ch.address, kp.publicKey));
    if (en && !hm.decodeEntry(hm.entryPda(ch.address, kp.publicKey), en.data).claimed) await tryDo(`${n} collects "${ch.title}"`, [hm.claimChallengeIx(kp.publicKey, crew, ch.address)], [kp]);
  }
}
