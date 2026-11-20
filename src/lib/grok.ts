// Shared types for the Grok Bot appeals council ("Kept Judge"), used by the Worker and by the app.
// The council only PROPOSES a verdict. Our backend signs the on-chain resolve, and this code never moves funds.

export const VERDICTS = ["KEPT", "MISSED", "NEEDS_MORE_EVIDENCE"] as const;
export type VerdictKind = (typeof VERDICTS)[number];
export const isVerdict = (v: unknown): v is VerdictKind => typeof v === "string" && (VERDICTS as readonly string[]).includes(v);

export interface Juror {
  juror: string;
  /** What this juror looks at: "criterion", "fraud" or "fairness". */
  lens: string;
  vote: VerdictKind;
  confidence: number;
  reason: string;
  /** True when the juror voted with the final verdict (in production, coherent jurors earn the incoherent jurors' stake, as in Kleros). */
  coherent: boolean;
}

export interface Tally {
  KEPT: number;
  MISSED: number;
  NEEDS_MORE_EVIDENCE: number;
}

/** What the browser sends to POST /api/appeal. The Worker adds the dispute id, the callback and the token. */
export interface AppealRequest {
  challenge: string;
  member: string;
  disputer?: string;
  goal: string;
  criterion?: string;
  deadline?: string;
  dispute_reason?: string;
  member_reply?: string;
  chat_excerpt?: string;
  proof?: { description?: string };
  /** Optional screenshot as a small data URL (jpeg, png or webp, up to about 700 KB). The Worker serves it back to the Bot by link. */
  image_data_url?: string;
}

export type DisputeStatus = "pending" | "decided" | "failed";

/** What GET /api/disputes/:id returns. */
export interface DisputeView {
  dispute_id: string;
  status: DisputeStatus;
  created_at: number;
  decided_at?: number;
  error?: string;
  verdict?: VerdictKind;
  confidence?: number;
  reasons?: string[];
  evidence_requested?: string | null;
  council?: Juror[];
  tally?: Tally;
}

export type VerifyVerdict = "KEPT" | "MISSED" | "CANNOT_VERIFY";
export interface VerifyRequest { member: string; goal: string; criterion: string; deadline?: string; source: string }
export interface VerificationView {
  verification_id: string;
  status: DisputeStatus;
  created_at: number;
  decided_at?: number;
  error?: string;
  verdict?: VerifyVerdict;
  observed?: string;
  checked_at?: string;
  source?: string;
  reason?: string;
}

export interface CoachResult {
  goal: string; criterion: string; deadline: string; proof_method: string;
  verifiable_by: "friends" | "public_data"; suggested_stake_usd: number | null; stake_reason: string; tips: string[];
}
export interface GroupMessage { to: string; text: string }
export interface GroupMember { name: string; goal: string; deadline?: string; status?: string; last_proof_at?: string | null }
export interface JobView<T> { job_id: string; kind: "coach" | "group"; status: DisputeStatus; created_at: number; decided_at?: number; error?: string; result?: T }
