// Offline demo state for Kept: the whole 75 second path with no backend and no network.
// Five people, $50 each. Martin and Ana keep their word, Ben, Cara and Dani do not. Ben disputes Martin's
// proof, Martin appeals, Grok Bot proposes "approved", Ana, Cara and Dani confirm (3 of 4), Martin collects
// $121.25. Everything here is simulated and says so on screen. No real money moves, nothing is uploaded.
import { FEE_PERCENT } from "../brand";
import { settle, simulatedYield, type Settlement } from "../settlement";
import { YIELD_APY_PERCENT, PLATFORM_YIELD_PERCENT } from "../brand";

export type PersonId = "martin" | "ana" | "ben" | "cara" | "dani";
export type Status = "invited" | "on_track" | "proof_sent" | "disputed" | "kept" | "missed";

export type Person = { id: PersonId; name: string; goal: string; stake: number; status: Status };

export type Stage =
  | "login"      // before sign in
  | "empty"      // signed in, no goal yet
  | "joining"    // Martin locked his goal, friends have not joined
  | "running"    // everyone is in, clock is ticking
  | "proof"      // Martin sent proof, friends are voting
  | "disputed"   // Ben disputed it
  | "appeal"     // appeal sent, the Grok Bot flow is running
  | "proposed"   // Grok Bot proposed a verdict, the group confirms
  | "resolved"   // 3 of 4 confirmed, resolved on-chain
  | "ended";     // deadline passed, results are in

export type Msg = { id: number; from: PersonId | "grok" | "system"; text: string; kind: "text" | "proof" | "vote" | "grok" | "system" };

/** 0 opened, 1 detected on-chain, 2 Grok Bot reviewing, 3 proposal ready, 4 resolved on-chain. */
export type DisputeStep = 0 | 1 | 2 | 3 | 4;

export type DemoState = {
  stage: Stage;
  email: string;
  balance: number;
  people: Person[];
  hoursLeft: number;
  coachNote: string;
  votes: { approve: PersonId[]; dispute: PersonId[] };
  confirms: PersonId[];
  /** Friends who rejected Grok's proposal (two rejections out of four mean it cannot reach 3 confirmations). */
  rejects: PersonId[];
  disputeStep: DisputeStep;
  disputeReason: string;
  proofNote: string;
  messages: Msg[];
  history: { id: number; text: string; amount: number }[];
  fundsAdded: number;
  collected: boolean;
  /** Martin's vote on Ana's proof (the vote screen). */
  myVote: "approve" | "dispute" | null;
  nextId: number;
};

export const GROUP_NAME = "Austin Runners";
export const FRIENDS: Exclude<PersonId, "martin">[] = ["ana", "ben", "cara", "dani"];
export const NAMES: Record<PersonId, string> = { martin: "Martin", ana: "Ana", ben: "Ben", cara: "Cara", dani: "Dani" };
const FRIEND_GOALS: Record<Exclude<PersonId, "martin">, string> = {
  ana: "Gym 4 times this week",
  ben: "No takeout for 7 days",
  cara: "Read 100 pages by Sunday",
  dani: "In bed before midnight, all week",
};
export const DEMO_STAKE = 50;
export const START_BALANCE = 200;
export const DEMO_DAYS = 5;

export const initial = (): DemoState => ({
  stage: "login",
  email: "",
  balance: START_BALANCE,
  people: [
    { id: "martin", name: "Martin", goal: "", stake: 0, status: "invited" },
    ...FRIENDS.map((id): Person => ({ id, name: NAMES[id], goal: FRIEND_GOALS[id], stake: 0, status: "invited" })),
  ],
  hoursLeft: 72,
  coachNote: "",
  votes: { approve: [], dispute: [] },
  confirms: [],
  rejects: [],
  disputeStep: 0,
  disputeReason: "",
  proofNote: "",
  messages: [],
  history: [{ id: 1, text: "Added with Apple Pay", amount: START_BALANCE }],
  fundsAdded: 0,
  collected: false,
  myVote: null,
  nextId: 100,
});

export type Action =
  | { type: "signIn"; email: string }
  | { type: "lockGoal"; goal: string; stake: number; coachNote: string }
  | { type: "friendJoin"; id: Exclude<PersonId, "martin"> }
  | { type: "fastForward"; hours: number }
  | { type: "submitProof"; note: string }
  | { type: "vote"; id: Exclude<PersonId, "martin">; approve: boolean }
  | { type: "appeal" }
  | { type: "disputeStep"; step: DisputeStep }
  | { type: "confirm"; id: Exclude<PersonId, "martin"> }
  | { type: "reject"; id: Exclude<PersonId, "martin"> }
  | { type: "myVote"; approve: boolean }
  | { type: "deadline" }
  | { type: "collect" }
  | { type: "addFunds"; amount: number }
  | { type: "reset" };

