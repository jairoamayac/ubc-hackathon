// Loads (or creates) the devnet keypairs in ./keys. Never commit that folder.
import { Keypair } from "@solana/web3.js";
import fs from "node:fs";
export function loadOrCreate(name) {
  const f = new URL(`../keys/${name}.json`, import.meta.url);
  fs.mkdirSync(new URL("../keys/", import.meta.url), { recursive: true });
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f, "utf8"))));
}
