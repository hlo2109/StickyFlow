const { app, BrowserWindow, ipcMain, shell, clipboard, session, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let isAlwaysOnTop = true;
const miniStickyWindows = new Map(); // noteId -> BrowserWindow
const noteWindows = new Map(); // noteId -> BrowserWindow (Multi-window support for notes)
let dockWindow = null;

const COLOR_HEX = {
  yellow: '#fef08a',
  blue: '#bae6fd',
  green: '#bbf7d0',
  purple: '#e9d5ff',
  pink: '#fbcfe8',
  dark: '#1e293b'
};

function getHexForColor(color) {
  return COLOR_HEX[color] || '#fef08a';
}

function createMiniStickyWindow(note) {
  if (!note || !note.id) return;

  // If already open, bring to front
  if (miniStickyWindows.has(note.id)) {
    const existingWin = miniStickyWindows.get(note.id);
    if (existingWin && !existingWin.isDestroyed()) {
      if (existingWin.isMinimized()) existingWin.restore();
      existingWin.show();
      existingWin.focus();
      return;
    }
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const count = miniStickyWindows.size;
  const offsetX = (count % 6) * 35;
  const offsetY = (count % 6) * 35;

  const defaultX = Math.max(20, screenWidth - 270 - offsetX);
  const defaultY = Math.min(screenHeight - 210, 70 + offsetY);

  const miniWin = new BrowserWindow({
    width: 250,
    height: 165,
    minWidth: 190,
    minHeight: 120,
    maxWidth: 500,
    maxHeight: 400,
    x: defaultX,
    y: defaultY,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true, // Never clutter Windows taskbar
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: getHexForColor(note.color),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  });

  miniWin.setAlwaysOnTop(true, 'floating', 1);

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    miniWin.loadURL(`http://localhost:5173/?mode=mini&noteId=${encodeURIComponent(note.id)}`);
  } else {
    miniWin.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { mode: 'mini', noteId: note.id }
    });
  }

  miniWin.once('ready-to-show', () => {
    miniWin.show();
  });

  miniWin.on('closed', () => {
    miniStickyWindows.delete(note.id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-sticky-status-changed', {
        noteId: note.id,
        isOpen: false
      });
    } else if (miniStickyWindows.size === 0) {
      app.quit();
      app.exit(0);
    }
  });

  miniStickyWindows.set(note.id, miniWin);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-sticky-status-changed', {
      noteId: note.id,
      isOpen: true
    });
  }
}

// Handle uncaught errors gracefully so app never silently hangs
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Define directories for local storage & Markdown files
const getStorageDir = () => {
  try {
    if (!app.isPackaged) {
      // In development: use local project workspace
      return path.join(process.cwd(), 'mis_notas');
    } else {
      // In production/portable: use user's Documents folder so it persists and is easily accessible by user and Claude
      return path.join(app.getPath('documents'), 'StickyFlow_Notas');
    }
  } catch (e) {
    return path.join(app.getPath('userData'), 'mis_notas');
  }
};

const getDataFilePath = () => {
  try {
    const dataDir = path.join(app.getPath('userData'), 'stickyflow');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'notes.json');
  } catch (e) {
    console.error('Error in getDataFilePath:', e);
    return path.join(app.getPath('temp'), 'stickyflow_notes.json');
  }
};

const getSettingsFilePath = () => {
  try {
    const dataDir = path.join(app.getPath('userData'), 'stickyflow');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'settings.json');
  } catch (e) {
    console.error('Error in getSettingsFilePath:', e);
    return path.join(app.getPath('temp'), 'stickyflow_settings.json');
  }
};

const loadSettingsDirect = () => {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading settings direct:', err);
  }
  return {
    dockPosition: 'right',
    dockShowTitles: true,
    dockEnabled: true,
    dockedNoteIds: []
  };
};

function getDockBounds(position = 'right') {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const DOCK_WIDTH = 220;  // Slim & lightweight for tabs only (no cluttering hover window)
  const DOCK_HEIGHT = 80;  // Slim & lightweight for horizontal tabs

  if (position === 'left') {
    return {
      x: workX,
      y: workY,
      width: DOCK_WIDTH,
      height: screenHeight
    };
  } else if (position === 'top') {
    return {
      x: workX,
      y: workY,
      width: screenWidth,
      height: DOCK_HEIGHT
    };
  } else if (position === 'bottom') {
    return {
      x: workX,
      y: workY + screenHeight - DOCK_HEIGHT,
      width: screenWidth,
      height: DOCK_HEIGHT
    };
  } else {
    // 'right' (default)
    return {
      x: workX + screenWidth - DOCK_WIDTH,
      y: workY,
      width: DOCK_WIDTH,
      height: screenHeight
    };
  }
}

