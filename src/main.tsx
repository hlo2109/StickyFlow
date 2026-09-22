import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { MiniStickyView } from './components/MiniStickyView';
import './index.css';

// Check if window was opened as a Mini Sticky widget
const urlParams = new URLSearchParams(window.location.search);
const isMini = urlParams.get('mode') === 'mini' || window.location.hash.includes('mode=mini');
const miniNoteId = urlParams.get('noteId') || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isMini ? <MiniStickyView noteId={miniNoteId} /> : <App />}
  </React.StrictMode>
);
