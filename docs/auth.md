# Authentication

HRNECK uses first-party **Laravel Sanctum cookie sessions** (not bearer PATs). The Next app rewrites `/api`, `/sanctum`, and `/broadcasting` to the Laravel origin so the browser stays same-origin.

## Demo accounts

| Email | Role | Password |
|-------|------|----------|
| `admin@hrneck.test` | Platform staff (MSP + Filament) | `DemoPass!234` |
| `admin@itneck.test` | Org admin (`itneck`) | `DemoPass!234` |
| `admin@test.test` / `admin@company.test` | Org admins | `DemoPass!234` |

Source of truth: [`apps/api/config/brand.php`](../apps/api/config/brand.php) + [`DemoSeeder`](../apps/api/database/seeders/DemoSeeder.php).

## Sign-in flow

1. `GET /sanctum/csrf-cookie` (credentials included)
2. `POST /api/v1/auth/login` with email/password/`remember`
3. If MFA is enabled → `{ mfa_required, challenge_token }` → `POST /api/v1/auth/mfa/verify` with TOTP or recovery code
4. Otherwise session cookie is established; `GET /api/v1/auth/me` returns the user

Unverified emails (`email_verified_at` null) cannot sign in to the SPA. Org users from `CreateOrgUser` and platform users from Filament `persistUser` are verified on create (`forceFill`).

## MFA

- Setup/confirm: `POST /api/v1/auth/mfa/setup` → `confirm` (returns one-time recovery codes)
- Disable: `POST /api/v1/auth/mfa/disable` with password + TOTP/recovery code
- Recovery codes are consumed under a row lock (single-use)
- Filament admin login uses the same `mfa_*` columns via App Authentication
- UI: `/org/settings/mfa`

## Password

- Forgot: `POST /api/v1/auth/password/forgot` → email link to `{FRONTEND_URL}/login/reset?token=…&email=…`
- Reset: `POST /api/v1/auth/password/reset` (rotates `remember_token`)
- Change (authenticated): `POST /api/v1/auth/password` (rotates `remember_token`, clears staff tenant context, regenerates session)

## Platform staff tenant context

Platform staff keep their own identity. To operate a tenant in Next `/org`:

1. `POST /api/v1/msp/tenants/{id}/enter` stores `staff_tenant_id` in the session
2. Org API calls with matching `X-Tenant` succeed (`EnsureOrgMembership` + `Gate::before` only when `StaffTenant::matches(tenant('id'))`)
3. `Gate::before` never elevates `viewHorizon` / `viewTelescope`
4. `POST /api/v1/msp/tenants/leave` clears context

MSP UI “Open tenant admin” performs enter before navigating. Org shell shows an exit banner and full permission nav while `acting_in_tenant` is true (`hasPermission` short-circuits).

## Route gates

- Next `src/proxy.ts` redirects unauthenticated browsers away from `/msp`, `/org`, `/learn`, `/portal`
- Signed-in visits to `/login` redirect via `/auth/me` to `/msp` (platform) or `/org` (tenant user), unless `?next=` is set
- `/login/mfa`, `/login/forgot`, `/login/reset` stay reachable mid-flow
- API remains the source of truth (`auth:sanctum`, membership, Spatie permissions)
- `API_ORIGIN` must reach Laravel from the Next server (used by the proxy)

## Sanctum / session

- Stateful domains: `SANCTUM_STATEFUL_DOMAINS` plus `*.hrneck.com` in production (`config/sanctum.php`); include host+port for every origin you open in local (e.g. `127.0.0.1:3100`)
- Prefer `SESSION_ENCRYPT=true` on all environments. Set `SESSION_SECURE_COOKIE=true` only on HTTPS (production). Local `*.hrneck.test` over HTTP must use `SESSION_SECURE_COOKIE=false` (see `.env.example`) or the browser will drop the session cookie after login
- For shared cookies across `{slug}.hrneck.test`, set `SESSION_DOMAIN=.hrneck.test` (and `.hrneck.com` in production)
- Login/forgot throttled by `auth-login` (per IP + email), independent of `X-Tenant`
