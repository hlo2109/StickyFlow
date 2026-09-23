#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================="
echo "       StickyFlow - Despliegue a GitHub (Git)"
echo "======================================================="
echo ""

echo "[1/3] Añadiendo archivos modificados y assets a Git..."
git add .

echo ""
echo "[2/3] Creando commit de la actualización..."
git commit -m "feat(update): actualizar documentacion publica, muestras visuales y scripts de compilacion a produccion" \
           -m "- Agregadas capturas y muestras del sistema en assets/" \
           -m "- Creados scripts Compilar-Produccion.bat y compilar-produccion.sh para compilacion con 1 clic" \
           -m "- Actualizado README.md con guia completa de funcionalidades, IA, grabacion de reuniones y mini sticks flotantes" \
           -m "- Optimizacion en deduplicacion de notas vacias y contador del sidebar" || true

echo ""
echo "[3/3] Subiendo cambios a GitHub (origin main)..."
git push origin main

echo ""
echo "======================================================="
echo "[EXITO] Despliegue completado con exito!"
echo "Repositorio: https://github.com/hlo2109/StickyFlow"
echo "======================================================="
