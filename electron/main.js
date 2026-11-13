const { app, BrowserWindow, ipcMain, shell, clipboard, session, desktopCapturer, Menu, MenuItem, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const secureSettings = require('./secureSettings');

let mainWindow = null;
let isAlwaysOnTop = true;
const miniStickyWindows = new Map(); // noteId -> BrowserWindow
const noteWindows = new Map(); // noteId -> BrowserWindow (Multi-window support for notes)
let dockWindow = null;
let settingsWindow = null;
let meetingWindow = null;

const COLOR_HEX = {
  yellow: '#fef08a',
  orange: '#fed7aa',
  coral: '#fecaca',
  pink: '#fbcfe8',
  purple: '#e9d5ff',
  indigo: '#c7d2fe',
  blue: '#bae6fd',
  teal: '#99f6e4',
  green: '#bbf7d0',
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
      webSecurity: false,
      spellcheck: true
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
      const parsed = secureSettings.readSettingsFile(filePath) || {};
      if (parsed.dockAlwaysOnTop === undefined) parsed.dockAlwaysOnTop = true;
      if (parsed.startDockOnly === undefined) parsed.startDockOnly = true;
      if (!parsed.ttsVoice) parsed.ttsVoice = 'es-MX-DaliaNeural';
      if (parsed.useNeuralTts === undefined) parsed.useNeuralTts = true;
      return parsed;
    }
  } catch (err) {
    console.error('Error loading settings direct:', err);
  }
  return {
    dockPosition: 'right',
    dockShowTitles: true,
    dockEnabled: true,
    dockAlwaysOnTop: true,
    startDockOnly: true,
    ttsVoice: 'es-MX-DaliaNeural',
    useNeuralTts: true,
    autoBackupEnabled: true,
    autoBackupFrequency: 'daily',
    dockedNoteIds: []
  };
};

