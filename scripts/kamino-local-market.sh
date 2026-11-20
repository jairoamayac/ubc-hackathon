#!/usr/bin/env bash
# Builds our Kamino Lend market on the local validator started by scripts/kamino-local.sh:
# test dollar (hmUSD) mint, market, hmUSD reserve (Pyth USDC/USD) and SOL reserve (Pyth SOL/USD),
# then a lender and a real borrower so the pool pays interest. Writes keys/kamino-local.json.
# Needs a clone of github.com/Kamino-Finance/klend-sdk with deps installed, pointed at the local RPC:
#   KLEND_SDK=/path/to/klend-sdk scripts/kamino-local-market.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
: "${KLEND_SDK:?set KLEND_SDK to a klend-sdk checkout}"
PORT="${PORT:-8999}"
U="http://127.0.0.1:$PORT"
HERE="$(pwd)"
S="$HERE/keys/sponsor.json"

solana -u "$U" -k "$S" airdrop 500 >/dev/null
MINT=$(spl-token -u "$U" --fee-payer "$S" create-token --decimals 6 --mint-authority "$S" 2>&1 | awk '/^Address:/{print $2}')
spl-token -u "$U" --fee-payer "$S" create-account "$MINT" --owner "$S" >/dev/null
spl-token -u "$U" --fee-payer "$S" mint "$MINT" 1000000 --mint-authority "$S" >/dev/null
spl-token -u "$U" --fee-payer "$S" wrap 50 "$S" >/dev/null 2>&1 || true
echo "hmUSD mint $MINT"

cfg() { # reserve config with our oracle and rate curve
  cp "$HERE/scripts/kamino/$1.json" "$KLEND_SDK/configs/kept_$1.json"
}
cfg hmusd; cfg sol
cd "$KLEND_SDK"
printf "ADMIN=%s\nRPC=localnet\n" "$S" > .env
km() { npx -y yarn@1.22.22 -s kamino-manager "$@" --mode execute 2>&1; }
M=""
for _ in 1 2 3; do # the first call after a fresh validator sometimes fails to land
  M=$(km create-market | awk '/Market created/{print $3}')
  [ -n "$M" ] && break
  sleep 2
done
[ -n "$M" ] || { echo "could not create the Kamino market" >&2; exit 1; }
echo "market $M"
add() {
  local r
  r=$(km add-asset-to-market --market "$M" --mint "$2" --reserve-config-path "./configs/kept_$1.json" | awk '/reserve: /{print $2}')
  sleep 3 # the reserve's lookup table must be active before the config update uses it
  km update-reserve-config --reserve "$r" --reserve-config-path "./configs/kept_$1.json" >/dev/null
  echo "$r"
}
USD_R=$(add hmusd "$MINT"); echo "hmUSD reserve $USD_R"
SOL_R=$(add sol So11111111111111111111111111111111111111112); echo "SOL reserve $SOL_R"
cd "$HERE"
cat > keys/kamino-local.json <<EOF
{ "market": "$M", "reserve": "$USD_R", "pythOracle": "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX", "mint": "$MINT",
  "solReserve": "$SOL_R", "solPythOracle": "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE" }
EOF
KAMINO_FILE=kamino-local.json RPC_URL="$U" node scripts/kamino-borrower.mts
