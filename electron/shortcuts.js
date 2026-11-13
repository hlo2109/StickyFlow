/**
 * shortcuts
 * ---------
 * Atajos de teclado GLOBALES (funcionan aunque StickyFlow esté en segundo plano):
 *   Ctrl+Alt+R → Reunión · Ctrl+Alt+E → Entrevista · Ctrl+Alt+V → Nota de voz
 *
 * Si otra aplicación ya usa una combinación, Windows no la deja registrar: se informa en vez de fallar en silencio.
 */

const { globalShortcut } = require('electron');

/** Combinación → vista. Se muestran también en el menú de la bandeja. */
const SHORTCUTS = [
  { accelerator: 'CommandOrControl+Alt+R', view: 'meeting', label: 'Ctrl+Alt+R' },
  { accelerator: 'CommandOrControl+Alt+E', view: 'interview', label: 'Ctrl+Alt+E' },
  { accelerator: 'CommandOrControl+Alt+V', view: 'voicenote', label: 'Ctrl+Alt+V' }
];

/**
 * Registra los atajos. `openView(view)` se llama al pulsarlos.
 * Devuelve qué se registró y qué no (por estar ocupado por otra app).
 */
function registerShortcuts(openView) {
  unregisterShortcuts();
  const registered = [];
  const failed = [];
  for (const s of SHORTCUTS) {
    let ok = false;
    try {
      ok = globalShortcut.register(s.accelerator, () => openView(s.view));
    } catch {
      ok = false;
    }
    (ok ? registered : failed).push(s.label);
  }
  return { registered, failed };
}

function unregisterShortcuts() {
  for (const s of SHORTCUTS) {
    try {
      globalShortcut.unregister(s.accelerator);
    } catch {
      /* ya libre */
    }
  }
}

function isRegistered(label) {
  const s = SHORTCUTS.find((x) => x.label === label);
  return Boolean(s && globalShortcut.isRegistered(s.accelerator));
}

module.exports = { SHORTCUTS, registerShortcuts, unregisterShortcuts, isRegistered };
