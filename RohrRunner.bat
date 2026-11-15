@echo off
setlocal
set "APP_ROOT=%~dp0"
set "APP_URL=http://127.0.0.1:4173/"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$url='%APP_URL%'; try { $page=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; $ready=$page.StatusCode -eq 200 -and $page.Content.Contains('RohrRunner') } catch { $ready=$false }; if (-not $ready) { $q=[char]34; $serverArgs='-NoProfile -ExecutionPolicy Bypass -File ' + $q + $env:APP_ROOT + 'scripts\serve.ps1' + $q; Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $serverArgs; for ($i=0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 250; try { $page=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; $ready=$page.StatusCode -eq 200 -and $page.Content.Contains('RohrRunner'); if ($ready) { break } } catch {} } }; if (-not $ready) { exit 1 }; Start-Process $url"
if errorlevel 1 (
  echo RohrRunner konnte den lokalen Browser-Server nicht starten.
  pause
)
endlocal
