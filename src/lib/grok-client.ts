// Browser side of the Grok Bot appeals council: start an appeal, poll for the verdict, shrink the screenshot.
import type { AppealRequest, DisputeView, VerificationView, VerifyRequest } from "./grok";

export class AppealError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new AppealError("Could not reach the server.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AppealError(data.error ?? `Request failed (${res.status}).`, res.status);
  return data;
}

export const startAppeal = (req: AppealRequest) => call<{ dispute_id: string; status: "pending" }>("/api/appeal", { method: "POST", body: JSON.stringify(req) });
export const getDispute = (id: string) => call<DisputeView>(`/api/disputes/${encodeURIComponent(id)}`);

export const startVerification = (req: VerifyRequest) => call<{ verification_id: string; status: "pending" }>("/api/verify", { method: "POST", body: JSON.stringify(req) });
export const getVerification = (id: string) => call<VerificationView>(`/api/verifications/${encodeURIComponent(id)}`);

/** Resizes a screenshot to at most 1280 px and re-encodes it as a jpeg, so it stays well under the Worker's limit. */
export async function shrinkImage(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  for (const q of [0.82, 0.65, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length * 0.75 < 600_000) return url;
  }
  throw new Error("The screenshot is too large.");
}
