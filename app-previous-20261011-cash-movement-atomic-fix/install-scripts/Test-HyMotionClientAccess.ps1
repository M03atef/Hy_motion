# HyMotion Local client-side connectivity check.
#
# Run this on each Reception / Manager PC after the Host reports READY:
#   .\Test-HyMotionClientAccess.ps1 -HostUrl "http://192.168.1.5:7140"

param(
    [Parameter(Mandatory = $true)][string]$HostUrl
)

$ErrorActionPreference = "Stop"

try {
    $uri = [Uri]$HostUrl.Trim().TrimEnd('/')
    if ($uri.Scheme -notin @('http', 'https') -or -not $uri.Host) {
        throw "Use a complete URL, for example http://192.168.1.5:7140"
    }

    $base = $uri.GetLeftPart([System.UriPartial]::Authority)
    $deployment = Invoke-RestMethod -Uri "$base/api/deployment/info" -TimeoutSec 10
    if ($deployment.edition -ne 'Local') {
        throw "The server responded, but it is not a HyMotion Local host."
    }

    $login = Invoke-WebRequest -UseBasicParsing -Uri "$base/auth/login/" -TimeoutSec 10
    if ($login.StatusCode -lt 200 -or $login.StatusCode -ge 300) {
        throw "The login screen returned HTTP $($login.StatusCode)."
    }

    Write-Host "PASS: This device can reach HyMotion Local at $base and load the login screen." -ForegroundColor Green
    Write-Host "Open $base/auth/login/ in the browser and sign in with this employee's own account." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "FAIL: This device cannot use HyMotion at '$HostUrl'." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Check that the Host is on, the service is running, both devices are on the same gym network, and the Host URL is correct." -ForegroundColor Yellow
    exit 1
}