const person = (s: DemoState, id: PersonId) => s.people.find((p) => p.id === id)!;
const setPerson = (s: DemoState, id: PersonId, patch: Partial<Person>): Person[] => s.people.map((p) => (p.id === id ? { ...p, ...patch } : p));
const say = (s: DemoState, from: Msg["from"], text: string, kind: Msg["kind"] = "text"): Pick<DemoState, "messages" | "nextId"> => ({
  messages: [...s.messages, { id: s.nextId, from, text, kind }],
  nextId: s.nextId + 1,
});

/** People who count as having put money in and who can vote or confirm (everyone but the person being judged). */
export const voters = (s: DemoState) => s.people.filter((p) => p.stake > 0 && p.id !== "martin");
export const CONFIRMS_NEEDED = 3; // 3 of 4
/** Rejections after which the proposal can no longer reach CONFIRMS_NEEDED (4 friends). */
export const REJECTS_BLOCK = 2;

export function reducer(s: DemoState, a: Action): DemoState {
  switch (a.type) {
    case "reset":
      return initial();
    case "signIn":
      return { ...s, stage: "empty", email: a.email };
    case "lockGoal": {
      if (s.stage !== "empty") return s;
      const n: DemoState = {
        ...s,
        stage: "joining",
        balance: s.balance - a.stake,
        coachNote: a.coachNote,
        people: setPerson(s, "martin", { goal: a.goal, stake: a.stake, status: "on_track" }),
        history: [{ id: s.nextId, text: `Locked on "${a.goal}"`, amount: -a.stake }, ...s.history],
        nextId: s.nextId + 1,
      };
      return { ...n, ...say(n, "system", `Martin locked $${a.stake} on "${a.goal}". Invite the group.`, "system") };
    }
    case "friendJoin": {
      const p = person(s, a.id);
      if (p.stake > 0) return s;
      const people = setPerson(s, a.id, { stake: DEMO_STAKE, status: "on_track" });
      const joined = people.filter((x) => x.stake > 0).length;
      const allIn = joined === people.length;
      let n: DemoState = { ...s, stage: allIn ? "running" : s.stage, people };
      n = { ...n, ...say(n, a.id, `Locked $${DEMO_STAKE} on "${p.goal}".`, "system") };
      if (allIn) n = { ...n, ...say(n, "ana", "Gym session 3 of 4 done.", "proof") };
      return n;
    }
    case "fastForward":
      return { ...s, hoursLeft: Math.max(0, a.hours) };
    case "submitProof": {
      if (s.stage !== "running") return s;
      const note = a.note || "Done. 21.1 km.";
      const n: DemoState = { ...s, stage: "proof", proofNote: note, people: setPerson(s, "martin", { status: "proof_sent" }) };
      return { ...n, ...say(n, "martin", note, "proof") };
    }
    case "vote": {
      if (s.stage !== "proof") return s;
      const votes = {
        approve: a.approve ? [...s.votes.approve, a.id] : s.votes.approve,
        dispute: a.approve ? s.votes.dispute : [...s.votes.dispute, a.id],
      };
      let n: DemoState = { ...s, votes };
      n = { ...n, ...say(n, a.id, a.approve ? "Approved." : "Disputed. This does not look like 21 km.", "vote") };
      if (!a.approve) {
        n = { ...n, stage: "disputed", disputeReason: "Ben says the route looks shorter than 21 km.", people: setPerson(n, "martin", { status: "disputed" }) };
        n = { ...n, ...say(n, "system", "Dispute opened. Martin can appeal with proof.", "system") };
      }
      return n;
    }
    case "appeal":
      if (s.stage !== "disputed") return s;
      return { ...s, stage: "appeal", disputeStep: 0, ...say(s, "system", "Appeal sent. Dispute opened.", "system") };
    case "disputeStep": {
      if (s.stage !== "appeal" || a.step <= s.disputeStep) return s;
      const stage: Stage = a.step >= 3 ? "proposed" : "appeal";
      const n: DemoState = { ...s, stage, disputeStep: a.step };
      if (a.step === 1) return { ...n, ...say(n, "system", "Dispute received.", "system") };
      if (a.step === 2) return { ...n, ...say(n, "grok", "Grok Bot is reviewing the proof.", "grok") };
      if (a.step === 3) return { ...n, ...say(n, "grok", "Grok Bot proposes: Approved (92%). Distance, date and route match. Group, please confirm.", "grok") };
      return n;
    }
    case "confirm": {
      if (s.stage !== "proposed" || s.confirms.includes(a.id) || s.rejects.includes(a.id)) return s;
      const confirms = [...s.confirms, a.id];
      let n: DemoState = { ...s, confirms };
      n = { ...n, ...say(n, a.id, "Confirmed Grok's proposal.", "vote") };
      if (confirms.length >= CONFIRMS_NEEDED) {
        n = { ...n, stage: "resolved", disputeStep: 4, people: setPerson(n, "martin", { status: "on_track" }) };
        n = { ...n, ...say(n, "system", "Decision saved: Martin's proof was approved (3 of 4).", "system") };
      }
      return n;
    }
    case "reject": {
      if (s.stage !== "proposed" || s.rejects.includes(a.id) || s.confirms.includes(a.id)) return s;
      const rejects = [...s.rejects, a.id];
      let n: DemoState = { ...s, rejects };
      n = { ...n, ...say(n, a.id, "Rejected Grok's proposal.", "vote") };
      if (rejects.length >= REJECTS_BLOCK) {
        n = { ...n, stage: "resolved", disputeStep: 4, people: setPerson(n, "martin", { status: "missed" }) };
        n = { ...n, ...say(n, "system", `Decision saved: the group did not confirm Martin's proof (${rejects.length} of 4 rejected).`, "system") };
      }
      return n;
    }
    case "myVote": {
      if (s.myVote) return s;
      const n: DemoState = { ...s, myVote: a.approve ? "approve" : "dispute" };
      return { ...n, ...say(n, "martin", a.approve ? "Approved Ana's gym proof." : "Disputed Ana's gym proof.", "vote") };
    }
    case "deadline": {
      if (s.stage !== "resolved") return s;
      const people = s.people.map((p): Person => ({ ...p, status: (p.id === "martin" && s.rejects.length < REJECTS_BLOCK) || p.id === "ana" ? "kept" : "missed" }));
      const n: DemoState = { ...s, stage: "ended", hoursLeft: 0, people };
      return { ...n, ...say(n, "system", "Time is up. Results are in.", "system") };
    }
    case "collect": {
      if (s.stage !== "ended" || s.collected) return s;
      const r = results(s);
      const mine = r.payouts.find((p) => p.id === "martin")!.payout;
      return {
        ...s,
        collected: true,
        balance: s.balance + mine,
        history: [{ id: s.nextId, text: "Collected from Austin Runners", amount: mine }, ...s.history],
        nextId: s.nextId + 1,
      };
    }
    case "addFunds":
      return {
        ...s,
        balance: s.balance + a.amount,
        fundsAdded: s.fundsAdded + a.amount,
        history: [{ id: s.nextId, text: "Added with Apple Pay", amount: a.amount }, ...s.history],
        nextId: s.nextId + 1,
      };
  }
}

