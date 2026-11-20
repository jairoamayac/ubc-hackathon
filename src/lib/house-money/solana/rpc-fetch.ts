// A polite fetch for the public RPC. The browser used to hammer it (~175 requests a minute from one idle tab,
// ~95% answered 429), so every read now goes through here:
//  - at most a few requests in flight at once,
//  - identical in-flight reads share one request,
//  - on 429 (or a network blip) everyone waits out a shared cooldown that grows with each strike
//    (exponential, with jitter), then retries a bounded number of times.
// Pair it with `disableRetryOnRateLimit: true` so web3.js does not stack its own retries on top.

const MAX_IN_FLIGHT = 3;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 700;
const MAX_DELAY_MS = 10_000;
/** Never share these between callers: each one is a distinct write. */
const NO_DEDUPE = new Set(["sendTransaction", "simulateTransaction"]);

type Settled = { status: number; statusText: string; headers: [string, string][]; text: string };

export function createRpcFetch(base: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  let active = 0;
  const waiting: (() => void)[] = [];
  let cooldownUntil = 0;
  let strikes = 0;
  const shared = new Map<string, Promise<Settled>>();

  const acquire = () =>
    active < MAX_IN_FLIGHT
      ? (active++, Promise.resolve())
      : new Promise<void>((resolve) => waiting.push(() => { active++; resolve(); }));
  const release = () => {
    active--;
    waiting.shift()?.();
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const penalize = () => {
    strikes = Math.min(strikes + 1, 6);
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (strikes - 1)) * (0.75 + Math.random() * 0.5);
    cooldownUntil = Math.max(cooldownUntil, Date.now() + delay);
  };

  async function attempt(input: RequestInfo | URL, init?: RequestInit): Promise<Settled> {
    let last: Settled | undefined;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const wait = cooldownUntil - Date.now();
      if (wait > 0) await sleep(wait);
      await acquire();
      try {
        const res = await base(input, init);
        if (res.status === 429 || res.status === 503) {
          last = { status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], text: await res.text() };
          penalize();
          continue;
        }
        strikes = Math.max(0, strikes - 1);
        return { status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], text: await res.text() };
      } catch (e) {
        // Offline or a blocked response (browsers hide 429s that lack CORS headers): same treatment.
        if (i === MAX_ATTEMPTS - 1) throw e;
        penalize();
      } finally {
        release();
      }
    }
    return last!;
  }

  const respond = (s: Settled, id: unknown) => {
    let text = s.text;
    if (id !== undefined) {
      try {
        const body = JSON.parse(text);
        if (body && !Array.isArray(body)) text = JSON.stringify({ ...body, id });
      } catch {
        /* not JSON: pass through */
      }
    }
    return new Response(text, { status: s.status, statusText: s.statusText, headers: s.headers });
  };

  return async (input, init) => {
    let key: string | undefined;
    let id: unknown;
    if (typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        if (body && !Array.isArray(body) && !NO_DEDUPE.has(body.method)) {
          id = body.id;
          const { id: _id, ...rest } = body; // eslint-disable-line @typescript-eslint/no-unused-vars
          key = `${String(input)}|${JSON.stringify(rest)}`;
        }
      } catch {
        /* not JSON-RPC: no sharing */
      }
    }
    if (!key) return respond(await attempt(input, init), undefined);
    let p = shared.get(key);
    if (!p) {
      p = attempt(input, init).finally(() => shared.delete(key!));
      shared.set(key, p);
    }
    return respond(await p, id);
  };
}
