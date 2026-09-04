@echo off
rem Double-click this from Explorer, or run it from a terminal. Everything actually happens in
rem debug-quick-start.ps1 beside it; this only lets Windows run a PowerShell script without argument.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0debug-quick-start.ps1" %*
echo.
pause
