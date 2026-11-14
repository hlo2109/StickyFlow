@echo off
:: Inicia StickyFlow con el Electron oficial, directamente desde esta carpeta (sin instalador).
:: Sirve cuando Windows bloquea un .exe nuevo sin firma (Control inteligente de aplicaciones): el electron.exe oficial
:: ya es conocido por Windows. La primera vez compila la interfaz si hace falta.
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Instalando dependencias, solo la primera vez...
  call npm install --no-audit --no-fund
)
if not exist "dist\index.html" (
  echo Compilando StickyFlow, solo la primera vez...
  call npm run build
)
start "" "node_modules\electron\dist\electron.exe" . %*
exit /b 0