function openNoteWindow(noteId) {
  if (!noteId) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return mainWindow;
    }
    createWindow();
    return mainWindow;
  }

  // If already open in an existing note window, bring to front!
  if (noteWindows.has(noteId)) {
    const existing = noteWindows.get(noteId);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return existing;
    }
  }

  // If mainWindow is already open and showing this note, bring it to front
  if (mainWindow && !mainWindow.isDestroyed()) {
    // We can also let the user have multiple independent windows
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const count = noteWindows.size;
  const offsetX = (count % 8) * 35;
  const offsetY = (count % 8) * 35;
  const defaultX = Math.max(30, Math.min(screenWidth - 480, 100 + offsetX));
  const defaultY = Math.max(30, Math.min(screenHeight - 600, 70 + offsetY));

  const noteWin = new BrowserWindow({
    width: 440,
    height: 560,
    minWidth: 360,
    minHeight: 380,
    maxWidth: 950,
    maxHeight: 900,
    x: defaultX,
    y: defaultY,
    frame: false,
    show: false,
    alwaysOnTop: isAlwaysOnTop,
    skipTaskbar: true, // Keep Windows taskbar 100% clean!
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#fef08a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  });

  noteWin.setAlwaysOnTop(isAlwaysOnTop, 'floating', 1);

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    noteWin.loadURL(`http://localhost:5173/?noteId=${encodeURIComponent(noteId)}#noteId=${encodeURIComponent(noteId)}`);
  } else {
    noteWin.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { noteId },
      hash: `noteId=${encodeURIComponent(noteId)}`
    });
  }

  noteWin.once('ready-to-show', () => {
    noteWin.show();
    noteWin.focus();
  });

  setTimeout(() => {
    if (noteWin && !noteWin.isVisible() && !noteWin.isDestroyed()) {
      noteWin.show();
    }
  }, 1000);

  noteWin.on('closed', () => {
    noteWindows.delete(noteId);
  });

  noteWindows.set(noteId, noteWin);
  return noteWin;
}

function createDockWindow() {
  if (dockWindow && !dockWindow.isDestroyed()) {
    return;
  }

  const settings = loadSettingsDirect();
  if (settings.dockEnabled === false) return;

  const position = settings.dockPosition || 'right';
  const bounds = getDockBounds(position);

  dockWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true, // Never creates an icon in Windows taskbar!
    hasShadow: false,  // Shadows are handled in CSS so empty transparent areas don't have a shadow box
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  });

  const isDockTop = settings.dockAlwaysOnTop !== false;
  dockWindow.setAlwaysOnTop(isDockTop, 'floating', 2);
  dockWindow.setIgnoreMouseEvents(true, { forward: true });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    dockWindow.loadURL('http://localhost:5173/?mode=dock#mode=dock');
  } else {
    dockWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { mode: 'dock' },
      hash: 'mode=dock'
    });
  }

  dockWindow.once('ready-to-show', () => {
    dockWindow.show();
  });

  setTimeout(() => {
    if (dockWindow && !dockWindow.isVisible() && !dockWindow.isDestroyed()) {
      dockWindow.show();
    }
  }, 1000);

  dockWindow.on('closed', () => {
    dockWindow = null;
  });
}

