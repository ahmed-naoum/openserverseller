#!/bin/bash
# ============================================================================
# SILACOD — deploy script
#
# Run by hand (`bash deploy.sh`) or by the admin Deployments panel, which spawns
# it detached so it survives the `pm2 restart` at the end.
#
# Design notes for anyone editing this:
#
#   * The repo path is DERIVED from this script's location, not hardcoded.
#     deploy.sh, setup.sh and ecosystem.config.cjs previously disagreed
#     (/var/www/openseller vs /var/www/silacod); deriving it removes the class
#     of bug entirely.
#
#   * The frontend builds into a temporary directory and is swapped in with an
#     atomic `mv`. `vite build` empties its output directory first, so building
#     straight into the live dist/ served 404s and half-built pages for the
#     60-90s of the build. That was survivable when deploys were rare and
#     manual; with a one-click button it is not.
#
#   * `prisma db push` no longer passes --accept-data-loss by default. That flag
#     silently drops columns and tables Prisma judges destructive — acceptable
#     when a human is watching, not acceptable behind a button that anyone with
#     an admin session can press. Set ALLOW_DATA_LOSS=1 for the rare intentional
#     destructive migration.
#
#   * Ordering is load-bearing: the backend restarts BEFORE the frontend builds,
#     because generate-sitemap.mjs fetches the product catalogue from the running
#     API. Reversing it silently ships a sitemap with no product URLs.
#
#   * DEPLOY_RESULT=... is printed at the end. The API reads it on boot to work
#     out how a deploy that restarted it actually finished.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${DEPLOY_BRANCH:-master}"
ALLOW_DATA_LOSS="${ALLOW_DATA_LOSS:-0}"
PM2_APP="${PM2_APP:-silacod-api}"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
fail() { echo ""; echo "❌ $*"; echo "DEPLOY_RESULT=FAILED"; exit 1; }

# Any unexpected error still emits the marker the API looks for.
trap 'echo "DEPLOY_RESULT=FAILED"' ERR

log "🚀 Deploying SILACOD from ${REPO_ROOT} (branch ${BRANCH})"

cd "$REPO_ROOT"

# ── Sanity checks ───────────────────────────────────────────────────────────
[ -d .git ]           || fail "Not a git checkout: ${REPO_ROOT}"
[ -d backend ]        || fail "backend/ not found in ${REPO_ROOT}"
[ -d frontend ]       || fail "frontend/ not found in ${REPO_ROOT}"

if [ -n "$(git status --porcelain)" ]; then
  log "⚠️  Working tree has local changes; git pull may conflict:"
  git status --short | head -20
fi

# ── Pull ────────────────────────────────────────────────────────────────────
log ">>> Pulling ${BRANCH}..."
git reset --hard HEAD >/dev/null 2>&1 || true
git pull origin "$BRANCH" || fail "git pull failed (conflicts or no credentials)"
DEPLOYED_SHA="$(git rev-parse --short HEAD)"
log "    now at ${DEPLOYED_SHA}: $(git log -1 --pretty=%s)"

# ── Backend ─────────────────────────────────────────────────────────────────
log ">>> Building backend..."
cd "${REPO_ROOT}/backend"

npm install --include=dev --no-audit --no-fund || fail "backend npm install failed"
npx prisma generate               || fail "prisma generate failed"

if [ "$ALLOW_DATA_LOSS" = "1" ]; then
  log "    ⚠️  ALLOW_DATA_LOSS=1 — destructive schema changes permitted"
  npx prisma db push --accept-data-loss || fail "prisma db push failed"
else
  # Without the flag, Prisma refuses rather than silently dropping data. A
  # refusal here is the system working: apply the change deliberately, with a
  # backup taken first.
  npx prisma db push || fail "prisma db push refused (destructive change?). Take a backup, then re-run with ALLOW_DATA_LOSS=1 if the change is intended."
fi

npm run build || fail "backend build failed"

# ── Frontend (atomic) ───────────────────────────────────────────────────────
log ">>> Building frontend..."
cd "${REPO_ROOT}/frontend"

npm install --include=dev --no-audit --no-fund || fail "frontend npm install failed"

# Point puppeteer at the system browser if it is installed. Prerendering skips
# itself gracefully when no browser is found, so this is best-effort.
if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
  for candidate in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable /snap/bin/chromium; do
    if [ -x "$candidate" ]; then
      export PUPPETEER_EXECUTABLE_PATH="$candidate"
      log "    using browser ${candidate} for prerendering"
      break
    fi
  done
  if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
    log "    ⚠️  no Chromium found — pages will ship WITHOUT prerendering."
    log "       Install with: sudo apt-get install -y chromium-browser"
  fi
fi

BUILD_DIR="${REPO_ROOT}/frontend/dist"
STAGING_DIR="${REPO_ROOT}/frontend/.dist-next"
PREVIOUS_DIR="${REPO_ROOT}/frontend/.dist-previous"

rm -rf "$STAGING_DIR" "$PREVIOUS_DIR"

# Build into the staging directory so the live site keeps serving the old build
# for the entire duration. VITE_OUT_DIR is read by both vite.config.ts and
# scripts/prerender.mjs — it cannot be passed as a CLI flag because `npm run
# build` is a four-command chain and the flag would land on the last one.
if ! VITE_OUT_DIR="$STAGING_DIR" npm run build; then
  rm -rf "$STAGING_DIR"
  fail "frontend build failed — live site untouched, still serving the previous build"
fi

[ -f "${STAGING_DIR}/index.html" ] || { rm -rf "$STAGING_DIR"; fail "build produced no index.html — refusing to swap"; }

log ">>> Swapping in the new build..."
if [ -d "$BUILD_DIR" ]; then
  mv "$BUILD_DIR" "$PREVIOUS_DIR"
fi
mv "$STAGING_DIR" "$BUILD_DIR"
rm -rf "$PREVIOUS_DIR"

log ">>> Restarting ${PM2_APP}..."
pm2 restart "$PM2_APP" --update-env || fail "pm2 restart failed"

log ""
log "✅ Deployment complete — ${DEPLOYED_SHA}"
log "   pm2 logs ${PM2_APP}   # backend logs"

# Marker read by deploy.service.ts on boot, to settle deployments that were
# still RUNNING when the pm2 restart above killed the API mid-stream.
echo "DEPLOY_RESULT=SUCCESS"

