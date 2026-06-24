import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import './ui/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for PWA offline support.
//
// Only in production: the service worker uses a cache-first strategy for all
// same-origin GETs, which is incompatible with the Vite dev server — it would
// serve stale transformed modules (and a stale index.html) indefinitely,
// breaking HMR and masking source changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app still works without it
    });
  });
}
