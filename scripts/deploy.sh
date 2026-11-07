#!/usr/bin/env bash
set -euo pipefail

# Production deploy for HRNECK monorepo.
# Does NOT overwrite apps/api/.env or apps/web/.env* — those live only on the server.

ROOT="${DEPLOY_ROOT:-/home/itneck/apps/hrneck}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$ROOT"

echo "==> Fetching ${BRANCH}"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> PHP dependencies"
cd "$ROOT/apps/api"
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

echo "==> Node dependencies + builds"
cd "$ROOT"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm --dir apps/api build
pnpm --dir apps/web build

echo "==> Laravel optimize + migrate"
cd "$ROOT/apps/api"
php artisan migrate --force --no-interaction
php artisan tenants:migrate --force --no-interaction || true
php artisan storage:link --force >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache || true

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
