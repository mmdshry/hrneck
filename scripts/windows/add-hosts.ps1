#Requires -RunAsAdministrator
param(
    [string]$Slug
)

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$marker = "# HRNECK local hosts"
$entries = @(
    "127.0.0.1 hrneck.test",
    "127.0.0.1 app.hrneck.test",
    "127.0.0.1 admin.hrneck.test",
    "127.0.0.1 api.hrneck.test",
    "127.0.0.1 mail.hrneck.test",
    "127.0.0.1 itneck.hrneck.test",
    "127.0.0.1 test.hrneck.test",
    "127.0.0.1 company.hrneck.test",
    "127.0.0.1 qa-audit.hrneck.test",
    # Legacy aliases (HMR / bookmarks). Prefer *.hrneck.test.
    "127.0.0.1 app.itp.test",
    "127.0.0.1 admin.itp.test",
    "127.0.0.1 api.itp.test",
    "127.0.0.1 mail.itp.test",
    "127.0.0.1 itneck.itp.test",
    "127.0.0.1 test.itp.test",
    "127.0.0.1 company.itp.test"
)

if ($Slug) {
    $slugHost = "127.0.0.1 {0}.hrneck.test" -f $Slug.Trim().ToLower()
    if ($entries -notcontains $slugHost) {
        $entries += $slugHost
    }
}

$current = Get-Content $hostsPath -ErrorAction Stop
$filtered = @()
foreach ($line in $current) {
    if ($line -eq "# ITP local hosts") {
        continue
    }
    $filtered += $line
}

Set-Content -Path $hostsPath -Value $filtered -Encoding ascii

if ($filtered -notcontains $marker) {
    Add-Content -Path $hostsPath -Value "`r`n$marker"
}

$current = Get-Content $hostsPath
foreach ($line in $entries) {
    if ($current -notcontains $line) {
        Add-Content -Path $hostsPath -Value $line
        Write-Host "Added $line"
    } else {
        Write-Host "Present $line"
    }
}

Write-Host "Hosts ready. Prefer http://hrneck.test (app.hrneck.test and legacy *.itp.test also work)."