// Define directories for local storage & Markdown files
const getStorageDir = () => {
  try {
    const settings = loadSettingsDirect();
    if (settings && settings.customStorageDir && fs.existsSync(settings.customStorageDir)) {
      return settings.customStorageDir;
    }
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

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

// Detect local cloud-synced folders (OneDrive, Google Drive, Dropbox, iCloud)
const detectCloudFolders = () => {
  const homeDir = app.getPath('home');
  const docsDir = app.getPath('documents');
  const list = [];

  // Default: Documents / Documentos
  const docsSticky = path.join(docsDir, 'StickyFlow_Notas');
  list.push({
    id: 'documents',
    name: 'Documentos Locales',
    type: 'local',
    path: docsSticky,
    exists: fs.existsSync(docsDir),
    isCloud: false,
    icon: 'folder'
  });

  // Check OneDrive (common on Windows 10 & 11)
  const oneDrivePaths = [
    process.env.OneDrive,
    process.env.OneDriveConsumer,
    process.env.OneDriveCommercial,
    path.join(homeDir, 'OneDrive'),
    path.join(homeDir, 'OneDrive - Personal')
  ].filter(Boolean);

  let oneDriveFound = false;
  for (const odp of oneDrivePaths) {
    if (fs.existsSync(odp) && !oneDriveFound) {
      list.push({
        id: 'onedrive',
        name: 'Microsoft OneDrive (Nube)',
        type: 'onedrive',
        path: path.join(odp, 'StickyFlow_Notas'),
        exists: true,
        isCloud: true,
        icon: 'cloud'
      });
      oneDriveFound = true;
      break;
    }
  }

  // Check Google Drive Desktop (Mi unidad / Google Drive)
  const googleDrivePaths = [
    path.join(homeDir, 'Google Drive'),
    path.join(homeDir, 'Mi unidad'),
    path.join(homeDir, 'GoogleDrive'),
    'G:\\Mi unidad',
    'G:\\My Drive'
  ];

  let gdriveFound = false;
  for (const gdp of googleDrivePaths) {
    if (fs.existsSync(gdp) && !gdriveFound) {
      list.push({
        id: 'gdrive',
        name: 'Google Drive para Escritorio (Nube)',
        type: 'gdrive',
        path: path.join(gdp, 'StickyFlow_Notas'),
        exists: true,
        isCloud: true,
        icon: 'cloud'
      });
      gdriveFound = true;
      break;
    }
  }

  // Check Dropbox
  const dropboxPaths = [
    path.join(homeDir, 'Dropbox'),
    path.join(homeDir, 'Dropbox (Personal)')
  ];
  let dropboxFound = false;
  for (const dbp of dropboxPaths) {
    if (fs.existsSync(dbp) && !dropboxFound) {
      list.push({
        id: 'dropbox',
        name: 'Dropbox (Nube)',
        type: 'dropbox',
        path: path.join(dbp, 'StickyFlow_Notas'),
        exists: true,
        isCloud: true,
        icon: 'cloud'
      });
      dropboxFound = true;
      break;
    }
  }

  // Check iCloud Drive (Windows iCloud Desktop app)
  const iCloudPaths = [
    path.join(homeDir, 'iCloudDrive'),
    path.join(homeDir, 'iCloud Drive')
  ];
  let icloudFound = false;
  for (const icp of iCloudPaths) {
    if (fs.existsSync(icp) && !icloudFound) {
      list.push({
        id: 'icloud',
        name: 'iCloud Drive (Nube Apple)',
        type: 'icloud',
        path: path.join(icp, 'StickyFlow_Notas'),
        exists: true,
        isCloud: true,
        icon: 'cloud'
      });
      icloudFound = true;
      break;
    }
  }

  return list;
};

const getBackupsDir = () => {
  const baseDir = getStorageDir();
  const backupsDir = path.join(baseDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    try {
      fs.mkdirSync(backupsDir, { recursive: true });
    } catch (e) {
      console.error('Error creating backups dir:', e);
    }
  }
  return backupsDir;
};

// Backup Creation
const createBackupFile = (notes, settings) => {
  try {
    const backupsDir = getBackupsDir();
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const fileName = `StickyFlow_Backup_${dateStr}.json`;
    const filePath = path.join(backupsDir, fileName);

    const safeSettings = settings ? { ...settings } : loadSettingsDirect();
    const backupPayload = {
      app: 'StickyFlow',
      version: '1.0.0',
      timestamp: d.toISOString(),
      notesCount: Array.isArray(notes) ? notes.length : 0,
      notes: notes || [],
      settings: secureSettings.stripSecrets(safeSettings)
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    fs.writeFileSync(filePath, jsonStr, 'utf-8');

    const stat = fs.statSync(filePath);
    const sizeStr = formatFileSize(stat.size);

    // Update settings with last backup info
    safeSettings.lastBackupTime = d.toISOString();
    safeSettings.lastBackupSize = sizeStr;
    try {
      secureSettings.writeSettingsFile(getSettingsFilePath(), safeSettings);
    } catch {}

    // Clean older auto backups, keep up to 10 latest
    try {
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('StickyFlow_Backup_') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 10) {
        files.slice(10).forEach(old => {
          try { fs.unlinkSync(path.join(backupsDir, old.name)); } catch {}
        });
      }
    } catch {}

    return {
      success: true,
      filePath,
      fileName,
      timestamp: d.toISOString(),
      size: sizeStr,
      notesCount: backupPayload.notesCount
    };
  } catch (err) {
    console.error('Error creating backup file:', err);
    return { success: false, error: err.message };
  }
};

const listBackups = () => {
  try {
    const backupsDir = getBackupsDir();
    if (!fs.existsSync(backupsDir)) return [];

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.json'))
      .map(name => {
        const full = path.join(backupsDir, name);
        try {
          const stat = fs.statSync(full);
          let notesCount = 0;
          try {
            const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
            notesCount = Array.isArray(raw.notes) ? raw.notes.length : (raw.notesCount || 0);
          } catch {}

          return {
            fileName: name,
            filePath: full,
            size: formatFileSize(stat.size),
            sizeBytes: stat.size,
            time: new Date(stat.mtimeMs).toISOString(),
            notesCount
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return files;
  } catch (e) {
    console.error('Error listing backups:', e);
    return [];
  }
};

const restoreBackupFromFile = (targetFilePath) => {
  try {
    if (!fs.existsSync(targetFilePath)) {
      return { success: false, error: 'El archivo de copia de seguridad no existe.' };
    }

    const raw = fs.readFileSync(targetFilePath, 'utf-8');
    const parsed = JSON.parse(raw);

    const notesToRestore = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.notes) ? parsed.notes : null);
    if (!notesToRestore) {
      return { success: false, error: 'El archivo no contiene notas válidas de StickyFlow.' };
    }

    // Save notes to primary data file
    const notesPath = getDataFilePath();
    fs.writeFileSync(notesPath, JSON.stringify(notesToRestore, null, 2), 'utf-8');

    // Also mirror to storage dir
    try {
      const storageDir = getStorageDir();
      fs.writeFileSync(path.join(storageDir, 'stickyflow_database.json'), JSON.stringify(notesToRestore, null, 2), 'utf-8');
    } catch {}

    // Resync markdown files
    notesToRestore.forEach(n => syncNoteToMarkdown(n));

    // Restore settings if present
    if (parsed.settings && typeof parsed.settings === 'object') {
      try {
        const curSettings = loadSettingsDirect();
        const merged = secureSettings.mergeKeepingSecrets(curSettings, parsed.settings);
        secureSettings.writeSettingsFile(getSettingsFilePath(), merged);
      } catch {}
    }

    // Broadcast update to all windows and dock
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('notes:updated', notesToRestore);
      }
    });

    if (dockWindow && !dockWindow.isDestroyed()) {
      dockWindow.webContents.send('dock:notes-updated', notesToRestore);
    }

    return { success: true, count: notesToRestore.length };
  } catch (err) {
    console.error('Error restoring backup:', err);
    return { success: false, error: err.message };
  }
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
    width: 490,
    height: 560,
    minWidth: 380,
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
      webSecurity: false,
      spellcheck: true
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
    if (dockWindow && !dockWindow.isDestroyed()) {
      const s = loadSettingsDirect();
      if (s.dockAlwaysOnTop !== false) {
        dockWindow.setAlwaysOnTop(true, 'screen-saver');
        dockWindow.moveTop();
      }
    }
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

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const winWidth = 660;
  const winHeight = 620;
  const defaultX = Math.max(30, Math.min(screenWidth - winWidth - 30, 180));
  const defaultY = Math.max(30, Math.min(screenHeight - winHeight - 30, 80));

  settingsWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 520,
    minHeight: 460,
    x: defaultX,
    y: defaultY,
    frame: false,
    show: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    movable: true,
    resizable: true,
    minimizable: true,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      spellcheck: true
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/?mode=settings#mode=settings');
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { mode: 'settings' },
      hash: 'mode=settings'
    });
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    settingsWindow.focus();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

