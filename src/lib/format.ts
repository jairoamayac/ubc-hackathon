/** Dollars for display: $1,234.56 (with an optional +/− sign). */
export const usd = (n: number, opts: { sign?: boolean } = {}) => {
  const s = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (!opts.sign) return n < 0 ? `−${s}` : s;
  return n >= 0 ? `+${s}` : `−${s}`;
};

/** The program stores a goal in at most 80 bytes (UTF-8: an accented letter takes 2). Cut at a word when we must. */
export const GOAL_MAX_BYTES = 80;
export function fitGoal(text: string, max = GOAL_MAX_BYTES): string {
  const enc = new TextEncoder();
  const t = text.replace(/\s+/g, " ");
  if (enc.encode(t).length <= max) return t;
  let out = "";
  for (const ch of t) {
    if (enc.encode(out + ch).length > max) break;
    out += ch;
  }
  const cut = out.lastIndexOf(" ");
  out = cut > max / 2 ? out.slice(0, cut) : out;
  // Drop a parenthesis the cut left open: "... seguidos (21 nov, 28 nov" -> "... seguidos".
  const open = out.lastIndexOf("(");
  if (open > max / 2 && out.indexOf(")", open) === -1) out = out.slice(0, open);
  // Nor a dangling connector: "... a las 23:59 y" -> "... a las 23:59".
  let prev = "";
  while (prev !== out) { prev = out; out = out.replace(/[\s,;:.(-]+$/, "").replace(/\s+(y|e|o|u|de|del|a|al|en|con|para|por|and|or|to|of|the|by)$/i, ""); }
  return out;
}
