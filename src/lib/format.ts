/** Dollars for display: $1,234.56 (with an optional +/− sign). */
export const usd = (n: number, opts: { sign?: boolean } = {}) => {
  const s = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (!opts.sign) return n < 0 ? `−${s}` : s;
  return n >= 0 ? `+${s}` : `−${s}`;
};
