const { app, BrowserWindow, ipcMain, shell, clipboard, session, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let isAlwaysOnTop = true;
const miniStickyWindows = new Map(); // noteId -> BrowserWindow

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
    skipTaskbar: false,
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

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  app.quit();
  app.exit(0);
});

// IPC Handlers
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:close', () => {
  if (miniStickyWindows.size > 0 && mainWindow) {
    mainWindow.hide();
  } else {
    if (mainWindow) {
      mainWindow.destroy();
    }
    app.quit();
    app.exit(0);
  }
});

ipcMain.handle('window:toggleAlwaysOnTop', () => {
  if (mainWindow) {
    isAlwaysOnTop = !isAlwaysOnTop;
    mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating', 1);
    mainWindow.webContents.send('always-on-top-changed', isAlwaysOnTop);
    return isAlwaysOnTop;
  }
  return false;
});

ipcMain.handle('window:getAlwaysOnTop', () => {
  return isAlwaysOnTop;
});

ipcMain.handle('window:setOpacity', (_event, opacity) => {
  if (mainWindow) {
    mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, opacity)));
  }
});

ipcMain.handle('window:resize', (_event, { width, height }) => {
  if (mainWindow) {
    const currentBounds = mainWindow.getBounds();
    mainWindow.setBounds({
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

    // Also mirror to local markdown files and broadcast to open mini windows
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
      opacity: 0.98
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

