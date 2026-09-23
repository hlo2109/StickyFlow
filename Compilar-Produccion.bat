@echo off
title StickyFlow - Compilar a Produccion
cd /d "%~dp0"

echo =======================================================
echo          StickyFlow - Compilacion a Produccion
echo =======================================================
echo.
echo [1/3] Limpiando y empaquetando frontend con Vite...
echo [2/3] Generando ejecutables para Windows con Electron Builder...
echo       - Instalador NSIS (Setup)
echo       - Version Portable
echo       - Version win-unpacked (inicio instantaneo)
echo.

call npm run build:all

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo =======================================================
    echo [ERROR] La compilacion ha fallado. Revisa los errores arriba.
    echo =======================================================
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =======================================================
echo [EXITO] Compilacion a produccion completada con exito!
echo =======================================================
echo.
echo Artefactos generados en la carpeta "release\":
echo   * Instalador: release\StickyFlow-Setup-1.0.0.exe
echo   * Portable:   release\StickyFlow-Portable.exe
echo   * Unpacked:   release\win-unpacked\StickyFlow.exe
echo.
echo Ya puedes ejecutar "Abrir-StickyFlow.bat" o distribuir los instaladores.
echo.
pause
