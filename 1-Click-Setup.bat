@echo off
REM Host-PC setup: elevation installs the automatic Windows service and the LAN-only firewall rule.
powershell.exe -NoProfile -Command "Start-Process -FilePath '%~dp0HyMotionSetup.exe' -Verb RunAs"
