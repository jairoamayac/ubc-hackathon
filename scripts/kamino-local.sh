#!/usr/bin/env bash
# Local validator with the real Kamino Lend program, its global config and the Pyth feeds cloned from
# mainnet, plus our own program. Everything Kept needs to test real yield offline from devnet limits.
#   scripts/kamino-local.sh            # starts on 127.0.0.1:8999 (RPC) and leaves it running
# Then: scripts/kamino-local-market.sh to create the Kamino market and reserves.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

LEDGER="${LEDGER:-.local-ledger}"
PORT="${PORT:-8999}"
KLEND=KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
KLEND_GLOBAL_CONFIG=BEe6HXZf6cByeb8iCxukjB8k74kJN3cVbBAGi49Hfi6W
PYTH_SOL_USD=7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE
PYTH_USDC_USD=Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX

# A fresh clone has no keys/: create the sponsor, and load our program at its declared address
# (the test validator needs no program keypair for that).
mkdir -p keys
[ -f keys/sponsor.json ] || solana-keygen new --no-bip39-passphrase --silent -o keys/sponsor.json
PROGRAM_ID=$(sed -n 's/^declare_id!("\(.*\)");/\1/p' programs/house_money/src/lib.rs)
[ -f target/deploy/house_money.so ] || cargo build-sbf --manifest-path programs/house_money/Cargo.toml --sbf-out-dir target/deploy

exec solana-test-validator --reset --quiet --ledger "$LEDGER" \
  --rpc-port "$PORT" --faucet-port $((PORT + 912)) --gossip-port $((PORT - 898)) --dynamic-port-range $((PORT - 889))-$((PORT - 859)) \
  -u https://api.mainnet-beta.solana.com \
  --clone-upgradeable-program "$KLEND" --clone-upgradeable-program FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr \
  --clone "$KLEND_GLOBAL_CONFIG" --clone "$PYTH_SOL_USD" --clone "$PYTH_USDC_USD" \
  --upgradeable-program "$PROGRAM_ID" target/deploy/house_money.so keys/sponsor.json
