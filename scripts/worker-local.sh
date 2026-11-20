#!/usr/bin/env bash
# Runs the app + edge API (wrangler dev) against the local validator and the Kamino market that
# scripts/kamino-local.sh and scripts/kamino-local-market.sh created. Reads keys/kamino-local.json.
#   npm run build && scripts/worker-local.sh          # http://localhost:8788
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8788}"
RPC="${RPC:-http://127.0.0.1:8999}"
K=keys/kamino-local.json
[ -f "$K" ] || { echo "missing $K: run scripts/kamino-local.sh, then scripts/kamino-local-market.sh" >&2; exit 1; }
j() { node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$K','utf8'))['$1'])"; }
# The Worker signs as the sponsor: put its key in .dev.vars (git-ignored) if it isn't there yet.
grep -q '^SPONSOR_KEY=' .dev.vars 2>/dev/null || echo "SPONSOR_KEY=$(cat keys/sponsor.json)" >> .dev.vars
exec npx wrangler dev --port "$PORT" \
  --var "RPC_URL:$RPC" --var "MINT:$(j mint)" --var "QUICKNODE_URL:" \
  --var "KAMINO_MARKET:$(j market)" --var "KAMINO_RESERVE:$(j reserve)" --var "KAMINO_ORACLE:$(j pythOracle)"
