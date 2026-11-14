@echo off
:: Baja la última versión de GitHub y recompila la interfaz. Cierra StickyFlow antes de ejecutarlo.
cd /d "%~dp0"
git pull origin main
call npm install --no-audit --no-fund
call npm run build
echo.
echo Listo. Abre StickyFlow con Iniciar-StickyFlow.bat
pause
