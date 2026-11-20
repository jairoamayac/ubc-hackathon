// Goal coach (mock). In production Grok turns a loose wish into a measurable goal and suggests how much
// to lock (spec section 3, Grok prompts, role 2). Here it is a small deterministic rule set so the demo
// never depends on a network call: same input, same answer.
import { STAKE_SUGGESTED_MIN } from "./brand";

export type Coaching = {
  measurable: boolean;
  /** What the person typed, trimmed. */
  original: string;
  /** A measurable rewrite, or the same text if it was already fine. */
  goal: string;
  metric: string;
  proof: string;
  /** Suggested amount to lock so it hurts a bit. */
  stake: number;
  /** One short sentence explaining the call. */
  note: string;
};

const VAGUE = /\b(be happy|happier|be better|be healthy|healthier|get fit|get in shape|more productive|be a better|improve|try to|stop procrastinating|be nicer|relax more)\b/i;

type Rule = { test: RegExp; goal: (m: RegExpMatchArray, t: string) => string; metric: string; proof: string; base: number };

const RULES: Rule[] = [
  {
    test: /\b(run|jog|marathon|5k|10k|half marathon)\b/i,
    goal: (_m, t) => (/\d/.test(t) ? t : "Run 21 km by Sunday"),
    metric: "Distance and date from a running activity",
    proof: "Screenshot of the activity with distance and date",
    base: 50,
  },
  {
    test: /\b(gym|workout|train|lift|exercise)\b/i,
    goal: (_m, t) => (/\d/.test(t) ? t : "Gym 3 times this week"),
    metric: "Check ins counted",
    proof: "Photo or screenshot of each session",
    base: 50,
  },
  {
    test: /\b(read|book|pages)\b/i,
    goal: (_m, t) => (/\d/.test(t) ? t : "Read 100 pages by Sunday"),
    metric: "Pages read",
    proof: "Photo of the page you are on, with the date",
    base: 50,
  },
  {
    test: /\b(study|exam|course|homework|thesis|write)\b/i,
    goal: (_m, t) => (/\d/.test(t) ? t : "Study 10 hours this week"),
    metric: "Hours or pages done",
    proof: "Timer screenshot or a photo of your notes",
    base: 60,
  },
  {
    test: /\b(sleep|bed|midnight|wake)\b/i,
    goal: (_m, t) => (/\d/.test(t) ? t : "In bed before midnight, 7 nights"),
    metric: "Nights on time",
    proof: "Screenshot from your sleep tracker or alarm",
    base: 50,
  },
  {
    test: /\b(takeout|delivery|fast food|sugar|alcohol|drink|smok|coffee|screen time|instagram|tiktok|phone)\b/i,
    goal: (_m, t) => (/\d/.test(t) ? t : "No takeout for 7 days"),
    metric: "Days without it",
    proof: "Screen Time or bank app screenshot",
    base: 50,
  },
  {
    test: /\b(followers|subscribers|launch|ship|publish|post)\b/i,
    goal: (_m, t) => (/\d/.test(t) ? t : "Publish 3 posts this week"),
    metric: "Public numbers on a date",
    proof: "Link or screenshot of the public page",
    base: 75,
  },
];

export function coachGoal(input: string): Coaching {
  const original = input.trim();
  if (!original) {
    return { measurable: false, original, goal: "", metric: "", proof: "", stake: STAKE_SUGGESTED_MIN, note: "Write what you want to do, in a few words." };
  }
  if (VAGUE.test(original) && !/\d/.test(original)) {
    return {
      measurable: false,
      original,
      goal: "",
      metric: "",
      proof: "",
      stake: STAKE_SUGGESTED_MIN,
      note: `"${original}" is a life goal, not a goal you can check. Try a number and a date: "Run 21 km by Sunday".`,
    };
  }
  const hasNumber = /\d/.test(original);
  const rule = RULES.find((r) => r.test.test(original));
  if (!rule) {
    return {
      measurable: hasNumber,
      original,
      goal: original,
      metric: hasNumber ? "The number in your goal" : "Add a number and a date",
      proof: "A screenshot or photo that shows it",
      stake: STAKE_SUGGESTED_MIN,
      note: hasNumber ? "It has a number, so your friends can check it." : "Add a number and a date so your friends can check it.",
    };
  }
  const m = original.match(rule.test) as RegExpMatchArray;
  const goal = rule.goal(m, original);
  const rewritten = goal !== original;
  // Harder goals ask for more: a bigger number in the text nudges the suggestion up a little.
  const nums = (goal.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const big = nums.some((n) => n >= 40);
  const stake = Math.max(STAKE_SUGGESTED_MIN, rule.base + (big ? 25 : 0));
  return {
    measurable: true,
    original,
    goal,
    metric: rule.metric,
    proof: rule.proof,
    stake,
    note: rewritten ? `Made it measurable: "${goal}".` : "Clear and checkable.",
  };
}

/** Amount check for the stake picker: returns what to tell the person, or null if it is fine. */
export function stakeAdvice(stake: number, suggested: number, warnMultiple: number): { tone: "low" | "high"; text: string } | null {
  if (stake < suggested) return { tone: "low", text: `Most people lock at least ${fmt(suggested)} so it really hurts to lose it.` };
  if (stake > suggested * warnMultiple) return { tone: "high", text: `That is more than ${warnMultiple} times what we suggest. Are you sure you want to put ${fmt(stake)} on this?` };
  return null;
}

const fmt = (n: number) => `$${n}`;
