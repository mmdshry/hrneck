# Authentication

HRneck uses first-party **Laravel Sanctum cookie sessions** (not bearer PATs). The Next app rewrites `/api`, `/sanctum`, and `/broadcasting` to the Laravel origin so the browser stays same-origin.

## Demo accounts

| Email | Role | Password |
|-------|------|----------|
| `admin@hrneck.test` | Platform staff (MSP) | `DemoPass!234` |
| `admin@itneck.test` | Org admin (`itneck`) | `DemoPass!234` |
| `admin@test.test` / `admin@company.test` | Org admins | `DemoPass!234` |

Source of truth: [`apps/api/config/brand.php`](../apps/api/config/brand.php) + [`DemoSeeder`](../apps/api/database/seeders/DemoSeeder.php).

## Sign-in flow

1. `GET /sanctum/csrf-cookie` (credentials included)
2. `POST /api/v1/auth/login` with email/password/`remember`
3. If MFA is enabled → `{ mfa_required, challenge_token, mfa_methods: { totp, passkey } }` → a second factor: `POST /api/v1/auth/mfa/verify` (authenticator code or recovery code) or the passkey endpoints below
4. Otherwise session cookie is established; `GET /api/v1/auth/me` returns the user

If one password matches several organization logins, step 2 returns an organization choice instead of a session. See [Organizations per sign-in](#organizations-per-sign-in).

Unverified emails (`email_verified_at` null) cannot sign in to the SPA. Org users from `CreateOrgUser` and platform users from `persistUser` are verified on create (`forceFill`).

## Organizations per sign-in

One person can belong to several organizations. Two shapes are supported, and they can be combined:

- **Memberships:** one login with several `tenant_memberships`.
- **Separate logins:** one login per organization, all with the same email. `users` keeps `(tenant_id, email)` unique, so one email can have one login per organization.

`GET /api/v1/auth/me` returns `organizations` (`{ tenant_id, name, requires_password }`) and `needs_org_selection`:

- `requires_password: false` is a membership of the signed-in login. It is entered without a password.
- `requires_password: true` is another login with the same email. It needs that login's password, and its MFA if enabled.
- Disabled memberships and disabled logins are left out.
- `needs_org_selection` is false when the user has one organization that is a membership, or when the session already has an active organization from the user's memberships. Otherwise it is true, and the web app opens `/select-org`.

### Choosing at sign-in

When one password matches several organization logins, `POST /api/v1/auth/login` starts no session. It returns a challenge and the list:

```json
{ "org_choice_required": true, "challenge_token": "…", "organizations": [{ "tenant_id": "itneck", "name": "ITneck" }] }
```

- The challenge is single-use and expires after 10 minutes. It stores the matching login ids, never the password.
- The web app keeps it in `sessionStorage` (`org_choice`) and opens `/select-org`, where the user picks an organization without typing the password again.
- `POST /api/v1/auth/login/org` with `{ challenge_token, tenant }` signs into the chosen login and consumes the challenge. `tenant` must be one of the listed organizations, or the request fails with `org_choice_invalid`.
- If that login has MFA, the response is `{ mfa_required, challenge_token, mfa_methods }`. The usual second factor completes it. That challenge carries the chosen organization, which becomes active once the factor is accepted.
- The organization sign-in address (subdomain, or `?tenant=`) is sent as `tenant` on `POST /api/v1/auth/login`. When it names one of the logins, that login is used directly and no list is shown. The named organization becomes the active one when the login can enter it without another password (its own membership, or a membership it already has). A login the user is only a member of, and that has no login at that address, is not found there: sign in at the address of the login's own organization, then pick the other organization on `/select-org`.
- SSO works the same way: the one-time handoff carries the organization of `return_to` (for example `company` from `company.hrneck.test`), and the exchange makes it active when the account can enter it.

### Switching organization

`/select-org` also switches organizations while signed in:

- A membership of this login: `POST /api/v1/auth/orgs/{tenant}/enter`. No password.
- Another login with the same email: `POST /api/v1/auth/orgs/{tenant}/switch` with `{ password }`. That login's password is required again, and so is its MFA. The response is either the user, or `mfa_required` and `challenge_token`, which finish with the same second-factor endpoints. Platform staff cannot switch this way. The endpoint is throttled by `auth-login`.

Switching replaces the session with the target login's session. The browser then opens the organization's own subdomain (`tenantWorkspaceUrl`). `SESSION_DOMAIN=.hrneck.test` shares the cookie across tenant subdomains. Local `.env` keeps `SESSION_DOMAIN=null`, so each subdomain has its own session and its own active organization.

## MFA

Two second factors are available, and either one completes sign-in: an authenticator app (TOTP) or passkeys (WebAuthn). A user can have both. `mfa_enabled` is true while at least one factor exists.

- **Authenticator app:** `POST /api/v1/auth/mfa/setup` → `POST /api/v1/auth/mfa/confirm` (returns one-time recovery codes).
- **Passkeys:** `POST /api/v1/auth/passkeys/register/options` → browser ceremony → `POST /api/v1/auth/passkeys/register/verify` with `{ credential, name }`. Adding the first factor turns MFA on and issues recovery codes once.
  - `GET /api/v1/auth/passkeys` lists them. `DELETE /api/v1/auth/passkeys/{id}` removes one and needs the account password.
  - Removing the last factor turns MFA off and clears the recovery codes.
- **Sign-in with a passkey:** `POST /api/v1/auth/mfa/passkey/options` → browser ceremony → `POST /api/v1/auth/mfa/passkey/verify` with `{ challenge_token, credential }`.
- **Disable:** `POST /api/v1/auth/mfa/disable` with the password plus either `code` (authenticator or recovery code) or `passkey` (an assertion from `POST /api/v1/auth/passkeys/assertion/options`). Disabling MFA also removes every passkey.
- Recovery codes are consumed under a row lock (single-use). They stay available as the fallback for both factors.

### Passkey configuration

Library: `web-auth/webauthn-lib`. Settings live in [`apps/api/config/passkeys.php`](../apps/api/config/passkeys.php):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PASSKEY_RP_ID` | `BRAND_DOMAIN` | Relying-party ID. Passkeys are bound to it, and subdomains of it are accepted. |
| `PASSKEY_ALLOWED_ORIGINS` | `FRONTEND_URL` | Comma-separated origins the ceremony may come from. Subdomains are allowed. |
| `PASSKEY_RP_NAME` | `BRAND_SHORT` | Name shown by the authenticator. |

- Challenges are cached for 300 seconds and are single use. A failed assertion consumes its challenge, so the browser requests fresh options to retry.
- Attestation is `none`: the server only verifies possession of the key.
- Browsers only allow passkeys in a secure context: `https://` or `localhost`. Over plain `http://*.hrneck.test` the browser hides the WebAuthn API, so the MFA screens say that passkeys need HTTPS instead of offering them.
- Local testing uses HTTPS. `scripts/windows/Caddyfile` serves the web app over `https://*.hrneck.test` with Caddy's local CA (`tls internal`). Run `caddy trust` once in an elevated shell so the browser accepts the certificate. Next still proxies `/api` to the HTTP API, so the browser only sees `https://`.
- `PASSKEY_ALLOWED_ORIGINS` defaults to `FRONTEND_URL`, which is `http://…` locally. For local HTTPS set `PASSKEY_ALLOWED_ORIGINS=https://hrneck.test` in `apps/api/.env`. Otherwise the server rejects every ceremony from `https://`.
- The RP ID is the base domain, so passkeys do not work on tenant custom domains.

- UI: `/org/settings/mfa` (authenticator app, passkeys, disable). The sign-in challenge is `/login/mfa`.

## Single sign-on (Google and Microsoft)

Users can also sign in with a Google account or a Microsoft account: Entra work/school accounts and personal Microsoft accounts. Password sign-in stays available next to SSO.

### Setup

The OAuth credentials are global to the platform (one client per provider), set in the API `.env`:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client |
| `GOOGLE_REDIRECT_URI` | Defaults to `${APP_URL}/api/v1/auth/oauth/google/callback` |
| `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | Microsoft app registration |
| `AZURE_TENANT_ID` | Defaults to `common`: work/school accounts from any directory plus personal Microsoft accounts |
| `AZURE_REDIRECT_URI` | Defaults to `${APP_URL}/api/v1/auth/oauth/microsoft/callback` |

Register the exact redirect URIs in each provider console. They always point at the API host, never at a tenant host.

A provider gets a button on the login page only when its client ID is set. `GET /api/v1/auth/oauth/providers` returns the configured provider names and no secrets. If a provider is started without a client ID, the API redirects to `/login?sso_error=provider_not_configured`. Password sign-in is unaffected.

### Local development

The default redirect URIs use `api.hrneck.test`, and neither provider accepts that host for a web client. Google requires HTTPS except on `localhost`, and it requires a public suffix such as `.com`, so `.test` is rejected. Entra accepts `http` only for `localhost`. For local testing, register callbacks on `localhost:8000` and set the matching values in `apps/api/.env`:

```
GOOGLE_CLIENT_ID=<from Google Cloud>
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/oauth/google/callback
AZURE_CLIENT_ID=<application (client) ID>
AZURE_CLIENT_SECRET=<secret value, not the secret ID>
AZURE_TENANT_ID=common
AZURE_REDIRECT_URI=http://localhost:8000/api/v1/auth/oauth/microsoft/callback
```

- **Google Cloud:** create an OAuth client of type *Web application*. Add `http://localhost:8000/api/v1/auth/oauth/google/callback` under *Authorized redirect URIs*. While the OAuth consent screen is in *Testing*, add each account that will sign in under *Test users*.
- **Microsoft Entra:** register an app. Under *Authentication*, add a *Web* platform with redirect URI `http://localhost:8000/api/v1/auth/oauth/microsoft/callback`. Under *Supported account types*, choose *Accounts in any organizational directory and personal Microsoft accounts*, which matches `AZURE_TENANT_ID=common`. Create a client secret and copy its **Value** into `AZURE_CLIENT_SECRET`.
- Use `localhost`, not `127.0.0.1`. Entra refuses `http://127.0.0.1` for the web platform.
- The browser must run on the same machine as the API. After the provider sends the user to `localhost:8000`, the browser continues to the tenant host (for example `http://itneck.hrneck.test`), which is unchanged.
- After editing `.env`, restart the API process so it reads the new values. If you use `php artisan config:cache`, run `php artisan config:clear` first.

In production, use the HTTPS API host, for example `https://api.<domain>/api/v1/auth/oauth/google/callback`. The `.env.example` defaults already build the URIs from `APP_URL`.

### Flow

1. The login page sends the browser to `GET /api/v1/auth/oauth/{google|microsoft}/redirect` with `return_to` (the platform origin the user is on), an optional same-origin `next`, and `remember`.
2. The API stores `state` and a nonce in the cache for 10 minutes, single use. The session is not used, because the callback arrives on the API host while the session cookie belongs to the tenant host.
3. The provider signs the user in and runs its own MFA. It redirects to `GET /api/v1/auth/oauth/{provider}/callback`.
4. The API exchanges the code and checks the ID token claims: `iss`, `aud`, `exp` (60 seconds of skew), and `nonce`. Then it resolves the user (see below).
5. The API creates a one-time handoff token valid for 60 seconds and redirects to `{return_to}/login/sso/complete?token=…`.
6. That page calls `POST /api/v1/auth/oauth/exchange` on the same host. The Sanctum session cookie is created there, and the page continues to `/org` or `/msp`, or to `next`.

Failures redirect to `/login?sso_error=<code>` with one of `cancelled`, `invalid_request`, `invalid_state`, `provider_error`, `not_linked`, `account_disabled`, `handoff_invalid`, or `provider_not_configured`. The web app shows a translated message for each code.

### Who can sign in

- Only accounts an administrator already created can sign in. SSO never creates a user.
- An existing `(provider, subject)` identity wins. The provider email is not used in that case.
- Otherwise the account is matched by email, and only when the provider vouches for the address. Google requires `email_verified`. Microsoft has no verified-email claim, so the `mail` attribute is trusted, or the sign-in name when `mail` is empty. An unverified address is never linked.
- Linking sets `email_verified_at` when it was empty and stores a `user_identities` row. An account can hold at most one identity per provider.
- Disabled accounts (`disabled_at`) are refused, both on the first link and on later sign-ins.
- `must_set_password` is not changed by SSO.
- The app's own MFA (TOTP and passkeys) does not run for SSO sign-ins. The identity provider performs the MFA.

### Security notes

- The ID token signature is not verified. The token comes straight from the token endpoint over TLS, authenticated with the client secret (OpenID Connect Core 3.1.3.7). The claims listed above are checked.
- `state`, `nonce`, and the handoff token are single use. Cache keys store a SHA-256 hash of each value.
- The `sso` rate limiter is per IP: 30 requests per minute in production, 300 in local and testing. It is separate from `auth-login` because one sign-in makes three requests.
- `return_to` must be the base domain or one of its subdomains (`TENANCY_BASE_DOMAIN`). Other origins, including `localhost`, are rejected with `invalid_request`.

Code: [`SsoController`](../apps/api/app/Http/Controllers/Api/V1/SsoController.php), [`SsoLogin`](../apps/api/app/Domains/IdentityAccess/Actions/SsoLogin.php), [`SsoFlowStore`](../apps/api/app/Domains/IdentityAccess/Support/SsoFlowStore.php). Tests: [`SsoLoginTest`](../apps/api/tests/Feature/SsoLoginTest.php), [`login-form.test.tsx`](../apps/web/src/app/login/login-form.test.tsx).

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

MSP UI “Open tenant admin” performs enter before navigating. Org shell shows an exit banner while `acting_in_tenant` is true.

While acting in a tenant, `permissions` on `/api/v1/auth/me` is the Gate-equivalent list from `OrgPermissionCatalog::staffTenantPermissionsFor()`:

- `platform_super_admin`: full org catalog (including `org.roles.manage` and `org.settings.manage`)
- `platform_agent`: `staffTenantPermissions()`, which excludes Roles and Settings

Web `hasPermission` reads only that list; it does not special-case `acting_in_tenant`.

## Route gates

- Next `src/proxy.ts` redirects unauthenticated browsers away from `/msp`, `/org`, `/learn`, `/portal`
- Signed-in visits to `/login` redirect via `/auth/me` to `/msp` (platform) or `/org` (tenant user), unless `?next=` is set
- `/login/mfa`, `/login/forgot`, `/login/reset`, `/login/sso` and `/select-org` stay reachable mid-flow
- API remains the source of truth (`auth:sanctum`, membership, Spatie permissions)
- `API_ORIGIN` must reach Laravel from the Next server (used by the proxy)

## Sanctum / session

- Stateful domains: `SANCTUM_STATEFUL_DOMAINS` plus `*.hrneck.com` in production (`config/sanctum.php`); include host+port for every origin you open in local (e.g. `127.0.0.1:3100`). Local `.env` lists `*.hrneck.test`, so every tenant subdomain is stateful (Sanctum matches patterns with `Str::is`)
- Prefer `SESSION_ENCRYPT=true` on all environments. Set `SESSION_SECURE_COOKIE=true` only on HTTPS (production). Local `*.hrneck.test` over HTTP must use `SESSION_SECURE_COOKIE=false` (see `.env.example`) or the browser will drop the session cookie after login
- For shared cookies across `{slug}.hrneck.test`, set `SESSION_DOMAIN=.hrneck.test` (and `.hrneck.com` in production)
- Login/forgot throttled by `auth-login` (per IP + email), independent of `X-Tenant`
