/**
 * shortcutLinks
 * -------------
 * Crea accesos directos de Windows (.lnk) que abren StickyFlow DIRECTO en Reunión, Entrevista o Nota de voz.
 * Se pueden anclar a la barra de tareas (clic derecho → «Anclar a la barra de tareas»): un clic y listo,
 * sin abrir notas ni ir a Ajustes. Windows no permite que una app se ancle sola; eso lo hace el usuario.
 *
 * El constructor de especificaciones es una función pura (`buildLinkSpecs`) para poder probarlo.
 */

const { shell } = require('electron');
const fs = require('fs');
const path = require('path');

const VIEW_NAMES = {
  meeting: 'StickyFlow Reunión',
  interview: 'StickyFlow Entrevista',
  voicenote: 'StickyFlow Nota de voz'
};

const VIEW_DESCRIPTIONS = {
  meeting: 'Abrir StickyFlow en Modo Reunión',
  interview: 'Abrir StickyFlow en Modo Entrevista (traducción en vivo)',
  voicenote: 'Abrir StickyFlow en Nota de voz'
};

/**
 * @param {{ exePath: string, appPath: string, isPackaged: boolean, dir: string }} ctx
 *   - exePath: ejecutable (StickyFlow.exe, o electron.exe en desarrollo)
 *   - appPath: carpeta de la app (solo hace falta en desarrollo, donde el ejecutable es electron.exe)
 */
function buildLinkSpecs(ctx) {
  return Object.keys(VIEW_NAMES).map((view) => ({
    view,
    file: path.join(ctx.dir, `${VIEW_NAMES[view]}.lnk`),
    options: {
      target: ctx.exePath,
      // Empaquetada: solo el argumento. En desarrollo hay que decirle a electron.exe QUÉ app abrir.
      args: ctx.isPackaged ? `--view=${view}` : `"${ctx.appPath}" --view=${view}`,
      cwd: ctx.isPackaged ? path.dirname(ctx.exePath) : ctx.appPath,
      description: VIEW_DESCRIPTIONS[view],
      icon: ctx.exePath,
      iconIndex: 0
    }
  }));
}

/** Crea los accesos directos en `dir`. Devuelve las rutas creadas y las que fallaron. */
function createShortcutLinks(ctx) {
  const created = [];
  const failed = [];
  try {
    fs.mkdirSync(ctx.dir, { recursive: true });
  } catch {
    /* ya existe */
  }
  for (const spec of buildLinkSpecs(ctx)) {
    let ok = false;
    try {
      ok = shell.writeShortcutLink(spec.file, 'create', spec.options);
    } catch {
      ok = false;
    }
    (ok ? created : failed).push(spec.file);
  }
  return { created, failed };
}

module.exports = { VIEW_NAMES, buildLinkSpecs, createShortcutLinks };
