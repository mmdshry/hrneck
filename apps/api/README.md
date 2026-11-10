# HRNECK API (`apps/api`)

Laravel API + Filament admin for HRNECK.

```powershell
cd apps\api
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve --host=127.0.0.1 --port=8000
```

From the repo root, `pnpm dev` also starts this API with Reverb and the Next app.

Keep `SESSION_SECURE_COOKIE=false` for local HTTP (`*.hrneck.test`). Set `true` only on HTTPS.

See the root [README.md](../../README.md) and [docs/auth.md](../../docs/auth.md).