function openMeetingWindow(noteId) {
  if (meetingWindow && !meetingWindow.isDestroyed()) {
    if (meetingWindow.isMinimized()) meetingWindow.restore();
    meetingWindow.show();
    meetingWindow.focus();
    if (noteId) {
      meetingWindow.webContents.send('meeting:set-note-id', noteId);
    }
    return meetingWindow;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const winWidth = 840;
  const winHeight = 640;
  // Positioned beside note windows so active notes are 100% visible and readable
  const defaultX = Math.max(20, Math.min(screenWidth - winWidth - 20, 80));
  const defaultY = Math.max(30, Math.min(screenHeight - winHeight - 30, 50));

  meetingWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 600,
    minHeight: 480,
    x: defaultX,
    y: defaultY,
    frame: false,
    show: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    movable: true,
    resizable: true,
    minimizable: true,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      spellcheck: true
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  const query = { mode: 'meeting', noteId: noteId || '' };
  if (isDev) {
    meetingWindow.loadURL(`http://localhost:5173/?mode=meeting&noteId=${encodeURIComponent(noteId || '')}#mode=meeting`);
  } else {
    meetingWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query,
      hash: 'mode=meeting'
    });
  }

  meetingWindow.once('ready-to-show', () => {
    meetingWindow.show();
    meetingWindow.focus();
  });

  meetingWindow.on('closed', () => {
    meetingWindow = null;
  });

  return meetingWindow;
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
  dockWindow.setAlwaysOnTop(isDockTop, 'screen-saver');
  if (isDockTop) {
    dockWindow.moveTop();
  }
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
    if (isDockTop) {
      dockWindow.moveTop();
    }
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
      .replace(/\.\./g, '_')
      .substring(0, 50);
    const suffix = note.id ? note.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(-8) : Date.now().toString().slice(-6);
    const fileName = `${safeTitle || 'nota'}_${suffix}.md`;
    const filePath = path.join(dir, fileName);
    if (!path.resolve(filePath).startsWith(path.resolve(dir))) {
      console.warn('Blocked path traversal attempt in syncNoteToMarkdown');
      return;
    }

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

