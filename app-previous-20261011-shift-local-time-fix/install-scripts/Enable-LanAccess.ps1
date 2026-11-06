# Enables other gym PCs on the same LAN to open HyMotion Local served by this Host PC.
#
# Creates a tight inbound Windows Firewall rule for the HyMotion API port only (TCP, default
# 7140, local subnet only) and prints the URLs to open from other PCs. Safe to re-run (the rule
# is replaced, never duplicated).
#
# Usage: .\Enable-LanAccess.ps1
#        .\Enable-LanAccess.ps1 -Port 7140
#
# Run this on the HOST PC (the one running the HyMotion service). Must be elevated.
#
# What this deliberately does NOT do:
#   - It never opens SQL Server (1433 or the SQLEXPRESS dynamic port) to the LAN. Client PCs
#     talk to the HyMotion API over HTTP only; the database stays local to the Host PC.
#   - It does not change any other firewall state.

param(
    [int]$Port = 7140,
    [string]$RuleName = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RuleName)) {
    $RuleName = "HyMotion Local API (TCP $Port)"
}

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Host "This script must be run as Administrator (creating a firewall rule requires it)." -ForegroundColor Red
    exit 1
}

Write-Host "==> Creating inbound firewall rule '$RuleName' (TCP $Port, local subnet only)..." -ForegroundColor Cyan
# Idempotent: drop any previous rule with this name first (delete reports "not found" as a
# nonzero exit code - that is expected and ignored), then add fresh. remoteip=localsubnet keeps
# the rule scoped to the gym's own network segment; profile=any covers Domain/Private/Public
# network classifications (gym LANs are frequently classified Public by Windows).
netsh advfirewall firewall delete rule name="$RuleName" | Out-Null
netsh advfirewall firewall add rule name="$RuleName" dir=in action=allow protocol=TCP localport=$Port remoteip=localsubnet profile=any | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not create the firewall rule (netsh exit code $LASTEXITCODE)." -ForegroundColor Red
    exit 1
}
Write-Host "Firewall rule created." -ForegroundColor Green

Write-Host ""
Write-Host "==> LAN addresses other PCs can use to open HyMotion:" -ForegroundColor Cyan
$found = $false
foreach ($nic in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($nic.OperationalStatus -ne [System.Net.NetworkInformation.OperationalStatus]::Up) { continue }
    if ($nic.NetworkInterfaceType -eq [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback) { continue }
    foreach ($addr in $nic.GetIPProperties().UnicastAddresses) {
        $ip = $addr.Address
        if ($ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { continue }
        if ([System.Net.IPAddress]::IsLoopback($ip)) { continue }
        $bytes = $ip.GetAddressBytes()
        if ($bytes[0] -eq 169 -and $bytes[1] -eq 254) { continue }  # self-assigned, not reachable from other PCs
        Write-Host "    http://$($ip):$Port" -ForegroundColor Green
        $found = $true
    }
}
if (-not $found) {
    Write-Host "    (none found - connect this PC to the gym network and re-run)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "On other PCs, open one of the addresses above in a browser and sign in normally." -ForegroundColor Green
Write-Host "Notes:" -ForegroundColor Green
Write-Host "  - Each PC signs in with its own HyMotion user; roles/permissions follow the user, not the PC."
Write-Host "  - If the Host PC's IP changes (DHCP), re-run this script to see the new address." -ForegroundColor Green
Write-Host "    A static IP or DHCP reservation for the Host PC on the router avoids that entirely."
Write-Host "  - SQL Server is NOT exposed to the LAN by this rule."
