$ErrorActionPreference = "Stop"

Write-Host "==> HRNECK native dependency checklist (no Docker)"
Write-Host "Required:"
Write-Host "  - PHP 8.5+ with extensions: pgsql/mysql, redis, mbstring, openssl, intl, fileinfo, sodium, zip"
Write-Host "  - Composer"
Write-Host "  - Node.js 22+ LTS and pnpm (corepack enable)"
Write-Host "  - PostgreSQL 16+ OR MariaDB/MySQL (current local uses MariaDB via XAMPP)"
Write-Host "  - Memurai Developer OR Redis-compatible server"
Write-Host "  - Caddy Windows binary"
Write-Host ""
Write-Host "Then:"
Write-Host "  1) .\scripts\windows\add-hosts.ps1   (Admin)"
Write-Host "  2) cd apps\api; composer install; copy .env.example .env; php artisan key:generate"
Write-Host "  3) From repo root: pnpm install  (workspace); copy apps\web\.env.example apps\web\.env.local"
Write-Host "  4) Optional API Vite/Filament assets: pnpm --dir apps/api build"
Write-Host "  5) .\scripts\windows\dev-up.ps1   # starts API + Reverb + Next (+ Caddy if available)"
Write-Host ""

$checks = @(
    @{ Name = "php"; Cmd = { php -v } },
    @{ Name = "composer"; Cmd = { composer -V } },
    @{ Name = "node"; Cmd = { node -v } },
    @{ Name = "pnpm"; Cmd = { pnpm -v } }
)

foreach ($c in $checks) {
    try {
        & $c.Cmd | Select-Object -First 1 | ForEach-Object { Write-Host ("[ok] {0}: {1}" -f $c.Name, $_) }
    } catch {
        Write-Host ("[missing] {0}" -f $c.Name)
    }
}
