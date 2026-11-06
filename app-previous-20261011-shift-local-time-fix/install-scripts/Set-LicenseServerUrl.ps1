# Writes LicenseServer:BaseUrl into the Local config override without replacing SQL settings
# and without overwriting an existing BaseUrl.
#
# Usage:
#   .\Set-LicenseServerUrl.ps1 -BaseUrl "http://127.0.0.1:5001"
#   .\Set-LicenseServerUrl.ps1 -BaseUrl "https://your-api-origin" -ConfigRoot "$env:ProgramData\HyMotion"
#   $env:HYMOTION_LICENSE_SERVER_URL = "http://127.0.0.1:5001"; .\Set-LicenseServerUrl.ps1
#
# Use the Platform API origin (never Vite / Platform Console). No secrets belong here.

param(
    [string]$BaseUrl = "",
    [string]$ConfigRoot = "",
    [switch]$Overwrite
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl) { $BaseUrl = $env:HYMOTION_LICENSE_SERVER_URL }
if (-not $BaseUrl) { throw "Pass -BaseUrl or set HYMOTION_LICENSE_SERVER_URL." }

$BaseUrl = $BaseUrl.Trim().TrimEnd("/")

if (-not $ConfigRoot) { $ConfigRoot = $env:HYMOTION_DATA_DIR }
if (-not $ConfigRoot) { $ConfigRoot = Join-Path $env:ProgramData "HyMotion" }

$configDir = Join-Path $ConfigRoot "config"
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$configFile = Join-Path $configDir "appsettings.json"

$existing = New-Object PSObject
if (Test-Path $configFile) {
    try { $existing = Get-Content $configFile -Raw | ConvertFrom-Json } catch { $existing = New-Object PSObject }
}

if (-not (Get-Member -InputObject $existing -Name "LicenseServer" -MemberType NoteProperty)) {
    $existing | Add-Member -MemberType NoteProperty -Name "LicenseServer" -Value (New-Object PSObject)
}
if (-not (Get-Member -InputObject $existing.LicenseServer -Name "BaseUrl" -MemberType NoteProperty)) {
    $existing.LicenseServer | Add-Member -MemberType NoteProperty -Name "BaseUrl" -Value $BaseUrl
} elseif ($Overwrite -or [string]::IsNullOrWhiteSpace([string]$existing.LicenseServer.BaseUrl)) {
    $existing.LicenseServer.BaseUrl = $BaseUrl
} else {
    Write-Host ("LicenseServer:BaseUrl already set in {0} — leaving it. Use -Overwrite to replace." -f $configFile) -ForegroundColor Yellow
    exit 0
}

($existing | ConvertTo-Json -Depth 6) | Set-Content -Path $configFile -Encoding utf8
Write-Host "Wrote LicenseServer:BaseUrl=$BaseUrl to $configFile" -ForegroundColor Green
Write-Host "Restart the HyMotion service so Local picks it up. Gym desk traffic after activation does not need this URL."
