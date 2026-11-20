// Reads a disputed pact from the chain so the Grok council gets the real case file (goal, deadline, stake, votes),
// not just "a dispute was opened". Used by the QuickNode Stream route, which only knows the addresses in the log.
import { PublicKey } from "@solana/web3.js";
import * as hm from "../src/lib/house-money/solana/hm";

const REASONS: Record<number, string> = {
  [hm.DISPUTE_REASON.OTHER]: "A friend in the pact contested this result.",
  [hm.DISPUTE_REASON.PROOF]: "A friend says the proof does not show what it claims.",
  [hm.DISPUTE_REASON.APPEAL]: "The member appeals: they say they kept their goal and the group marked it as missed.",
  [hm.DISPUTE_REASON.FALSE_PASS]: "A friend says the group marked this goal as kept and it was not.",
};
const STATUS: Record<number, string> = { 0: "not decided yet", 1: "kept", 2: "missed", 3: "refunded (no majority)" };

export interface PactCase {
  goal: string;
  criterion: string;
  deadline: string;
  dispute_reason: string;
  member: string;
  disputer: string;
  chat_excerpt: string;
  proof: { description: string };
}

async function accounts(rpc: string, keys: PublicKey[]): Promise<(Uint8Array | null)[]> {
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [keys.map((k) => k.toBase58()), { encoding: "base64", commitment: "confirmed" }] }),
    signal: AbortSignal.timeout(8_000),
  });
  const out = (await r.json()) as { result?: { value: ({ data: [string, string] } | null)[] } };
  if (!out.result) throw new Error("RPC error");
  return out.result.value.map((v) => (v ? Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0)) : null));
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/** The case file for one on-chain dispute, or null if the pact can't be read (the caller falls back to the bare event). */
export async function readPactCase(rpc: string, ev: { challenge: string; member: string; disputer: string; reason: number }): Promise<PactCase | null> {
  try {
    const ch = new PublicKey(ev.challenge), member = new PublicKey(ev.member), disputer = new PublicKey(ev.disputer);
    const entry = hm.entryPda(ch, member);
    const [chD, enD, goalD, mP, dP] = await accounts(rpc, [ch, entry, hm.goalPda(entry), hm.profilePda(member), hm.profilePda(disputer)]);
    if (!chD || !enD) return null;
    const c = hm.decodeChallenge(ch, chD);
    const e = hm.decodeEntry(entry, enD);
    const name = (d: Uint8Array | null, k: PublicKey, fallback: string) => {
      try { return d ? hm.decodeProfile(hm.profilePda(k), d).name : fallback; } catch { return fallback; }
    };
    const memberName = name(mP, member, "the member");
    const disputerName = member.equals(disputer) ? memberName : name(dP, disputer, "a friend in the pact");
    const goal = goalD ? hm.decodeGoal(goalD).goal : c.title;

    // What the member's stake is worth now: shares at the pot's price (vault + what the pot lent to Kamino).
    let stake = "";
    try {
      const [crewD, vaultD] = await accounts(rpc, [c.crew, hm.crewVaultPda(c.crew)]);
      if (crewD) {
        const crew = hm.decodeCrew(c.crew, crewD);
        const vault = (vaultD ? new DataView(vaultD.buffer, vaultD.byteOffset).getBigUint64(64, true) : 0n) + crew.kaminoPrincipal;
        stake = usd(hm.toUsd(hm.assetsForShares(e.shares, crew.totalShares, vault)));
      }
    } catch { /* keep the case without the amount */ }

    const deadline = new Date(c.endsAt * 1000).toISOString();
    const others = Math.max(0, c.participants - 1);
    return {
      goal,
      criterion: `The goal above, done by the deadline (${deadline}). Kept if a strict majority of the other ${others} participant(s) confirm it; nobody votes on their own goal.`,
      deadline,
      dispute_reason: `${REASONS[ev.reason] ?? REASONS[0]} Opened by ${disputerName}.`,
      member: memberName,
      disputer: disputerName,
      chat_excerpt: [
        `Pact "${c.title}" with ${c.participants} participant(s); minimum stake ${usd(hm.toUsd(c.stake))}.`,
        stake ? `${memberName} has ${stake} on this goal.` : "",
        `Votes on ${memberName}'s goal so far: ${e.passVotes} kept, ${e.failVotes} missed (status: ${STATUS[e.status] ?? "unknown"}).`,
        e.claimed ? "The result was already collected." : "",
      ].filter(Boolean).join(" "),
      proof: { description: "No proof is stored on-chain. Ask the member for a dated screenshot or a public link before deciding." },
    };
  } catch {
    return null;
  }
}
