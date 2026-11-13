import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { MiniStickyView } from './components/MiniStickyView';
import { NotebookDockView } from './components/NotebookDockView';
import { NotesListWindow } from './components/NotesListWindow';
import { SettingsWindowView } from './components/SettingsWindowView';
import { MeetingWindowView } from './components/MeetingWindowView';
import './index.css';

// Qué se dibuja en esta ventana, según su URL
const urlParams = new URLSearchParams(window.location.search);
const hash = window.location.hash;
const mode =
  urlParams.get('mode') ||
  (hash.includes('mode=settings')
    ? 'settings'
    : hash.includes('mode=meeting')
    ? 'meeting'
    : hash.includes('mode=mini')
    ? 'mini'
    : hash.includes('mode=dock')
    ? 'dock'
    : '');

const isDock = mode === 'dock';
const isMini = mode === 'mini';
const isSettings = mode === 'settings';
const isMeeting = mode === 'meeting';
// El id de la nota puede venir en la consulta (?noteId=) o en el hash (#noteId=)
const targetNoteId = urlParams.get('noteId') || new URLSearchParams(hash.replace(/^#/, '')).get('noteId') || '';

// Ventana de una NOTA (editor): trae noteId. Sin noteId, la ventana principal es la LISTA DE NOTAS.
// (Fuera de Electron, p. ej. en el navegador durante el desarrollo, se mantiene el editor.)
const isNoteWindow = Boolean(targetNoteId) || !window.electronAPI;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDock ? (
      <NotebookDockView />
    ) : isMini ? (
      <MiniStickyView noteId={targetNoteId} />
    ) : isSettings ? (
      <SettingsWindowView />
    ) : isMeeting ? (
      <MeetingWindowView noteId={targetNoteId} />
    ) : isNoteWindow ? (
      <App />
    ) : (
      <NotesListWindow />
    )}
  </React.StrictMode>
);