// Sanitize notes list: remove empty ghosts, duplicates, and malformed notes
function sanitizeNotesList(rawNotes) {
  if (!Array.isArray(rawNotes)) return [];

  const seenIds = new Set();
  const validNotes = [];

  for (const note of rawNotes) {
    if (!note || typeof note !== 'object' || !note.id) continue;
    if (seenIds.has(note.id)) continue;
    seenIds.add(note.id);

    const titleText = (note.title || '').trim();
    const mdText = (note.markdownContent || '').trim();
    const contentText = (note.content || '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .trim();

    const isCompletelyEmpty = !titleText && !mdText && !contentText;
    // Discard empty ghost notes unless it is the only single note in the system
    if (isCompletelyEmpty && rawNotes.length > 1) {
      continue;
    }

    validNotes.push({
      id: String(note.id),
      title: note.title || '',
      content: note.content || '',
      markdownContent: note.markdownContent || '',
      color: note.color || 'yellow',
      isPinned: Boolean(note.isPinned),
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || new Date().toISOString(),
      tags: Array.isArray(note.tags) ? note.tags : [],
      bitacora: Array.isArray(note.bitacora) ? note.bitacora : []
    });
  }

  return validNotes;
}

// Clean up orphaned or renamed markdown files in the storage folder
function cleanupOrphanedMarkdownFiles(validNotes) {
  let removedCount = 0;
  try {
    const dir = ensureNotesDir();
    if (!fs.existsSync(dir)) return 0;

    const validIdSet = new Set((validNotes || []).map(n => String(n.id)));
    const validSuffixSet = new Set((validNotes || []).map(n => {
      return n.id ? n.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(-8) : '';
    }).filter(Boolean));

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const fullPath = path.join(dir, file);

      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;

        let fileNoteId = null;
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const idMatch = content.match(/^id:\s*["']?([^"'\r\n]+)["']?/m);
          if (idMatch && idMatch[1]) {
            fileNoteId = idMatch[1].trim();
          }
        } catch {}

        let isOrphan = false;
        if (fileNoteId) {
          isOrphan = !validIdSet.has(fileNoteId);
        } else {
          const matchSuffix = file.match(/_([a-zA-Z0-9_-]+)\.md$/);
          if (matchSuffix && matchSuffix[1]) {
            isOrphan = !validSuffixSet.has(matchSuffix[1]);
          } else {
            isOrphan = true;
          }
        }

        if (isOrphan) {
          fs.unlinkSync(fullPath);
          removedCount++;
        }
      } catch (err) {
        console.warn('Error checking/removing markdown file:', file, err);
      }
    }
  } catch (e) {
    console.error('Error in cleanupOrphanedMarkdownFiles:', e);
  }
  return removedCount;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 490,
    height: 560,
    minWidth: 380,
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
      webSecurity: false,
      spellcheck: true
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
    if (dockWindow && !dockWindow.isDestroyed()) {
      const s = loadSettingsDirect();
      if (s.dockAlwaysOnTop !== false) {
        dockWindow.setAlwaysOnTop(true, 'screen-saver');
        dockWindow.moveTop();
      }
    }
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  // Global webContents handler for security and right-click context menu
  app.on('web-contents-created', (_event, contents) => {
    // Security: Prevent untrusted window creation and open web links in default system browser
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    contents.on('will-navigate', (e, navigationUrl) => {
      try {
        const parsed = new URL(navigationUrl);
        if (parsed.protocol === 'file:' || parsed.host === 'localhost:5173') {
          return;
        }
      } catch {}
      e.preventDefault();
      // Solo enlaces web normales; nunca protocolos del sistema (ms-msdt:, file:, etc.).
      if (/^(https?:|mailto:)/i.test(navigationUrl)) {
        shell.openExternal(navigationUrl);
      }
    });

    // Native Right-Click Context Menu: Spellcheck suggestions, Copy/Cut/Paste, and TTS
    contents.on('context-menu', (_e, params) => {
      const win = BrowserWindow.fromWebContents(contents);
      if (!win || win.isDestroyed()) return;

      const menuTemplate = [];

      // 1. Spellchecker Suggestions for Misspelled Words
      if (params.misspelledWord) {
        if (Array.isArray(params.dictionarySuggestions) && params.dictionarySuggestions.length > 0) {
          params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
            menuTemplate.push({
              label: suggestion,
              click: () => contents.replaceMisspelling(suggestion)
            });
          });
        } else {
          menuTemplate.push({
            label: '(Sin sugerencias de corrección)',
            enabled: false
          });
        }

        menuTemplate.push({ type: 'separator' });
        menuTemplate.push({
          label: `Añadir "${params.misspelledWord}" al diccionario`,
          click: () => {
            if (contents.session && contents.session.addWordToSpellCheckerDictionary) {
              contents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
            }
          }
        });
        menuTemplate.push({ type: 'separator' });
      }

      const hasSelection = Boolean(params.selectionText && params.selectionText.trim().length > 0);

      // 2. Clipboard & Edit Actions
      if (params.isEditable) {
        menuTemplate.push({
          label: 'Deshacer',
          role: 'undo',
          enabled: params.editFlags.canUndo
        });
        menuTemplate.push({
          label: 'Rehacer',
          role: 'redo',
          enabled: params.editFlags.canRedo
        });
        menuTemplate.push({ type: 'separator' });
        menuTemplate.push({
          label: 'Cortar',
          role: 'cut',
          enabled: params.editFlags.canCut
        });
        menuTemplate.push({
          label: 'Copiar',
          role: 'copy',
          enabled: params.editFlags.canCopy || hasSelection
        });
        menuTemplate.push({
          label: 'Pegar',
          role: 'paste',
          enabled: params.editFlags.canPaste
        });
        menuTemplate.push({
          label: 'Seleccionar todo',
          role: 'selectAll',
          enabled: params.editFlags.canSelectAll
        });
      } else {
        if (hasSelection) {
          menuTemplate.push({
            label: 'Copiar',
            role: 'copy',
            enabled: true
          });
        }
        menuTemplate.push({
          label: 'Seleccionar todo',
          role: 'selectAll'
        });
      }

      // 3. Text-to-Speech (Lectura de la nota)
      menuTemplate.push({ type: 'separator' });
      if (hasSelection) {
        menuTemplate.push({
          label: '🔊 Leer selección en voz alta',
          click: () => {
            contents.send('tts:speak-selection', params.selectionText);
          }
        });
      }
      menuTemplate.push({
        label: '🔊 Leer toda la nota en voz alta',
        click: () => {
          contents.send('tts:speak-current-note');
        }
      });

      if (menuTemplate.length > 0) {
        const contextMenu = Menu.buildFromTemplate(menuTemplate);
        contextMenu.popup({ window: win });
      }
    });
  });

  app.whenReady().then(() => {
    // Configure Spellchecker Languages (prioritizing Latin American Spanish)
    if (session.defaultSession) {
      try {
        session.defaultSession.setSpellCheckerLanguages(['es-419', 'es-ES', 'es', 'en-US']);
      } catch (e) {
        try {
          session.defaultSession.setSpellCheckerLanguages(['es', 'en-US']);
        } catch (err) {}
      }

      // Intercept Edge Neural TTS WebSockets to set valid Edge Origin & User-Agent
      try {
        session.defaultSession.webRequest.onBeforeSendHeaders(
          { urls: ['*://speech.platform.bing.com/*', 'wss://speech.platform.bing.com/*'] },
          (details, callback) => {
            details.requestHeaders['Origin'] = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold';
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
            callback({ requestHeaders: details.requestHeaders });
          }
        );
      } catch (e) {
        console.warn('Error setting onBeforeSendHeaders for TTS:', e);
      }

      // Grant media and audio capture permissions
      // Solo se conceden los permisos que la app usa (micrófono, audio del sistema, portapapeles)
      // y únicamente a nuestras propias páginas. Todo lo demás se deniega.
      const ALLOWED_PERMISSIONS = new Set(['media', 'audioCapture', 'display-capture', 'clipboard-sanitized-write']);
      const isOwnPage = (url) => {
        try {
          const u = new URL(url);
          return u.protocol === 'file:' || u.host === 'localhost:5173';
        } catch {
          return false;
        }
      };
      session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(ALLOWED_PERMISSIONS.has(permission) && isOwnPage(webContents.getURL()));
      });
      session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        return ALLOWED_PERMISSIONS.has(permission) && isOwnPage(requestingOrigin || (webContents && webContents.getURL()) || '');
      });

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

    // Always create and display the Notebook Dock (clean small tabs pinned flush to screen edge)
    createDockWindow();

    // Check startup preference: default to starting with dock only so PC startup never pops open the big window!
    const settings = loadSettingsDirect();
    const startDockOnly = settings.startDockOnly !== false;
    const hasShowMainFlag = process.argv.includes('--show-main') || process.argv.includes('--open-main');

    if (!startDockOnly || hasShowMainFlag) {
      createWindow();
    }

    const { screen } = require('electron');
    screen.on('display-metrics-changed', () => {
      if (dockWindow && !dockWindow.isDestroyed()) {
        const s = loadSettingsDirect();
        const bounds = getDockBounds(s.dockPosition || 'right');
        dockWindow.setBounds(bounds);
      }
    });

    app.on('activate', () => {
      if (!dockWindow || dockWindow.isDestroyed()) {
        createDockWindow();
      }
      if (BrowserWindow.getAllWindows().length === 0) {
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

    // CRITICAL: Unpinning a note window must NEVER affect or demote the notebook dock!
    // The lateral dock tabs must ALWAYS stay pinned on top of the screen.
    if (dockWindow && !dockWindow.isDestroyed()) {
      const s = loadSettingsDirect();
      if (s.dockAlwaysOnTop !== false) {
        dockWindow.setAlwaysOnTop(true, 'screen-saver');
        dockWindow.moveTop();
      }
    }

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
    const sanitizedNotes = sanitizeNotesList(notes);
    const filePath = getDataFilePath();
    fs.writeFileSync(filePath, JSON.stringify(sanitizedNotes, null, 2), 'utf-8');

    // Clean up any orphaned markdown files on note deletion/rename
    cleanupOrphanedMarkdownFiles(sanitizedNotes);

    // Also mirror to local markdown files and broadcast to all open note windows and dock
    if (Array.isArray(sanitizedNotes)) {
      sanitizedNotes.forEach(note => {
        syncNoteToMarkdown(note);
        if (miniStickyWindows.has(note.id)) {
          const miniWin = miniStickyWindows.get(note.id);
          if (miniWin && !miniWin.isDestroyed()) {
            miniWin.webContents.send('mini:note-updated', note);
          }
        }
      });
    }

    // Also mirror to active storage folder (OneDrive, Google Drive, or Documents)
    try {
      const storageDir = getStorageDir();
      fs.writeFileSync(path.join(storageDir, 'stickyflow_database.json'), JSON.stringify(sanitizedNotes, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error mirroring stickyflow_database.json:', e);
    }

    // Auto-backup check (Daily / Weekly)
    try {
      const s = loadSettingsDirect();
      if (s.autoBackupEnabled !== false) {
        const lastTime = s.lastBackupTime ? new Date(s.lastBackupTime).getTime() : 0;
        const now = Date.now();
        const intervalHours = (s.autoBackupFrequency === 'weekly' ? 7 * 24 : 24);
        if (now - lastTime > intervalHours * 3600 * 1000) {
          createBackupFile(sanitizedNotes, s);
        }
      }
    } catch {}

    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed() && win.webContents !== _event.sender) {
        win.webContents.send('notes:updated', sanitizedNotes);
      }
    });

    if (dockWindow && !dockWindow.isDestroyed()) {
      dockWindow.webContents.send('dock:notes-updated', sanitizedNotes);
    }
    return { success: true };
  } catch (err) {
    console.error('Error saving notes:', err);
    return { success: false, error: err.message };
  }
});

