/**
 * tray
 * ----
 * Icono de StickyFlow en la bandeja del sistema (junto al reloj de Windows) con acceso rápido
 * a Reunión, Entrevista y Nota de voz, sin tener que dar vueltas por las ventanas.
 *
 * El menú es una función pura (`buildMenuTemplate`) para poder probarlo sin abrir nada.
 */

const { Tray, Menu, nativeImage } = require('electron');

/** Vistas de la ventana de reunión a las que se puede entrar directo. */
const VIEWS = ['meeting', 'interview', 'voicenote'];

/**
 * Icono de post-it (amarillo con esquina doblada y renglones), dibujado píxel a píxel:
 * así no depende de ningún archivo de imagen y se ve nítido en pantallas de alta densidad.
 */
function makeTrayIcon() {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4); // BGRA

  const set = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = b;
    buf[i + 1] = g;
    buf[i + 2] = r;
    buf[i + 3] = a;
  };

  const YELLOW = [253, 224, 71, 255];
  const EDGE = [202, 138, 4, 255];
  const FOLD = [250, 204, 21, 255];
  const FOLD_SHADOW = [161, 98, 7, 255];
  const LINE = [133, 77, 14, 255];

  const margin = 3;
  const lo = margin;
  const hi = size - margin - 1;
  const fold = 9; // tamaño de la esquina doblada (abajo a la derecha)

  for (let y = lo; y <= hi; y++) {
    for (let x = lo; x <= hi; x++) {
      // Esquinas redondeadas (radio 3)
      const dx = Math.min(x - lo, hi - x);
      const dy = Math.min(y - lo, hi - y);
      if (dx < 3 && dy < 3 && (3 - dx) * (3 - dx) + (3 - dy) * (3 - dy) > 5) continue;

      // Recorte diagonal de la esquina inferior derecha
      const inFold = x + y > hi * 2 - fold && x > hi - fold && y > hi - fold;
      const onCut = x + y === hi * 2 - fold + 1 && x > hi - fold && y > hi - fold;
      if (x + y > hi * 2 - fold + 1 && x > hi - fold && y > hi - fold) {
        set(x, y, FOLD); // la solapa doblada
        continue;
      }
      if (onCut) {
        set(x, y, FOLD_SHADOW);
        continue;
      }
      void inFold;

      const isEdge = x === lo || y === lo || x === hi || y === hi;
      set(x, y, isEdge ? EDGE : YELLOW);
    }
  }

  // Renglones de texto
  for (const y of [11, 16, 21]) {
    const end = y === 21 ? 17 : 23;
    for (let x = 8; x <= end; x++) {
      set(x, y, LINE);
      set(x, y + 1, LINE);
    }
  }

  // scaleFactor 2: 32 px reales para un icono de 16 puntos → nítido en pantallas de alta resolución
  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2.0 });
}

/**
 * Menú de la bandeja.
 * handlers: { openMain, openView(view), openSettings, quit }
 */
function buildMenuTemplate(handlers) {
  return [
    { label: 'Abrir StickyFlow', click: () => handlers.openMain() },
    { type: 'separator' },
    { label: '🎧  Reunión (grabar y minuta)', click: () => handlers.openView('meeting') },
    { label: '🌐  Entrevista (traducción en vivo)', click: () => handlers.openView('interview') },
    { label: '🎙️  Nota de voz (WhatsApp y más)', click: () => handlers.openView('voicenote') },
    { type: 'separator' },
    { label: '⚙️  Ajustes', click: () => handlers.openSettings() },
    { type: 'separator' },
    { label: 'Salir de StickyFlow', click: () => handlers.quit() }
  ];
}

let tray = null;

/** Crea el icono si no existe. Devuelve el Tray (o null si no se pudo). */
function showTray(handlers) {
  if (tray && !tray.isDestroyed()) return tray;
  try {
    tray = new Tray(makeTrayIcon());
    tray.setToolTip('StickyFlow — acceso rápido');
    const open = () => tray.popUpContextMenu(Menu.buildFromTemplate(buildMenuTemplate(handlers)));
    // Clic izquierdo y derecho muestran el mismo menú rápido
    tray.on('click', open);
    tray.on('right-click', open);
    tray.on('double-click', () => handlers.openMain());
    return tray;
  } catch (err) {
    console.error('No se pudo crear el icono de la bandeja:', err);
    tray = null;
    return null;
  }
}

/** Quita el icono de la bandeja. */
function hideTray() {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
}

function isTrayVisible() {
  return Boolean(tray && !tray.isDestroyed());
}

module.exports = { VIEWS, makeTrayIcon, buildMenuTemplate, showTray, hideTray, isTrayVisible };
