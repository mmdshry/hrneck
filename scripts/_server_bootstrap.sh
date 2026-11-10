#!/usr/bin/env bash
# One-shot bootstrap for HRNECK on the production host. Run as root.
set -euo pipefail

APP_ROOT=/home/itneck/apps/hrneck
OLD_SITE=/home/itneck/public_html/hrneck.com
BACKUP_DIR=/home/itneck/backups
REPO=https://github.com/mmdshry/hrneck.git
DB_PASS="${HRNECK_DB_PASSWORD:?Set HRNECK_DB_PASSWORD}"

echo "==> Backup old site"
mkdir -p "$BACKUP_DIR"
if [ -d "$OLD_SITE" ] && [ ! -f "$BACKUP_DIR/hrneck.com-pre-replace.tgz" ]; then
  tar -czf "$BACKUP_DIR/hrneck.com-pre-replace.tgz" -C /home/itneck/public_html hrneck.com
fi

echo "==> Ensure app parent"
mkdir -p /home/itneck/apps
chown itneck:itneck /home/itneck/apps

if [ ! -d "$APP_ROOT/.git" ]; then
  echo "==> Clone repo"
  rm -rf "$APP_ROOT"
  sudo -u itneck git clone "$REPO" "$APP_ROOT"
else
  echo "==> Repo exists, fetch"
  cd "$APP_ROOT"
  sudo -u itneck git fetch --prune origin
  sudo -u itneck git reset --hard origin/main
fi

cd "$APP_ROOT"
chown -R itneck:itneck "$APP_ROOT"

echo "==> Composer install"
cd "$APP_ROOT/apps/api"
COMPOSER_BIN="$(command -v composer || true)"
if [ -z "$COMPOSER_BIN" ] && [ -x /usr/local/bin/composer ]; then
  COMPOSER_BIN=/usr/local/bin/composer
fi
sudo -u itneck env PATH="/usr/local/bin:/usr/bin:$PATH" "$COMPOSER_BIN" install --no-interaction --prefer-dist --optimize-autoloader --no-dev

echo "==> Write API .env"
if [ ! -f "$APP_ROOT/apps/api/.env" ]; then
  sudo -u itneck cp "$APP_ROOT/apps/api/.env.example" "$APP_ROOT/apps/api/.env"
fi

# Always rewrite production values (idempotent)
python3 - <<'PY'
import json
import os
from pathlib import Path
path = Path("/home/itneck/apps/hrneck/apps/api/.env")
text = path.read_text()
repl = {
    "APP_NAME": '"HRNECK Training Portal"',
    "APP_ENV": "production",
    "APP_DEBUG": "false",
    "TELESCOPE_ENABLED": "false",
    "APP_URL": "https://api.hrneck.com",
    "ASSET_URL": "https://api.hrneck.com",
    "BRAND_DOMAIN": "hrneck.com",
    "TENANCY_BASE_DOMAIN": "hrneck.com",
    "DEMO_ADMIN_EMAIL": "admin@hrneck.com",
    "DEMO_ADMIN_PASSWORD": '"ChangeMe!Hrneck2026"',
    "DB_CONNECTION": "mysql",
    "DB_HOST": "127.0.0.1",
    "DB_PORT": "3306",
    "DB_DATABASE": "itneck_hrneck",
    "DB_USERNAME": "itneck_admin",
    "DB_PASSWORD": json.dumps(os.environ["HRNECK_DB_PASSWORD"]),
    "SESSION_DRIVER": "redis",
    "SESSION_DOMAIN": ".hrneck.com",
    "SESSION_SECURE_COOKIE": "true",
    "SANCTUM_STATEFUL_DOMAINS": "hrneck.com,www.hrneck.com,app.hrneck.com,admin.hrneck.com,itneck.hrneck.com,test.hrneck.com,company.hrneck.com",
    "BROADCAST_CONNECTION": "reverb",
    "QUEUE_CONNECTION": "redis",
    "CACHE_STORE": "redis",
    "REDIS_CLIENT": "predis",
    "REDIS_HOST": "127.0.0.1",
    "REDIS_PASSWORD": "null",
    "REDIS_PORT": "6379",
    "MAIL_MAILER": "log",
    "FRONTEND_URL": "https://hrneck.com",
    "HRNECK_SMTP_SMOKE": "0",
    "REVERB_APP_ID": "hrneck",
    "REVERB_APP_KEY": "hrneck-reverb-key",
    "REVERB_APP_SECRET": "hrneck-reverb-secret",
    "REVERB_HOST": "hrneck.com",
    "REVERB_PORT": "443",
    "REVERB_SCHEME": "https",
    "VITE_REVERB_APP_KEY": '"${REVERB_APP_KEY}"',
    "VITE_REVERB_HOST": '"${REVERB_HOST}"',
    "VITE_REVERB_PORT": '"${REVERB_PORT}"',
    "VITE_REVERB_SCHEME": '"${REVERB_SCHEME}"',
    "LOG_LEVEL": "error",
}
lines = text.splitlines()
keys_seen = set()
out = []
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0]
    if key in repl:
        out.append(f"{key}={repl[key]}")
        keys_seen.add(key)
    else:
        out.append(line)