// Ensure Markdown export directory exists
const ensureNotesDir = () => {
  try {
    const dir = getStorageDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (err) {
    console.error('Error creating notes directory:', err);
    // Fallback to userData
    const fallback = path.join(app.getPath('userData'), 'mis_notas');
    try {
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    } catch {}
    return fallback;
  }
};

// Sync individual note to markdown file for external tools (e.g. Claude)
function syncNoteToMarkdown(note) {
  try {
    const dir = ensureNotesDir();
    const safeTitle = (note.title || 'nota_sin_titulo')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .substring(0, 50)
    const suffix = note.id ? note.id.replace(/^note-/, '').slice(-6) : Date.now().toString().slice(-6);
    const fileName = `${safeTitle || 'nota'}_${suffix}.md`;
    const filePath = path.join(dir, fileName);

    const bitacoraYaml = (note.bitacora || [])
      .map(entry => `  - "${entry.timestamp} | ${entry.action} | ${(entry.summary || '').replace(/"/g, "'")}"`)
      .join('\n');

    const frontmatter = [
      '---',
      `id: "${note.id}"`,
      `title: "${(note.title || '').replace(/"/g, '\\"')}"`,
      `created_at: "${note.createdAt || new Date().toISOString()}"`,
      `updated_at: "${note.updatedAt || new Date().toISOString()}"`,
      `color: "${note.color || 'yellow'}"`,
      `tags: [${(note.tags || []).map(t => `"${t}"`).join(', ')}]`,
      `is_pinned: ${Boolean(note.isPinned)}`,
      'bitacora:',
      bitacoraYaml || '  []',
      '---',
      '',
      note.markdownContent || note.content || ''
    ].join('\n');

    fs.writeFileSync(filePath, frontmatter, 'utf-8');
  } catch (err) {
    console.error('Error syncing note to markdown file:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 560,
    minWidth: 360,
    minHeight: 380,
    maxWidth: 950,
    maxHeight: 900,
    frame: false,
    show: false, // will show when ready to avoid flashing/hanging
    alwaysOnTop: isAlwaysOnTop,
    skipTaskbar: false,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#fef08a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  });

  // Always on top level for Windows floating stickies
  mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating', 1);

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window smoothly as soon as it's ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Fallback timeout in case ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1000);

  // Debug file log
  const logFile = path.join(app.getPath('userData'), 'debug.log');
  const log = (msg) => {
    try { fs.appendFileSync(logFile, `${new Date().toISOString()} - ${msg}\n`); } catch {}
  };

  log('createWindow called');

  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    log(`did-fail-load: code=${code}, desc=${desc}, url=${url}`);
  });

  mainWindow.webContents.on('render-process-gone', (e, details) => {
    log(`render-process-gone: ${JSON.stringify(details)}`);
  });

  mainWindow.webContents.on('console-message', (e, level, msg, line, src) => {
    log(`CONSOLE [${level}]: ${msg} (${src}:${line})`);
  });

  mainWindow.on('close', () => {
    log('mainWindow close event fired');
  });

  mainWindow.on('closed', () => {
    log('mainWindow closed event fired');
    mainWindow = null;
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  app.whenReady().then(() => {
    // Grant media and audio capture permissions
    if (session.defaultSession) {
      session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
      });
      session.defaultSession.setPermissionCheckHandler(() => true);

      // Support capturing system loopback audio seamlessly
      if (session.defaultSession.setDisplayMediaRequestHandler) {
        session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
          desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            if (sources && sources.length > 0) {
              callback({ video: sources[0], audio: 'loopback' });
            } else {
              callback({});
            }
          }).catch(() => callback({}));
        });
      }
    }

    try {
      ensureNotesDir();
    } catch (e) {
      console.error('Error during ensureNotesDir in whenReady:', e);
    }
    createWindow();
    createDockWindow();

    const { screen } = require('electron');
    screen.on('display-metrics-changed', () => {
      if (dockWindow && !dockWindow.isDestroyed()) {
        const settings = loadSettingsDirect();
        const bounds = getDockBounds(settings.dockPosition || 'right');
        dockWindow.setBounds(bounds);
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        createDockWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (dockWindow && !dockWindow.isDestroyed()) {
    return; // Keep dock permanent on screen
  }
  app.quit();
  app.exit(0);
});

// IPC Handlers
ipcMain.handle('window:minimize', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (senderWin && !senderWin.isDestroyed()) {
    senderWin.minimize();
  }
});

ipcMain.handle('window:close', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  if (senderWin) {
    if (senderWin === mainWindow) {
      if (dockWindow && !dockWindow.isDestroyed()) {
        mainWindow.hide();
      } else if (miniStickyWindows.size > 0 || noteWindows.size > 0) {
        mainWindow.hide();
      } else {
        mainWindow.destroy();
        if (dockWindow && !dockWindow.isDestroyed()) {
          dockWindow.destroy();
        }
        app.quit();
        app.exit(0);
      }
    } else {
      // It's an independent noteWindow or miniStickyWindow
      senderWin.close();
    }
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
});

ipcMain.handle('window:toggleAlwaysOnTop', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (senderWin && !senderWin.isDestroyed()) {
    const nextState = !senderWin.isAlwaysOnTop();
    senderWin.setAlwaysOnTop(nextState, 'floating', 1);
    senderWin.webContents.send('always-on-top-changed', nextState);
    return nextState;
  }
  return false;
});

