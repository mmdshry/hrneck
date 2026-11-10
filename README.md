# HRNECK — HRNECK Training Portal

Security awareness training platform. English UI. No Docker — native Windows.

Production: https://hrneck.com/

## Stack (always latest stable at install)

- `apps/api` — PHP 8.3+ (CI uses 8.5), Laravel 13, Filament 5, stancl/tenancy, Horizon, Reverb, Scramble, Pest
- `apps/web` — Next.js 16, React 19, Tailwind 4, Playwright, Lighthouse budgets
- `packages/api-client` — Orval stub (web currently uses `apps/web/src/lib/api.ts`)

## Local hosts (`*.hrneck.test`)

| Host | Role |
|------|------|
| `hrneck.test` | Marketing + Next app (landing, login, MSP/org) |
| `app.hrneck.test` | Same Next app (legacy alias) |
| `admin.hrneck.test` | Filament central |
| `{slug}.hrneck.test` | Tenant admin + learner |

Demo: `admin@hrneck.test` / `DemoPass!234` (platform); `admin@itneck.test` (org). See `apps/api/config/brand.php` and [`docs/auth.md`](docs/auth.md).

## Quick start (Windows)

```powershell
.\scripts\windows\install-deps.ps1
.\scripts\windows\add-hosts.ps1   # Admin — also removes legacy *.itp.test entries
.\scripts\windows\dev-up.ps1
```

`dev-up.ps1` migrates/seeds and **starts** Caddy, API (`artisan serve`), **Reverb** (WebSocket live data), and Next (`pnpm dev`) in separate windows by default.

Alternatively from the repo root: `pnpm dev` (API + Reverb + Next together), or in `apps/api`: `composer dev` / `php artisan dev` (includes Reverb).

API Vite assets (Filament/admin front-end build): from repo root `pnpm --dir apps/api build` (pnpm workspace; do not use npm).

## Tests

```powershell
cd apps\api; php artisan test
cd apps\web; pnpm test; pnpm test:e2e
```

Lighthouse URL list: `apps/web/lighthouse/urls.json` (target 100 / Agentic 2/2).
