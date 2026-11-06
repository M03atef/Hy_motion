@echo off
setlocal EnableDelayedExpansion
title HyMotion - SQL Server Express Automated Setup

:: 1. Check for Administrative privileges safely
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if %errorlevel% neq 0 (
    echo ========================================================
    echo  Requesting Administrator privileges...
    echo ========================================================
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Set working directory to the folder containing this script
cd /d "%~dp0"

echo ========================================================
echo   HyMotion - SQL Server Express Automated Installer
echo ========================================================
echo Current Folder: %~dp0
echo.

:: 2. Check if SQL Server service is already installed and running
sc query "MSSQL$SQLEXPRESS" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] SQL Server (SQLEXPRESS) is ALREADY INSTALLED on this machine!
    echo Ensuring service is started...
    net start "MSSQL$SQLEXPRESS" >nul 2>&1
    sc config "MSSQL$SQLEXPRESS" start= auto >nul 2>&1
    echo.
    echo ========================================================
    echo  [SUCCESS] SQL Server (SQLEXPRESS) is active and running!
    echo  You do NOT need to install it again.
    echo  Open HyMotionSetup.exe and click "Check SQL".
    echo ========================================================
    echo.
    pause
    exit /b 0
)

:: 3. Find the best installer file
set "INSTALLER="

if exist "%~dp0SQLEXPR_x64_ENU\SETUP.EXE" (
    set "INSTALLER="%~dp0SQLEXPR_x64_ENU\SETUP.EXE""
    echo [INFO] Found extracted installer: SQLEXPR_x64_ENU\SETUP.EXE
) else if exist "%~dp0SETUP.EXE" (
    set "INSTALLER="%~dp0SETUP.EXE""
    echo [INFO] Found SETUP.EXE
) else if exist "%~dp0SQLEXPR_x64_ENU.exe" (
    set "INSTALLER="%~dp0SQLEXPR_x64_ENU.exe""
    echo [INFO] Found package: SQLEXPR_x64_ENU.exe
)

if not defined INSTALLER (
    echo [ERROR] No SQL Server installer found in this directory!
    echo Expected one of:
    echo   - %~dp0SQLEXPR_x64_ENU\SETUP.EXE
    echo   - %~dp0SQLEXPR_x64_ENU.exe
    echo   - %~dp0SETUP.EXE
    echo.
    pause
    exit /b 1
)

echo.
echo [INFO] Starting SQL Server Express Installation...
echo [INFO] This will take 2 to 4 minutes. Please wait...
echo.

:: Run setup using robust, modern parameters (compatible with 2019/2022/2025)
!INSTALLER! /qs /ACTION=Install /FEATURES=SQLEngine /INSTANCENAME=SQLEXPRESS /SQLSYSADMINACCOUNTS="BUILTIN\Administrators" /TCPENABLED=1 /NPENABLED=1 /IACCEPTSQLSERVERLICENSETERMS /UpdateEnabled=False /SkipRules=RebootRequiredCheck

set "EXIT_CODE=%errorlevel%"
echo.
echo ========================================================
echo  Installer finished with Exit Code: %EXIT_CODE%
echo ========================================================

if "%EXIT_CODE%"=="0" (
    echo  [SUCCESS] SQL Server Express installed successfully!
    sc config "MSSQL$SQLEXPRESS" start= auto >nul 2>&1
    net start "MSSQL$SQLEXPRESS" >nul 2>&1
    echo  Service started and configured to Automatic.
    echo.
    echo  Next Step: Open HyMotionSetup.exe -> Check SQL.
) else if "%EXIT_CODE%"=="3010" (
    echo  [SUCCESS] SQL Server installed successfully (Reboot recommended by Windows).
    sc config "MSSQL$SQLEXPRESS" start= auto >nul 2>&1
    net start "MSSQL$SQLEXPRESS" >nul 2>&1
    echo.
    echo  Next Step: Open HyMotionSetup.exe -> Check SQL.
) else (
    echo  [ERROR] Installation failed or did not complete normally.
    echo.
    echo  Checking SQL Setup summary log for exact error:
    echo  --------------------------------------------------------
    powershell -NoProfile -Command "Get-ChildItem 'C:\Program Files\Microsoft SQL Server\*\Setup Bootstrap\Log\summary.txt' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ForEach-Object { Get-Content $_.FullName | Select-String 'Error|Failed|Rules' -Context 0,2 | Select-Object -First 10 }"
    echo  --------------------------------------------------------
    echo  Full log is located at: C:\Program Files\Microsoft SQL Server\
)

echo.
pause
