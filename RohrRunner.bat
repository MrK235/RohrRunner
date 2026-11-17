@echo off
setlocal
cd /d "%~dp0"
if not defined ROHRRUNNER_PORT set "ROHRRUNNER_PORT=4173"
start "" /b cmd /c "node scripts\serve.mjs >nul 2>&1"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:%ROHRRUNNER_PORT%/"
endlocal