// Clean Garbage: Purge deleted/ghost notes and orphaned markdown files
ipcMain.handle('notes:clean-garbage', () => {
  try {
    const filePath = getDataFilePath();
    let rawNotes = [];
    if (fs.existsSync(filePath)) {
      try {
        rawNotes = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}
    }

    const sanitizedNotes = sanitizeNotesList(rawNotes);
    const notesRemoved = Math.max(0, rawNotes.length - sanitizedNotes.length);
    const orphanedFilesRemoved = cleanupOrphanedMarkdownFiles(sanitizedNotes);

    // Save cleaned notes to both storage locations
    fs.writeFileSync(filePath, JSON.stringify(sanitizedNotes, null, 2), 'utf-8');
    try {
      const storageDir = getStorageDir();
      fs.writeFileSync(path.join(storageDir, 'stickyflow_database.json'), JSON.stringify(sanitizedNotes, null, 2), 'utf-8');
    } catch {}

    // Resync valid markdown files
    sanitizedNotes.forEach(note => syncNoteToMarkdown(note));

    // Broadcast clean notes to all open windows and dock
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('notes:updated', sanitizedNotes);
      }
    });

    if (dockWindow && !dockWindow.isDestroyed()) {
      dockWindow.webContents.send('dock:notes-updated', sanitizedNotes);
    }

    return {
      success: true,
      removedCount: notesRemoved + orphanedFilesRemoved,
      notesRemoved,
      orphanedFilesRemoved,
      remainingCount: sanitizedNotes.length
    };
  } catch (err) {
    console.error('Error cleaning notes garbage:', err);
    return { success: false, error: err.message, removedCount: 0, remainingCount: 0 };
  }
});

