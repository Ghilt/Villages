@echo off
rem Double-click this from Explorer, or run it from a terminal. Everything actually happens in
rem debug-quick-start.ps1 beside it; this only lets Windows run a PowerShell script without argument.
rem
rem It starts the servers hidden and closes once they answer: they are their own processes and run on
rem without this window. debug-quick-start.ps1 -Stop ends them.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0debug-quick-start.ps1" %*
rem Only when something went wrong, so the reason stays on the screen to be read.
if errorlevel 1 (
  echo.
  pause
)
