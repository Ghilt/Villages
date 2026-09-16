@echo off
rem Double-click this from Explorer, or run it from a terminal. Everything actually happens in
rem debug-quick-start.ps1 beside it; this only lets Windows run a PowerShell script without argument.
rem
rem -Hold is what makes the window worth keeping: it stays open with the servers running and q stops
rem them, rather than closing on a keypress and leaving them behind with nothing left to press.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0debug-quick-start.ps1" -Hold %*
rem Only when something went wrong, because the hold above already waited when it did not.
if errorlevel 1 (
  echo.
  pause
)