// Independent Windows IPC Handlers
ipcMain.handle('window:open-settings', () => {
  openSettingsWindow();
  return true;
});

ipcMain.handle('window:open-meeting', (_event, noteId) => {
  openMeetingWindow(noteId);
  return true;
});

// Backup & Cloud Storage IPC Handlers
ipcMain.handle('backup:get-info', () => {
  const settings = loadSettingsDirect();
  const clouds = detectCloudFolders();
  const backups = listBackups();
  return {
    activeStorageDir: getStorageDir(),
    detectedClouds: clouds,
    lastBackupTime: settings.lastBackupTime,
    lastBackupSize: settings.lastBackupSize,
    backupCount: backups.length,
    autoBackupEnabled: settings.autoBackupEnabled !== false,
    autoBackupFrequency: settings.autoBackupFrequency || 'daily'
  };
});

ipcMain.handle('backup:create-now', () => {
  const notesPath = getDataFilePath();
  let notes = [];
  try {
    if (fs.existsSync(notesPath)) {
      notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
    }
  } catch {}
  // Sanitize notes before backing up and clean orphaned files
  const sanitized = sanitizeNotesList(notes);
  try {
    fs.writeFileSync(notesPath, JSON.stringify(sanitized, null, 2), 'utf-8');
  } catch {}
  cleanupOrphanedMarkdownFiles(sanitized);

  const settings = loadSettingsDirect();
  return createBackupFile(sanitized, settings);
});

