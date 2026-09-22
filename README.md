# 📌 StickyFlow — Bloc de Notas Flotante e Inteligente para Windows

<div align="center">

![Windows](https://img.shields.io/badge/Plataforma-Windows%2010%20%2F%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-44.4-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)

**Un bloc de notas de escritorio ultraligero, siempre visible y personalizable, potenciado con Inteligencia Artificial, dictado por voz, actas automáticas de reuniones y mini sticks flotantes estilo post-it.**

[Descargar Instalador](#-instalación-y-descarga) • [Características](#-características-destacadas) • [Atajos de Teclado](#-atajos-de-teclado) • [Configuración de IA](#-configuración-de-ia-y-modelos) • [Seguridad y Privacidad](#-seguridad-y-privacidad)

</div>

---

## ✨ ¿Qué es StickyFlow?

**StickyFlow** combina la inmediatez y simpleza de las notas adhesivas clásicas de papel con el poder de un editor moderno enriquecido, Markdown nativo, modelos de lenguaje (Hugging Face y Claude) y grabación inteligente de reuniones.

Diseñado para profesionales, desarrolladores y estudiantes que necesitan anotar ideas al instante sin perder el foco ni tapar su flujo de trabajo.

---

## 🌟 Características Destacadas

### 📌 1. Ventana Siempre Flotante y Mini Sticks de Pantalla
- **Modo Siempre Visible (`Always on Top`):** Mantén tus notas flotando sobre cualquier programa, juego o navegador.
- **Mini Sticks de Papel (Recordatorios Flotantes):** ¿Quieres tener varios recordatorios dispersos en tu escritorio? Desprende cualquier nota como un mini stick independiente estilo post-it con su color, título y resumen. Puedes tener tantos como quieras repartidos en tus monitores.
- **Acceso Inmediato:** Haz clic en cualquier mini stick flotante para que la app principal se abra y te lleve directamente a esa nota en pantalla completa.

### 📝 2. Editor Híbrido: Texto Enriquecido + Markdown Real
- Escribe con formato visual (negrita, cursiva, encabezados, listas de tareas interactivas `- [ ]`, imágenes pegadas directamente con `Ctrl+V`).
- Alterna en cualquier momento al modo **Código Markdown puro** para editar la sintaxis directamente.
- **Bitácora Automática con F5:** Presiona `F5` para insertar una marca de tiempo automática (`📅 [2026-09-21 18:30] - `) y registrar la trazabilidad de tus actividades diarias.

### 🤖 3. Asistente de IA Integrado (Hugging Face Router + Claude)
- **Modelos de Vanguardia:** Conectado directamente a `openai/gpt-oss-120b` mediante Hugging Face Router y a **Claude 3.5 Sonnet** de Anthropic.
- **Acciones Rápidas con 1 Clic:**
  - 📄 **Resumir nota:** Extrae los puntos esenciales de textos largos.
  - 🪄 **Mejorar redacción:** Corrige tono, claridad y estilo profesional.
  - ☑️ **Extraer To-Do:** Convierte párrafos en listas de tareas pendientes accionables.
  - ✍️ **Corregir ortografía y gramática.**
- **Inserción Directa:** Al terminar, pulsa *“Insertar en nota actual”*, *“Reemplazar”* o *“Crear nueva nota”* y el modal se cerrará dejándote exactamente en tu nota lista.

### 💡 4. Creación de Notas desde Ideas Sueltas
- No necesitas estructurar antes de escribir: ve a la pestaña **"Crear desde Ideas"**, pega tus pensamientos desordenados o apuntes rápidos y la IA redactará una nota profesional completa, con títulos, secciones lógicas y viñetas organizadas.

### 🎙️ 5. Dictado por Voz en Tiempo Real (Micrófono)
- Presiona el botón de **Dictar (🎙️)**, habla de forma natural en español y tu voz se convertirá en texto al instante en la nota mediante Whisper AI (`openai/whisper-large-v3-turbo`).

### 🎧 6. Modo Reunión Inteligente (Audio de Sistema + Micrófono)
- Graba reuniones virtuales completas (Google Meet, Zoom, Microsoft Teams, Discord o llamadas web).
- Captura de forma mezclada tanto lo que hablan los demás (audio del sistema) como tu propio micrófono.
- Visualiza la transcripción en directo mientras anotas acuerdos manuales.
- Al terminar la reunión, presiona **"Generar Minuta con IA"** para obtener un acta estructurada con acuerdos, compromisos, responsables y tareas pendientes.

### 📂 7. Guardado Local Transparente y Conexión con Claude Desktop
- Todas tus notas se sincronizan automáticamente en tu disco local como archivos Markdown limpios (`.md`) con encabezados YAML en:
  ```
  📁 Documentos\StickyFlow_Notas\
  ```
- **Sin bloqueos propietarios:** Puedes abrir tus notas con Obsidian, VS Code, Notepad o Claude Desktop directamente.
- Botón **"Claude"** en la barra superior para copiar un prompt contextualizado con la nota y toda su bitácora de actividad.

---

## 📥 Instalación y Descarga

Tienes 3 opciones sencillas para utilizar StickyFlow en Windows:

### Opción A: Instalador Oficial Windows Setup (Recomendado)
1. Ejecuta el archivo instalador:
   ```
   release\StickyFlow-Setup-1.0.0.exe
   ```
2. Sigue el asistente de instalación. Creará accesos directos automáticos en el **Escritorio** y en el **Menú Inicio**.
3. Permite elegir la carpeta de instalación y preserva tus notas aunque decidas desinstalar la app.

### Opción B: Versión Portable (Sin instalación)
- Lleva la aplicación en una memoria USB o ejecútala en cualquier PC sin instalar nada:
  ```
  release\StickyFlow-Portable.exe
  ```

### Opción C: Inicio Instantáneo sin Esperas (0.2s)
- Si deseas que la app abra al instante sin descompresión temporal:
  ```
  Abrir-StickyFlow.bat
  ```
  *(O mediante el script invisible `StickyFlow-Silencioso.vbs`)*

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|---|---|
| `Ctrl + N` | Crear una nueva nota en blanco |
| `Ctrl + B` | Mostrar u ocultar el panel lateral de notas |
| `F5` | Insertar marca de fecha y hora para bitácora |
| `Ctrl + B` *(en texto)* | Aplicar formato **Negrita** |
| `Ctrl + I` *(en texto)* | Aplicar formato *Cursiva* |
| `Ctrl + V` | Pegar texto o **imágenes directamente del portapapeles** |

---

## ⚙️ Configuración de IA y Modelos

Para utilizar las funciones de Inteligencia Artificial:

1. Abre StickyFlow y haz clic en el icono de **Ajustes (⚙️)** en la cabecera.
2. En la pestaña **"IA & Modelos"**:
   - **Hugging Face (Recomendado):**
     - Endpoint por defecto: `https://router.huggingface.co/v1`
     - Modelo: `openai/gpt-oss-120b`
     - Pega tu API Key de Hugging Face (`hf_...`).
   - **Anthropic Claude (Opcional):**
     - Pega tu clave de Anthropic (`sk-ant-...`).
3. En la pestaña **"RAG & Cloudflare"** *(opcional)*:
   - Configura tu cuenta de Cloudflare Vectorize para sincronización semántica de notas.
4. Presiona **"Guardar Ajustes"**. Las claves quedan guardadas localmente de forma segura en tu equipo (`%APPDATA%\StickyFlow\stickyflow\settings.json`).

---

## 🛡️ Seguridad y Privacidad

StickyFlow fue diseñado bajo el principio de **privacidad absoluta**:

- **Filtro Automático de Tokens y Secretos:** Antes de enviar cualquier consulta de IA, el motor de seguridad enmascara automáticamente claves privadas (`hf_...`, `sk-...`), contraseñas y tokens Bearer para que jamás salgan de tu ordenador.
- **Tus Notas Son Tuyas:** No requiere registro en servidores externos ni cuentas obligatorias. La base de datos es local por defecto.
- **Aislamiento de Procesos:** Electron opera con `contextIsolation: true` y `nodeIntegration: false`, impidiendo la inyección de código malicioso en el renderizador.
- **Git Seguro:** El repositorio incluye un `.gitignore` estricto que previene que notas personales, historiales de chat o claves API se suban accidentalmente a repositorios públicos.

---

## 🛠️ Comandos para Desarrolladores

Si deseas compilar o personalizar StickyFlow por tu cuenta:

```bash
# 1. Clonar el repositorio
git clone <tu-repositorio>
cd aplicacion_notas

# 2. Instalar dependencias
npm install

# 3. Ejecutar en modo desarrollo con recarga en vivo
npm run electron:dev
# o para desarrollo concurrente con Vite:
npm start

# 4. Compilar el Instalador de Windows Setup (.exe)
npm run build:installer

# 5. Compilar la Versión Portable (.exe autónomo)
npm run build:portable

# 6. Compilar ambos formatos a la vez
npm run build:all
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT** — Siéntete libre de utilizarlo, modificarlo y compartirlo.

<div align="center">
Hecho con ❤️ para elevar la productividad en el escritorio.
</div>
