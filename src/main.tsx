import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { MiniStickyView } from './components/MiniStickyView';
import { NotebookDockView } from './components/NotebookDockView';
import './index.css';

// Check window render mode
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode') || (window.location.hash.includes('mode=mini') ? 'mini' : window.location.hash.includes('mode=dock') ? 'dock' : '');
const isMini = mode === 'mini';
const isDock = mode === 'dock';
const miniNoteId = urlParams.get('noteId') || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDock ? (
      <NotebookDockView />
    ) : isMini ? (
      <MiniStickyView noteId={miniNoteId} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
