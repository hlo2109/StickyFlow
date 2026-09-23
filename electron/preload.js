const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window actions
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:getAlwaysOnTop'),
  setOpacity: (val) => ipcRenderer.invoke('window:setOpacity', val),
  resizeWindow: (width, height) => ipcRenderer.invoke('window:resize', { width, height }),

  // Storage
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // File system & Folder integration for Claude / User
  openNotesFolder: () => ipcRenderer.invoke('notes:openFolder'),
  getNotesFolderPath: () => ipcRenderer.invoke('notes:getFolderPath'),
  exportNoteMarkdown: (note) => ipcRenderer.invoke('notes:exportMarkdown', note),

  // Clipboard
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

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
  }
});