ipcMain.handle('window:getAlwaysOnTop', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return (senderWin && !senderWin.isDestroyed()) ? senderWin.isAlwaysOnTop() : isAlwaysOnTop;
});

ipcMain.handle('window:setOpacity', (event, opacity) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (senderWin && !senderWin.isDestroyed()) {
    senderWin.setOpacity(Math.max(0.3, Math.min(1.0, opacity)));
  }
});

ipcMain.handle('window:resize', (event, { width, height }) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (senderWin && !senderWin.isDestroyed()) {
    const currentBounds = senderWin.getBounds();
    senderWin.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: width || currentBounds.width,
      height: height || currentBounds.height
    });
  }
});

ipcMain.handle('notes:load', () => {
  try {
    const filePath = getDataFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.error('Error loading notes:', err);
    return [];
  }
});

ipcMain.handle('notes:save', (_event, notes) => {
  try {
    const filePath = getDataFilePath();
    fs.writeFileSync(filePath, JSON.stringify(notes, null, 2), 'utf-8');

    // Also mirror to local markdown files and broadcast to all open note windows and dock
    if (Array.isArray(notes)) {
      notes.forEach(note => {
        syncNoteToMarkdown(note);
        if (miniStickyWindows.has(note.id)) {
          const miniWin = miniStickyWindows.get(note.id);
          if (miniWin && !miniWin.isDestroyed()) {
            miniWin.webContents.send('mini:note-updated', note);
          }
        }
      });
    }

    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed() && win.webContents !== _event.sender) {
        win.webContents.send('notes:updated', notes);
      }
    });

    if (dockWindow && !dockWindow.isDestroyed()) {
      dockWindow.webContents.send('dock:notes-updated', notes);
    }
    return { success: true };
  } catch (err) {
    console.error('Error saving notes:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:load', () => {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
    return {
      hfEndpoint: 'https://router.huggingface.co/v1',
      hfModel: 'openai/gpt-oss-120b',
      hfApiKey: '',
      claudeApiKey: '',
      activeAiProvider: 'huggingface',
      alwaysOnTop: true,
      defaultColor: 'yellow',
      opacity: 0.98,
      dockPosition: 'right',
      dockShowTitles: true,
      dockEnabled: true,
      dockedNoteIds: []
    };
  } catch (err) {
    console.error('Error loading settings:', err);
    return {};
  }
});

