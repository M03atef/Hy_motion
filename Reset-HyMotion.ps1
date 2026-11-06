# HyMotion Local Edition - Comprehensive Factory Reset Tool
# Stops service, kills processes, automatically drops the SQL database across any local instance,
# and cleans %ProgramData%\HyMotion.
#
# Requires: Run as Administrator.
# Works natively with .NET System.Data.SqlClient (NO sqlcmd.exe required).

param(
    [string]$DatabaseName = "HyMotionLocal",
    [string]$ServiceName = "HyMotion",
    [switch]$Force
)

$ErrorActionPreference = "Continue"

# 1. Require Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script MUST be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click -> 'Run as administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       HyMotion Local Edition - Factory Reset Tool        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Are you sure you want to completely RESET HyMotion and DROP the database '$DatabaseName'? (Y/N)"
    if ($confirm -ne 'Y' -and $confirm -ne 'y') {
        Write-Host "Reset cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
# Step 1: Stop and remove Windows service
Write-Host "[1/4] Checking and stopping Windows service '$ServiceName'..." -ForegroundColor Cyan
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    try {
        if ($svc.Status -ne "Stopped") {
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        & sc.exe delete $ServiceName | Out-Null
        Write-Host "   -> Service '$ServiceName' stopped and deleted." -ForegroundColor Green
    } catch {
        Write-Host "   -> Warning deleting service: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   -> Service '$ServiceName' is not installed." -ForegroundColor Gray
}

# Step 2: Kill any running GMS.Api processes
Write-Host "[2/4] Terminating any running GMS.Api / HyMotion processes..." -ForegroundColor Cyan
$processes = Get-Process -Name "GMS.Api" -ErrorAction SilentlyContinue
if ($processes) {
    foreach ($p in $processes) {
        try {
            $p.Kill()
            Write-Host "   -> Killed process GMS.Api (PID $($p.Id))" -ForegroundColor Green
        } catch {}
    }
} else {
    Write-Host "   -> No GMS.Api processes running." -ForegroundColor Gray
}

# Step 3: Discover SQL Server instances and drop the database
Write-Host "[3/4] Searching for SQL Server instances to drop database '$DatabaseName'..." -ForegroundColor Cyan

function Get-SqlInstances {
    $regPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
    $servers = @()
    if (Test-Path $regPath) {
        $names = (Get-ItemProperty -Path $regPath).PSObject.Properties |
            Where-Object { $_.Name -notlike "PS*" } |
            Select-Object -ExpandProperty Name
        foreach ($name in $names) {
            if ($name -eq "MSSQLSERVER") { $servers += "." }
            else { $servers += ".\$name" }
        }
    }
    if ($servers.Count -eq 0) {
        $servers += ".\SQLEXPRESS"
        $servers += "."
    }
    return $servers | Select-Object -Unique
}

$instances = Get-SqlInstances
$droppedAny = $false

foreach ($serverObj in $instances) {
    $server = [string]$serverObj
    Write-Host "   Scanning SQL Server instance: $server ..." -ForegroundColor Gray
    try {
        $csb = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
        $csb["Server"] = $server
        $csb["Integrated Security"] = $true
        $csb["TrustServerCertificate"] = $true
        $csb["Initial Catalog"] = "master"
        $csb["Connect Timeout"] = 4

        $conn = New-Object System.Data.SqlClient.SqlConnection($csb.ConnectionString)
        $conn.Open()

        $cmd = $conn.CreateCommand()
        $dbEscaped = $DatabaseName.Replace("'", "''")
        $cmd.CommandText = "SELECT DB_ID(N'$dbEscaped')"
        $dbId = $cmd.ExecuteScalar()

        if ($dbId -ne $null -and -not [DBNull]::Value.Equals($dbId)) {
            Write-Host "   -> Found database [$DatabaseName] on $server! Dropping..." -ForegroundColor Yellow
            $dropCmd = $conn.CreateCommand()
            $dbBracketed = $DatabaseName.Replace("]", "]]")
            $dropCmd.CommandText = "ALTER DATABASE [$dbBracketed] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$dbBracketed];"
            $dropCmd.ExecuteNonQuery() | Out-Null
            Write-Host "   -> [SUCCESS] Database [$DatabaseName] dropped from $server!" -ForegroundColor Green
            $droppedAny = $true
        } else {
            Write-Host "   -> Database [$DatabaseName] does not exist on $server (already clean)." -ForegroundColor Gray
        }
        $conn.Close()
    } catch {
        Write-Host "   -> Could not connect to instance $server : $($_.Exception.Message)" -ForegroundColor DarkGray
    }
}

if (-not $droppedAny) {
    Write-Host "   -> No existing database named '$DatabaseName' was found to drop." -ForegroundColor Yellow
}

# Step 4: Clean ProgramData folder
Write-Host "[4/4] Cleaning local app data (%ProgramData%\HyMotion)..." -ForegroundColor Cyan
$progData = Join-Path $env:ProgramData "HyMotion"
if (Test-Path $progData) {
    try {
        # Keep Backups if desired, or remove config and runtime data
        $configFolder = Join-Path $progData "config"
        if (Test-Path $configFolder) { Remove-Item $configFolder -Recurse -Force -ErrorAction SilentlyContinue }
        $logsFolder = Join-Path $progData "logs"
        if (Test-Path $logsFolder) { Remove-Item $logsFolder -Recurse -Force -ErrorAction SilentlyContinue }
        $uploadsFolder = Join-Path $progData "uploads"
        if (Test-Path $uploadsFolder) { Remove-Item $uploadsFolder -Recurse -Force -ErrorAction SilentlyContinue }
        
        # Remove entire folder if empty or force remove
        Remove-Item $progData -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "   -> Removed %ProgramData%\HyMotion folder." -ForegroundColor Green
    } catch {
        Write-Host "   -> Warning cleaning ProgramData: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   -> ProgramData\HyMotion does not exist." -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [DONE] Machine has been cleanly RESET!" -ForegroundColor Green
Write-Host " You can now run HyMotionSetup.exe fresh." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