export const pot = (s: DemoState) => s.people.reduce((n, p) => n + p.stake, 0);
export const onTheLine = (s: DemoState) => (s.collected ? 0 : person(s, "martin").stake);

export function results(s: DemoState): Settlement {
  return settle(s.people.filter((p) => p.stake > 0).map((p) => ({ id: p.id, stake: p.stake, kept: p.status === "kept" })), FEE_PERCENT);
}
export const yieldFor = (s: DemoState) => simulatedYield(pot(s), DEMO_DAYS, YIELD_APY_PERCENT, PLATFORM_YIELD_PERCENT);

/** The next friend action for the autopilot (key D). Returns null when the next step is yours to take. */
export function nextAutopilot(s: DemoState): Action | null {
  switch (s.stage) {
    case "joining": {
      const f = FRIENDS.find((id) => person(s, id).stake === 0);
      return f ? { type: "friendJoin", id: f } : null;
    }
    case "running":
      return s.hoursLeft > 20 ? { type: "fastForward", hours: 20 } : { type: "submitProof", note: "Done. 21.1 km, Saturday morning." };
    case "proof": {
      if (!s.votes.approve.includes("ana")) return { type: "vote", id: "ana", approve: true };
      return { type: "vote", id: "ben", approve: false };
    }
    case "disputed":
      return { type: "appeal" };
    case "appeal":
      return s.disputeStep < 3 ? { type: "disputeStep", step: (s.disputeStep + 1) as DisputeStep } : null;
    case "proposed": {
      const f = (["ana", "cara", "dani", "ben"] as const).find((id) => !s.confirms.includes(id) && !s.rejects.includes(id));
      return f ? { type: "confirm", id: f } : null;
    }
    case "resolved":
      return { type: "deadline" };
    case "ended":
      return s.collected ? null : { type: "collect" };
    default:
      return null;
  }
}