ipcMain.handle('settings:save', (_event, settings) => {
  try {
    const filePath = getSettingsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
    if (typeof settings.alwaysOnTop === 'boolean' && mainWindow) {
      isAlwaysOnTop = settings.alwaysOnTop;
      mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating', 1);
    }
    if (typeof settings.opacity === 'number' && mainWindow) {
      mainWindow.setOpacity(settings.opacity);
    }
    if (dockWindow && !dockWindow.isDestroyed()) {
      dockWindow.webContents.send('dock:settings-updated', settings);
      if (settings.dockPosition) {
        const bounds = getDockBounds(settings.dockPosition);
        dockWindow.setBounds(bounds);
      }
      if (typeof settings.dockAlwaysOnTop === 'boolean') {
        dockWindow.setAlwaysOnTop(settings.dockAlwaysOnTop, 'floating', 2);
      }
      if (settings.dockEnabled === false) {
        dockWindow.hide();
      } else if (!dockWindow.isVisible()) {
        dockWindow.show();
      }
    } else if (settings.dockEnabled !== false) {
      createDockWindow();
    }
    return { success: true };
  } catch (err) {
    console.error('Error saving settings:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes:openFolder', () => {
  const dir = ensureNotesDir();
  shell.openPath(dir);
  return dir;
});

ipcMain.handle('notes:getFolderPath', () => {
  return ensureNotesDir();
});

ipcMain.handle('notes:exportMarkdown', (_event, note) => {
  syncNoteToMarkdown(note);
  return { success: true };
});

ipcMain.handle('system-audio:getSources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    return sources.map(s => ({ id: s.id, name: s.name }));
  } catch (e) {
    console.error('Error getting desktop sources:', e);
    return [];
  }
});

ipcMain.handle('clipboard:write', (_event, text) => {
  clipboard.writeText(text);
  return true;
});

// Mini Stickies IPC Handlers
ipcMain.handle('sticky:openMini', (_event, note) => {
  createMiniStickyWindow(note);
  return true;
});

ipcMain.handle('sticky:closeMini', (_event, noteId) => {
  if (miniStickyWindows.has(noteId)) {
    const win = miniStickyWindows.get(noteId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    miniStickyWindows.delete(noteId);
  }
  return true;
});

ipcMain.handle('sticky:toggleMini', (_event, note) => {
  if (!note || !note.id) return false;
  if (miniStickyWindows.has(note.id)) {
    const win = miniStickyWindows.get(note.id);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    miniStickyWindows.delete(note.id);
    return false;
  } else {
    createMiniStickyWindow(note);
    return true;
  }
});

ipcMain.handle('sticky:getOpenList', () => {
  return Array.from(miniStickyWindows.keys());
});

ipcMain.handle('sticky:expand', (_event, noteId) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('select-note', noteId);
  return true;
});

// Notebook Separators Dock IPC Handlers
ipcMain.handle('dock:set-ignore-mouse', (_event, ignore) => {
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
  return true;
});

ipcMain.handle('dock:set-position', (_event, position) => {
  const settings = loadSettingsDirect();
  settings.dockPosition = position;
  try {
    const sPath = getSettingsFilePath();
    fs.writeFileSync(sPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings dockPosition:', err);
  }
  if (dockWindow && !dockWindow.isDestroyed()) {
    const bounds = getDockBounds(position);
    dockWindow.setBounds(bounds);
    dockWindow.webContents.send('dock:settings-updated', settings);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dock:settings-updated', settings);
  }
  return true;
});

ipcMain.handle('dock:open-note-window', (_event, noteId) => {
  openNoteWindow(noteId);
  return true;
});

ipcMain.handle('dock:open-note', (_event, noteId) => {
  openNoteWindow(noteId);
  return true;
});

ipcMain.handle('dock:get-docked-ids', () => {
  const settings = loadSettingsDirect();
  if (Array.isArray(settings.dockedNoteIds) && settings.dockedNoteIds.length > 0) {
    return settings.dockedNoteIds;
  }
  try {
    const notesPath = getDataFilePath();
    if (fs.existsSync(notesPath)) {
      const notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
      if (Array.isArray(notes) && notes.length > 0) {
        const pinnedIds = notes.filter(n => n.isPinned).map(n => n.id);
        const resultIds = pinnedIds.length > 0 ? pinnedIds : notes.map(n => n.id);
        settings.dockedNoteIds = resultIds;
        try {
          fs.writeFileSync(getSettingsFilePath(), JSON.stringify(settings, null, 2), 'utf-8');
        } catch {}
        return resultIds;
      }
    }
  } catch {}
  return [];
});

ipcMain.handle('dock:toggle-pin', (_event, noteId) => {
  const settings = loadSettingsDirect();
  let dockedIds = Array.isArray(settings.dockedNoteIds) ? [...settings.dockedNoteIds] : null;

  if (!dockedIds) {
    try {
      const notesPath = getDataFilePath();
      if (fs.existsSync(notesPath)) {
        const notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
        dockedIds = notes.filter(n => n.isPinned).map(n => n.id);
      }
    } catch {}
    dockedIds = dockedIds || [];
  }

  if (dockedIds.includes(noteId)) {
    dockedIds = dockedIds.filter(id => id !== noteId);
  } else {
    dockedIds.push(noteId);
  }

  settings.dockedNoteIds = dockedIds;
  try {
    const sPath = getSettingsFilePath();
    fs.writeFileSync(sPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving dockedNoteIds:', err);
  }

  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.webContents.send('dock:ids-changed', dockedIds);
    dockWindow.webContents.send('dock:settings-updated', settings);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dock:ids-changed', dockedIds);
    mainWindow.webContents.send('dock:settings-updated', settings);
  }

  return dockedIds;
});

ipcMain.handle('dock:set-always-on-top', (_event, value) => {
  const settings = loadSettingsDirect();
  settings.dockAlwaysOnTop = Boolean(value);
  try {
    const sPath = getSettingsFilePath();
    fs.writeFileSync(sPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings dockAlwaysOnTop:', err);
  }
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.setAlwaysOnTop(settings.dockAlwaysOnTop, 'floating', 2);
    dockWindow.webContents.send('dock:settings-updated', settings);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dock:settings-updated', settings);
  }
  return settings.dockAlwaysOnTop;
});

ipcMain.handle('app:quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.destroy();
  }
  app.quit();
  app.exit(0);
});


