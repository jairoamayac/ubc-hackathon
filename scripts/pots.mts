// Lists every pot: dollars in its vault, dollars lent to Kamino, interest received. RPC_URL=... node scripts/pots.mts
import { Connection } from "@solana/web3.js";
import bs58 from "bs58";
import * as hm from "../src/lib/house-money/solana/hm.ts";
const conn = new Connection(process.env.RPC_URL ?? "http://127.0.0.1:8999", "confirmed");
const accs = await conn.getProgramAccounts(hm.PROGRAM_ID, { filters: [hm.discFilter(hm.ACCOUNT_DISC.Crew, bs58.encode)] });
for (const a of accs) {
  const c = hm.decodeCrew(a.pubkey, a.account.data);
  const v = await conn.getAccountInfo(hm.crewVaultPda(a.pubkey));
  console.log(c.name, "vault $" + hm.toUsd(v ? v.data.readBigUInt64LE(64) : 0n), "in Kamino $" + hm.toUsd(c.kaminoPrincipal), "yield paid $" + hm.toUsd(c.yieldPaid));
}
