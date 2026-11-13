const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window actions
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:getAlwaysOnTop'),
  setOpacity: (val) => ipcRenderer.invoke('window:setOpacity', val),
  resizeWindow: (width, height) => ipcRenderer.invoke('window:resize', { width, height }),

  // Storage & Backup (Cloud & Local)
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getBackupInfo: () => ipcRenderer.invoke('backup:get-info'),
  createBackup: () => ipcRenderer.invoke('backup:create-now'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (filePath) => ipcRenderer.invoke('backup:restore-file', filePath),
  exportBackupDialog: () => ipcRenderer.invoke('backup:export-dialog'),
  importBackupDialog: () => ipcRenderer.invoke('backup:import-dialog'),
  changeStorageDir: (newPath, copyExisting) => ipcRenderer.invoke('backup:change-storage-dir', newPath, copyExisting),
  selectFolderDialog: () => ipcRenderer.invoke('backup:select-folder-dialog'),
  cleanNotesGarbage: () => ipcRenderer.invoke('notes:clean-garbage'),

  // Independent Windows (Configuración y Dictado/Reunión)
  openSettingsWindow: () => ipcRenderer.invoke('window:open-settings'),
  openNotesList: () => ipcRenderer.invoke('window:open-notes-list'),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  syncConnect: (data) => ipcRenderer.invoke('sync:connect', data),
  syncConnectToken: (data) => ipcRenderer.invoke('sync:connect-token', data),
  syncDisconnect: () => ipcRenderer.invoke('sync:disconnect'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  onSyncStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('sync:status', handler);
    return () => ipcRenderer.removeListener('sync:status', handler);
  },
  openNoteDraft: (note) => ipcRenderer.invoke('note:open-draft', note),
  takeNoteDraft: (noteId) => ipcRenderer.invoke('note:take-draft', noteId),
  openMeetingWindow: (noteId, view) => ipcRenderer.invoke('window:open-meeting', noteId, view),

  // File system & Folder integration for Claude / User
  openNotesFolder: () => ipcRenderer.invoke('notes:openFolder'),
  getNotesFolderPath: () => ipcRenderer.invoke('notes:getFolderPath'),
  exportNoteMarkdown: (note) => ipcRenderer.invoke('notes:exportMarkdown', note),

  // Clipboard
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  openSoundPanel: (tab) => ipcRenderer.invoke('system:open-sound-panel', tab),
  createShortcuts: () => ipcRenderer.invoke('system:create-shortcuts'),
  openTaskbarSettings: () => ipcRenderer.invoke('system:open-taskbar-settings'),
  getShortcutStatus: () => ipcRenderer.invoke('system:shortcut-status'),

  // Audio / Desktop Sources
  getDesktopSources: () => ipcRenderer.invoke('system-audio:getSources'),

  // Mini Stickies (multi-window floating desktop widgets)
  openMiniSticky: (note) => ipcRenderer.invoke('sticky:openMini', note),
  closeMiniSticky: (noteId) => ipcRenderer.invoke('sticky:closeMini', noteId),
  toggleMiniSticky: (note) => ipcRenderer.invoke('sticky:toggleMini', note),
  getOpenMiniStickies: () => ipcRenderer.invoke('sticky:getOpenList'),
  expandMiniSticky: (noteId) => ipcRenderer.invoke('sticky:expand', noteId),

  // Listeners
  onAlwaysOnTopChanged: (callback) => {
    ipcRenderer.on('always-on-top-changed', (_event, value) => callback(value));
  },
  onMiniStickyStatusChanged: (callback) => {
    ipcRenderer.on('mini-sticky-status-changed', (_event, data) => callback(data));
  },
  onNoteUpdated: (callback) => {
    ipcRenderer.on('mini:note-updated', (_event, note) => callback(note));
  },
  onSelectNote: (callback) => {
    ipcRenderer.on('select-note', (_event, noteId) => callback(noteId));
  },

  // Notebook Separators Dock
  setDockMouseIgnore: (ignore) => ipcRenderer.invoke('dock:set-ignore-mouse', ignore),
  setDockPosition: (pos) => ipcRenderer.invoke('dock:set-position', pos),
  setDockAlwaysOnTop: (val) => ipcRenderer.invoke('dock:set-always-on-top', val),
  bringDockToTop: () => ipcRenderer.invoke('dock:bring-to-top'),
  openNoteInMain: (noteId) => ipcRenderer.invoke('dock:open-note', noteId),
  openNoteWindow: (noteId) => ipcRenderer.invoke('dock:open-note-window', noteId),
  toggleDockPin: (noteId) => ipcRenderer.invoke('dock:toggle-pin', noteId),
  getDockedNotes: () => ipcRenderer.invoke('dock:get-docked-ids'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  onNotesUpdated: (callback) => {
    ipcRenderer.on('notes:updated', (_event, notes) => callback(notes));
  },
  onDockNotesUpdated: (callback) => {
    ipcRenderer.on('dock:notes-updated', (_event, notes) => callback(notes));
  },
  onDockSettingsUpdated: (callback) => {
    ipcRenderer.on('dock:settings-updated', (_event, settings) => callback(settings));
  },
  onDockedIdsChanged: (callback) => {
    ipcRenderer.on('dock:ids-changed', (_event, ids) => callback(ids));
  },

  // Text-to-Speech context menu triggers
  onTtsSpeakSelection: (callback) => {
    ipcRenderer.removeAllListeners('tts:speak-selection');
    ipcRenderer.on('tts:speak-selection', (_event, text) => callback(text));
  },
  onTtsSpeakCurrentNote: (callback) => {
    ipcRenderer.removeAllListeners('tts:speak-current-note');
    ipcRenderer.on('tts:speak-current-note', () => callback());
  },

  // Meeting window target note update
  onMeetingSetView: (callback) => {
    ipcRenderer.on('meeting:set-view', (_event, view) => callback(view));
  },
  onMeetingSetNoteId: (callback) => {
    ipcRenderer.on('meeting:set-note-id', (_event, noteId) => callback(noteId));
  }
});

