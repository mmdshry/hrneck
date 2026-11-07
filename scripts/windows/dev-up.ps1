param(
  [switch]$MigrateOnly,
  [switch]$SkipStart
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$api = Join-Path $root "apps\api"
$web = Join-Path $root "apps\web"
$caddyfile = Join-Path $root "scripts\windows\Caddyfile"

function Test-TcpPort([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(400)
    if ($ok -and $client.Connected) {
      $client.EndConnect($async)
      $client.Close()
      return $true
    }
    $client.Close()
  } catch {
    # port closed
  }
  return $false
}

function Start-DevWindow([string]$Title, [string]$WorkingDirectory, [string]$Command) {
  $escapedDir = $WorkingDirectory.Replace("'", "''")
  $script = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location '$escapedDir'
Write-Host '==> $Title' -ForegroundColor Cyan
$Command
"@
  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $script
  ) | Out-Null
  Write-Host ("  started: {0}" -f $Title) -ForegroundColor Green
}

Write-Host "==> Checking tools"
php -v | Select-Object -First 1
node -v
composer -V | Select-Object -First 1
redis-cli ping
& C:\xampp\mysql\bin\mysql.exe -u root -e "SELECT 1" | Out-Null

Write-Host "==> Migrating & seeding API"
Push-Location $api
php artisan migrate --force
php artisan db:seed --force
Pop-Location

if ($MigrateOnly -or $SkipStart) {
  Write-Host "==> Migrate/seed done (start skipped)."
  exit 0
}

Write-Host "==> Starting platform processes (including Reverb WebSocket)"

# Optional helpers — skip quietly if binary missing / already bound.
if (Get-Command caddy -ErrorAction SilentlyContinue) {
  if (-not (Test-TcpPort 80)) {
    Start-DevWindow "HRNECK Caddy" $root "caddy run --config `"$caddyfile`""
  } else {
    Write-Host "  skip Caddy (:80 already in use — stop XAMPP Apache if needed)" -ForegroundColor DarkYellow
  }
} else {
  Write-Host "  skip Caddy (caddy not on PATH)" -ForegroundColor DarkYellow
}

if (-not (Test-TcpPort 8000)) {
  Start-DevWindow "HRNECK API" $api "php artisan serve --host=127.0.0.1 --port=8000"
} else {
  Write-Host "  skip API serve (:8000 already in use)" -ForegroundColor DarkYellow
}

# Reverb is required for live MSP/org WebSocket pages — always start by default.
if (-not (Test-TcpPort 8080)) {
  Start-DevWindow "HRNECK Reverb" $api "php artisan reverb:start"
} else {
  Write-Host "  skip Reverb (:8080 already in use)" -ForegroundColor DarkYellow
}

if (-not (Test-TcpPort 3100)) {
  Start-DevWindow "HRNECK Web" $web "pnpm dev --hostname 127.0.0.1 --port 3100"
} else {
  Write-Host "  skip Next (:3100 already in use)" -ForegroundColor DarkYellow
}

Write-Host @"

Platform windows launched.
  API     http://127.0.0.1:8000
  Reverb  ws://127.0.0.1:8080  (live WebSocket)
  Web     http://127.0.0.1:3100
  App     http://hrneck.test

Demo login: admin@hrneck.test / DemoPass!234
Hosts: hrneck.test | app.hrneck.test | admin.hrneck.test/admin | itneck.hrneck.test | test.hrneck.test | company.hrneck.test

Tips:
  Stop XAMPP Apache if Caddy cannot bind :80
  Horizon is optional on Windows: cd apps\api; php artisan horizon
  Migrate only: .\scripts\windows\dev-up.ps1 -MigrateOnly
"@
