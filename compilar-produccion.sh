#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================="
echo "         StickyFlow - Compilacion a Produccion"
echo "======================================================="
echo ""
echo "[1/2] Compilando frontend con Vite..."
echo "[2/2] Empaquetando para Windows (NSIS y Portable)..."
echo ""

npm run build:all

echo ""
echo "======================================================="
echo "[EXITO] Compilacion completada con exito!"
echo "Archivos generados en release/:"
ls -lh release/*.exe 2>/dev/null || true
echo "======================================================="
