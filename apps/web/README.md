# HRNECK web (`apps/web`)

Next.js app for HRNECK (MSP / org / learner / portal).

Use the **repo root** workspace — do not run a separate `pnpm install` inside this folder.

## Commands (from repo root)

```powershell
pnpm install
pnpm dev                 # API + Reverb + Next on 127.0.0.1:3100
pnpm --dir apps/web lint
pnpm --dir apps/web test
pnpm --dir apps/web exec playwright test
```

Or `.\scripts\windows\dev-up.ps1` for Caddy + hosts-friendly local URLs (`hrneck.test`).

See the root [README.md](../../README.md) and [docs/auth.md](../../docs/auth.md).
