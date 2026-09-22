@echo off
title Compilador de StickyFlow para Windows
echo ===================================================
echo     Compilador de StickyFlow para Windows
echo ===================================================
echo.
echo Selecciona el tipo de compilacion:
echo  1. Instalador Oficial Windows Setup (Recomendado)
echo  2. Version Portable (.exe autonomo)
echo  3. Compilar Ambos (Setup + Portable)
echo.
set /p opcion="Elige una opcion (1, 2 o 3, por defecto 1): "

if "%opcion%"=="2" (
    call npm run build:portable
) else if "%opcion%"=="3" (
    call npm run build:all
) else (
    call npm run build:installer
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo  [EXITO] Compilacion completada con exito!
    echo  Archivos listos en la carpeta 'release':
    echo    - StickyFlow-Setup-1.0.0.exe (Instalador con accesos directos)
    echo    - win-unpacked\StickyFlow.exe (Arranque instantaneo)
    echo    - StickyFlow-Portable.exe (Version portable USB)
    echo ===================================================
    echo Abriendo carpeta release...
    start release
) else (
    echo.
    echo [ERROR] Hubo un problema al generar el ejecutable.
)

pause