ipcMain.handle('backup:list', () => {
  return listBackups();
});

ipcMain.handle('backup:restore-file', (_event, filePath) => {
  let targetPath = filePath;
  if (!targetPath) {
    const list = listBackups();
    if (list.length > 0) {
      targetPath = list[0].filePath;
    }
  }
  if (!targetPath) {
    return { success: false, error: 'No se encontró ningún archivo de respaldo.' };
  }
  // El renderer no puede pedir leer archivos arbitrarios: debe ser un respaldo conocido.
  const known = new Set(listBackups().map(b => path.resolve(b.filePath)));
  if (!known.has(path.resolve(targetPath))) {
    return { success: false, error: 'Archivo de respaldo no válido.' };
  }
  return restoreBackupFromFile(targetPath);
});

ipcMain.handle('backup:export-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defaultPath = path.join(app.getPath('documents'), `StickyFlow_Backup_${dateStr}.json`);

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar Copia de Seguridad de StickyFlow',
    defaultPath,
    filters: [{ name: 'Copia de Seguridad StickyFlow (*.json)', extensions: ['json'] }]
  });

  if (canceled || !filePath) return { success: false };

  const notesPath = getDataFilePath();
  let notes = [];
  try {
    if (fs.existsSync(notesPath)) {
      notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
    }
  } catch {}
  const sanitized = sanitizeNotesList(notes);
  const settings = loadSettingsDirect();
  const backupPayload = {
    app: 'StickyFlow',
    version: '1.0.0',
    timestamp: d.toISOString(),
    notesCount: sanitized.length,
    notes: sanitized,
    settings: secureSettings.stripSecrets(settings)
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), 'utf-8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:import-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Restaurar Copia de Seguridad de StickyFlow',
    filters: [
      { name: 'Respaldos StickyFlow (*.json, *.stickyflow-backup)', extensions: ['json', 'stickyflow-backup'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { success: false };
  }

  return restoreBackupFromFile(filePaths[0]);
});

