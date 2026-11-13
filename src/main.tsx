import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { MiniStickyView } from './components/MiniStickyView';
import { NotebookDockView } from './components/NotebookDockView';
import { SettingsWindowView } from './components/SettingsWindowView';
import { MeetingWindowView } from './components/MeetingWindowView';
import './index.css';

// Check window render mode
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
const targetNoteId = urlParams.get('noteId') || '';

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
    ) : (
      <App />
    )}
  </React.StrictMode>
);
