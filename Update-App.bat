@echo off
REM HyMotion Local update helper. The app folder is never mirrored from an arbitrary
REM app-new folder because that can replace a working Host with an incomplete build.
echo Opening HyMotion Setup with Administrator approval...
echo It keeps the existing gym data in ProgramData and installs the verified app files.
powershell.exe -NoProfile -Command "Start-Process -FilePath '%~dp0HyMotionSetup.exe' -Verb RunAs"
