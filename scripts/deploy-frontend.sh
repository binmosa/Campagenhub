#!/usr/bin/env bash
#
# Build the frontend here and put it on the server — one command.
#
#   npm run deploy:frontend
#
# Why this exists: the server cannot build the frontend itself, because
# @heroui-pro/react's postinstall needs a CI/CD licence key we do not have.
# Until that arrives, a pushed frontend change is pulled onto the server and
# then ignored — nginx keeps serving the old bundle. This script is the
# missing half of the deploy: build where the licence works (this machine),
# ship the result.
#
# Server details live in .deploy.env at the repo root (gitignored):
#
#   DEPLOY_HOST=forge@1.2.3.4
#   DEPLOY_KEY=~/private_key                       # optional if ~/.ssh/config covers the host
#   DEPLOY_PATH=/home/forge/campaignhubz.com       # the site directory on the server
#   DEPLOY_HOOK=https://forge.laravel.com/...      # optional: Forge deploy hook, runs the backend deploy too
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

# ── Config ──────────────────────────────────────────────────────────
if [[ -f .deploy.env ]]; then
  # shellcheck disable=SC1091
  set -a; source .deploy.env; set +a
fi
: "${DEPLOY_HOST:?Set DEPLOY_HOST in .deploy.env (e.g. forge@1.2.3.4) — see scripts/deploy-frontend.sh}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH in .deploy.env (e.g. /home/forge/campaignhubz.com)}"
DEPLOY_KEY="${DEPLOY_KEY:-}"
DEPLOY_HOOK="${DEPLOY_HOOK:-}"
DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="--dry-run"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)
if [[ -n "$DEPLOY_KEY" ]]; then
  KEY="${DEPLOY_KEY/#\~/$HOME}"
  [[ -f "$KEY" ]] || fail "DEPLOY_KEY points at $KEY, which does not exist"
  SSH_OPTS+=(-i "$KEY")
fi
SSH="ssh ${SSH_OPTS[*]}"

# ── Build ───────────────────────────────────────────────────────────
bold "▸ Building the frontend"
# /api is the same-origin base for the single-server deployment. Vite also
# reads frontend/.env for VITE_* keys (the Turnstile site key), so nothing
# else needs passing.
( cd frontend && VITE_API_BASE_URL=/api npm run build ) || fail "Build failed — nothing was uploaded"

[[ -f frontend/dist/index.html ]] || fail "frontend/dist/index.html is missing after the build"

# A bundle that still points at localhost would take the whole site down.
if grep -rq ':3001/api' frontend/dist/assets/ 2>/dev/null; then
  fail "The bundle contains a localhost API fallback — VITE_API_BASE_URL was not applied"
fi

# ── Upload ──────────────────────────────────────────────────────────
bold "▸ Uploading to $DEPLOY_HOST:$DEPLOY_PATH/frontend/dist/ ${DRY_RUN:+(dry run)}"
# --delete clears out old hashed assets so the server never accumulates
# stale bundles. Scoped strictly to frontend/dist.
rsync -az --delete $DRY_RUN --stats -e "$SSH" \
  frontend/dist/ "$DEPLOY_HOST:$DEPLOY_PATH/frontend/dist/" \
  || fail "Upload failed — the server still has the previous bundle"

if [[ -z "$DRY_RUN" ]]; then
  # Prove the file that nginx serves is actually there.
  $SSH "$DEPLOY_HOST" "test -f '$DEPLOY_PATH/frontend/dist/index.html'" \
    || fail "index.html is not on the server after upload"
fi

# ── Optional: backend deploy via Forge's hook ──────────────────────
if [[ -n "$DEPLOY_HOOK" && -z "$DRY_RUN" ]]; then
  bold "▸ Triggering the Forge deploy (backend build + daemon restart)"
  curl -fsS -X POST "$DEPLOY_HOOK" >/dev/null && echo "  deploy queued — watch Forge → Deployments" \
    || echo "  (deploy hook call failed; run Deploy Now in Forge)"
fi

bold "✓ Frontend is live${DRY_RUN:+ (dry run — nothing changed)}"
