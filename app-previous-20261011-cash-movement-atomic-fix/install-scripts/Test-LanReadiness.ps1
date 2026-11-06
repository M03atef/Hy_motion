# HyMotion Local host readiness check.
#
# Run this ON THE HOST PC after setup, preferably as Administrator:
#   .\install-scripts\Test-LanReadiness.ps1
#
# Exit 0 means the Host is ready to accept same-network gym PCs.  It deliberately does not
# expose SQL Server; clients must reach only HyMotion over TCP 7140.

param(
    [int]$Port = 7140,
    [string]$ServiceName = "HyMotion"
)

$ErrorActionPreference = "Stop"
$failures = 0

function Pass([string]$Message) {
    Write-Host ("PASS  " + $Message) -ForegroundColor Green
}

function Fail([string]$Message) {
    $script:failures++
    Write-Host ("FAIL  " + $Message) -ForegroundColor Red
}

function Warn([string]$Message) {
    Write-Host ("WARN  " + $Message) -ForegroundColor Yellow
}

Write-Host "HyMotion LAN readiness check" -ForegroundColor Cyan
Write-Host "Host PC only. Client PCs connect to http://<host-ip>:$Port" -ForegroundColor Cyan
Write-Host ""

# 1. The service is what keeps the gym online after logout/restart, without relying on a desk
# launcher remaining open in a particular Windows profile.
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
    Fail "The HyMotion Windows service is not installed. Run HyMotionSetup.exe as Administrator on this Host PC."
} elseif ($service.Status -ne 'Running') {
    Fail "The HyMotion service is $($service.Status), not Running. Start it, then run this check again."
} else {
    Pass "HyMotion Windows service is running."
}

# 2. Prove the application is listening and responding locally.  A listening port alone can be
# another program; the health and deployment endpoints prove it is the Local HyMotion host.
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
# On some Windows builds a non-elevated shell cannot enumerate a listener owned by
# NETWORK SERVICE, even though the port is genuinely open. netstat exposes the same
# listener without requiring elevation, so use it as a read-only fallback rather than
# reporting the Host as offline.
if ($null -eq $listener) {
    $listener = netstat.exe -ano -p tcp 2>$null |
        Select-String -Pattern ("^\s*TCP\s+\S*:$Port\s+") |
        Select-Object -First 1
}
if ($null -eq $listener) {
    Fail "Nothing is listening on TCP $Port. Check the HyMotion service and its logs."
} else {
    Pass "TCP $Port is listening."
}

try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 8
    if ($health.StatusCode -ge 200 -and $health.StatusCode -lt 300) {
        Pass "Local health endpoint responds ($($health.StatusCode))."
    } else {
        Fail "Local health endpoint returned HTTP $($health.StatusCode)."
    }
} catch {
    Fail "Local health endpoint cannot be reached: $($_.Exception.Message)"
}

try {
    $deployment = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/deployment/info" -TimeoutSec 8
    if ($deployment.edition -eq 'Local') {
        Pass "The running application reports Local edition."
    } else {
        Fail "The running application did not report Local edition."
    }
} catch {
    Fail "HyMotion API cannot be verified locally: $($_.Exception.Message)"
}

# 3. Windows Firewall rule.  It is intentionally only TCP 7140 and only the local subnet;
# database ports remain closed to the LAN.
$ruleName = "HyMotion Local API (TCP $Port)"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
    Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' } |
    Select-Object -First 1
# Firewall cmdlets can likewise return no data to a standard user. netsh remains
# read-only here and lets the preflight accurately recognise the rule created by Setup.
if ($null -eq $rule) {
    $ruleText = (netsh.exe advfirewall firewall show rule name="$ruleName" 2>$null | Out-String)
    if ($ruleText -match '(?im)^\s*Enabled:\s+Yes\s*$' -and
        $ruleText -match '(?im)^\s*Direction:\s+In\s*$' -and
        $ruleText -match '(?im)^\s*Action:\s+Allow\s*$' -and
        $ruleText -match '(?im)^\s*LocalPort:\s+' + [regex]::Escape([string]$Port) + '\s*$') {
        $rule = $true
    }
}
if ($null -eq $rule) {
    Fail "Firewall rule '$ruleName' is missing or disabled. Run Enable-LanAccess.ps1 as Administrator."
} else {
    Pass "LAN-only inbound firewall rule is enabled."
}

# 4. Give the exact URLs that reception/manager devices should test.  Avoid loopback, APIPA,
# and IPv6 addresses because they are not usable browser URLs for other typical gym devices.
$ips = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object {
        $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and
        $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback
    } |
    ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
    Where-Object {
        $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        -not [System.Net.IPAddress]::IsLoopback($_.Address) -and
        -not ($_.Address.GetAddressBytes()[0] -eq 169 -and $_.Address.GetAddressBytes()[1] -eq 254)
    } |
    ForEach-Object { $_.Address.IPAddressToString } |
    Sort-Object -Unique

if (@($ips).Count -eq 0) {
    Fail "No usable IPv4 LAN address was found. Connect the Host PC to the gym router/switch."
} else {
    Pass "Host LAN address(es):"
    foreach ($ip in $ips) { Write-Host "      http://$ip`:$Port" -ForegroundColor Green }
}

Write-Host ""
if ($failures -eq 0) {
    Write-Host "READY: On each Reception/Manager device, open one URL above and sign in with that employee's own account." -ForegroundColor Green
    Write-Host "For the final proof from each client PC, run Test-HyMotionClientAccess.ps1 -HostUrl http://<host-ip>:$Port." -ForegroundColor Green
    exit 0
}

Write-Host "NOT READY: Fix the failed item(s), then rerun this check before opening the gym." -ForegroundColor Red
exit 1
