// The account owner as the client sees it: a public key plus a way to add the owner's signature to a
// transaction. The fee payer (the sponsor) signs later, in the Worker. Two implementations:
//  - localSigner: a key kept on this device (demo fallback when Privy is not configured)
//  - PrivySignerAdapter (components/auth/PrivyGate.tsx): the Privy embedded Solana account
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";

export interface OwnerSigner {
  publicKey: PublicKey;
  /** Adds the owner's signature to `tx` in place. Other signers (the sponsor) may still be missing. */
  sign(tx: Transaction): Promise<void>;
}

export function keypairSigner(kp: Keypair): OwnerSigner & { keypair: Keypair } {
  return {
    keypair: kp,
    publicKey: kp.publicKey,
    async sign(tx) {
      tx.partialSign(kp);
    },
  };
}

/**
 * Takes the owner's signature out of what a remote signer returned and checks the signed message is
 * exactly the one we sent, so a signer can never swap instructions or the fee payer.
 * Accepts a full serialized transaction, or a bare 64-byte signature (some signers return only that).
 */
export function ownerSignatureFrom(returned: Uint8Array, sent: Transaction, owner: PublicKey): Buffer {
  if (returned.length === 64) return Buffer.from(returned);
  const back = Transaction.from(returned);
  if (!Buffer.from(back.serializeMessage()).equals(Buffer.from(sent.serializeMessage()))) {
    throw new Error("The signed request doesn't match. Please try again.");
  }
  const sig = back.signatures.find((s) => s.publicKey.equals(owner))?.signature;
  if (!sig) throw new Error("Couldn't sign that. Please try again.");
  return Buffer.from(sig);
}
