@echo off
title StickyFlow - Desplegar a GitHub
cd /d "%~dp0"

echo =======================================================
echo          StickyFlow - Despliegue a GitHub (Git)
echo =======================================================
echo.

:: Verificar si git esta instalado
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git no esta instalado o no esta en el PATH.
    pause
    exit /b 1
)

echo [1/3] Agregando cambios y nuevas muestras de assets a Git...
git add .

echo.
echo [2/3] Creando commit con la documentacion y novedades de la actualizacion...
git commit -m "feat(update): actualizar documentacion publica, muestras visuales y scripts de compilacion a produccion" -m "- Agregadas capturas y muestras del sistema en assets/" -m "- Creados scripts Compilar-Produccion.bat y compilar-produccion.sh para compilacion con 1 clic" -m "- Actualizado README.md con guia completa de funcionalidades, IA, grabacion de reuniones y mini sticks flotantes" -m "- Optimizacion en deduplicacion de notas vacias y contador del sidebar"

echo.
echo [3/3] Subiendo cambios a la rama principal (main)...
git push origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo =======================================================
    echo [ERROR] Hubo un problema al hacer push a GitHub.
    echo Verifica tus credenciales o conexion a internet.
    echo =======================================================
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =======================================================
echo [EXITO] Cambios desplegados correctamente en GitHub!
echo Repositorio: https://github.com/hlo2109/StickyFlow
echo =======================================================
echo.
pause