for key, val in repl.items():
    if key not in keys_seen:
        out.append(f"{key}={val}")
path.write_text("\n".join(out) + "\n")
print("wrote", path)
PY

cd "$APP_ROOT/apps/api"
# Generate key if empty
if ! grep -q '^APP_KEY=base64:' .env; then
  sudo -u itneck php artisan key:generate --force
fi

echo "==> Web env"
cat > "$APP_ROOT/apps/web/.env.production" <<'EOF'
API_ORIGIN=https://api.hrneck.com
NEXT_PUBLIC_SITE_URL=https://hrneck.com
NEXT_PUBLIC_BRAND_NAME=HRNECK Training Portal
NEXT_PUBLIC_BRAND_SHORT=HRNECK
NEXT_PUBLIC_API_URL=https://api.hrneck.com
NEXT_PUBLIC_REVERB_APP_KEY=hrneck-reverb-key
NEXT_PUBLIC_REVERB_HOST=hrneck.com
NEXT_PUBLIC_REVERB_PORT=443
NEXT_PUBLIC_REVERB_SCHEME=https
NEXT_PUBLIC_CONTACT_EMAIL=support@itneck.com
EOF
chown itneck:itneck "$APP_ROOT/apps/web/.env.production"
cp "$APP_ROOT/apps/web/.env.production" "$APP_ROOT/apps/web/.env.local"
chown itneck:itneck "$APP_ROOT/apps/web/.env.local"

echo "==> pnpm install + builds"
cd "$APP_ROOT"
# Use node as-is (v26 present). Prefer corepack pnpm 11.
sudo -u itneck bash -lc 'cd /home/itneck/apps/hrneck && corepack enable && corepack prepare pnpm@11.6.0 --activate && pnpm install --frozen-lockfile'
sudo -u itneck bash -lc 'cd /home/itneck/apps/hrneck && pnpm --dir apps/api build'
sudo -u itneck bash -lc 'cd /home/itneck/apps/hrneck && pnpm --dir apps/web build'

echo "==> Reset central DB and migrate/seed"
mysql -uitneck_admin -p"$DB_PASS" -e "DROP DATABASE IF EXISTS itneck_hrneck; CREATE DATABASE itneck_hrneck CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# drop tenant dbs if any
mysql -Nse "SHOW DATABASES LIKE 'hrneck_tenant_%'" | while read -r db; do
  mysql -e "DROP DATABASE IF EXISTS \`$db\`;"
done

cd "$APP_ROOT/apps/api"
sudo -u itneck php artisan migrate --force --no-interaction
sudo -u itneck php artisan db:seed --force --no-interaction
sudo -u itneck php artisan tenants:migrate --force --no-interaction || true
sudo -u itneck php artisan storage:link --force || true
sudo -u itneck php artisan config:cache
sudo -u itneck php artisan route:cache
sudo -u itneck php artisan view:cache

echo "==> Replace public_html with Next proxy"
# Keep cgi-bin if needed; wipe site contents then drop proxy htaccess
find "$OLD_SITE" -mindepth 1 -maxdepth 1 ! -name 'cgi-bin' -exec rm -rf {} +
cp "$APP_ROOT/deploy/apache-next-proxy.htaccess" "$OLD_SITE/.htaccess"
chown itneck:itneck "$OLD_SITE/.htaccess"

echo "==> Bootstrap complete"
