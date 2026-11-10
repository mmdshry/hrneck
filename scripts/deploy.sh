#!/usr/bin/env bash
set -euo pipefail

# Production deploy for HRNECK monorepo.
# Does NOT overwrite apps/api/.env or apps/web/.env* — those live only on the server.

ROOT="${DEPLOY_ROOT:-/home/itneck/apps/hrneck}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$ROOT"

# Root deploys a tree owned by the site user. Scope this process only.
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=safe.directory
export GIT_CONFIG_VALUE_0="$ROOT"

echo "==> Fetching ${BRANCH}"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> PHP dependencies"
cd "$ROOT/apps/api"
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

echo "==> Node dependencies + builds"
cd "$ROOT"
# Non-interactive SSH has no TTY. pnpm refuses to recreate node_modules unless CI is set.
export CI=true
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm --dir apps/api build
pnpm --dir apps/web build

echo "==> Laravel optimize + migrate"
cd "$ROOT/apps/api"
php artisan migrate --force --no-interaction
php artisan tenants:migrate --force --no-interaction
php artisan storage:link --force >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

echo "==> PM2 reload"
cd "$ROOT"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe hrneck-web >/dev/null 2>&1; then
    pm2 reload deploy/ecosystem.config.cjs --update-env
  else
    pm2 start deploy/ecosystem.config.cjs
  fi
  pm2 save
else
  echo "WARN: pm2 not found; skip process reload" >&2
fi

echo "==> Deploy complete"