ipcMain.handle('backup:change-storage-dir', (_event, newPath, copyExisting) => {
  try {
    if (!newPath || typeof newPath !== 'string') {
      return { success: false, error: 'Ruta no válida' };
    }

    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }

    const settings = loadSettingsDirect();
    const oldDir = getStorageDir();
    settings.customStorageDir = newPath;

    // Detect cloud provider type
    const clouds = detectCloudFolders();
    const matched = clouds.find(c => path.resolve(c.path) === path.resolve(newPath));
    if (matched) {
      settings.cloudProvider = matched.type;
    } else {
      settings.cloudProvider = 'custom';
    }

    secureSettings.writeSettingsFile(getSettingsFilePath(), settings);

    // Optionally copy existing files to the new storage folder
    if (copyExisting && oldDir !== newPath && fs.existsSync(oldDir)) {
      try {
        const files = fs.readdirSync(oldDir);
        for (const file of files) {
          const src = path.join(oldDir, file);
          const dest = path.join(newPath, file);
          if (fs.statSync(src).isFile() && !fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
          }
        }
      } catch (e) {
        console.warn('Error copying files to new storage dir:', e);
      }
    }

    // Mirror current notes to new location
    try {
      const notesPath = getDataFilePath();
      if (fs.existsSync(notesPath)) {
        const notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
        fs.writeFileSync(path.join(newPath, 'stickyflow_database.json'), JSON.stringify(notes, null, 2), 'utf-8');
        notes.forEach(n => syncNoteToMarkdown(n));
      }
    } catch {}

    return { success: true, dir: newPath };
  } catch (err) {
    console.error('Error changing storage dir:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:select-folder-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Seleccionar Carpeta para Notas y Copia de Seguridad',
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return null;
  }
  return filePaths[0];
});

ipcMain.handle('settings:load', () => {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const parsed = secureSettings.readSettingsFile(filePath) || {};
      if (
        !parsed.hfModel ||
        parsed.hfModel === 'openai/gpt-oss-120b' ||
        parsed.hfModel.includes('Mistral-7B-Instruct-v0.3')
      ) {
        parsed.hfModel = 'Qwen/Qwen2.5-72B-Instruct';
      }
      if (parsed.dockAlwaysOnTop === undefined) parsed.dockAlwaysOnTop = true;
      if (parsed.startDockOnly === undefined) parsed.startDockOnly = true;
      if (!parsed.ttsVoice) parsed.ttsVoice = 'es-MX-DaliaNeural';
      if (parsed.useNeuralTts === undefined) parsed.useNeuralTts = true;
      if (parsed.autoBackupEnabled === undefined) parsed.autoBackupEnabled = true;
      if (!parsed.autoBackupFrequency) parsed.autoBackupFrequency = 'daily';
      return parsed;
    }
    return {
      hfEndpoint: 'https://router.huggingface.co/v1',
      hfModel: 'Qwen/Qwen2.5-72B-Instruct',
      hfApiKey: '',
      claudeApiKey: '',
      activeAiProvider: 'huggingface',
      alwaysOnTop: true,
      defaultColor: 'yellow',
      opacity: 0.98,
      startDockOnly: true,
      ttsVoice: 'es-MX-DaliaNeural',
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVolume: 1.0,
      useNeuralTts: true,
      autoBackupEnabled: true,
      autoBackupFrequency: 'daily',
      dockPosition: 'right',
      dockShowTitles: true,
      dockEnabled: true,
      dockAlwaysOnTop: true,
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
    secureSettings.writeSettingsFile(filePath, settings);
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
        dockWindow.setAlwaysOnTop(settings.dockAlwaysOnTop, 'screen-saver');
        if (settings.dockAlwaysOnTop) {
          dockWindow.moveTop();
        }
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
    secureSettings.writeSettingsFile(sPath, settings);
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
          secureSettings.writeSettingsFile(getSettingsFilePath(), settings);
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
    secureSettings.writeSettingsFile(sPath, settings);
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
    secureSettings.writeSettingsFile(sPath, settings);
  } catch (err) {
    console.error('Error saving settings dockAlwaysOnTop:', err);
  }
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.setAlwaysOnTop(settings.dockAlwaysOnTop, 'screen-saver');
    if (settings.dockAlwaysOnTop) {
      dockWindow.moveTop();
    }
    dockWindow.webContents.send('dock:settings-updated', settings);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dock:settings-updated', settings);
  }
  return settings.dockAlwaysOnTop;
});

ipcMain.handle('dock:bring-to-top', () => {
  if (dockWindow && !dockWindow.isDestroyed()) {
    const settings = loadSettingsDirect();
    if (settings.dockAlwaysOnTop !== false) {
      dockWindow.setAlwaysOnTop(true, 'screen-saver');
      dockWindow.moveTop();
    }
  }
  return true;
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


