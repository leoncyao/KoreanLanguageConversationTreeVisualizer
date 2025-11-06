import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import { initBackgroundAudio } from './backgroundAudio';
import { setPrefetchQueueSize } from './audioTTS';

// Initialize background audio system for Android Brave/Chrome
initBackgroundAudio();

// Set prefetch queue size to 100 by default (preloads next audio while current plays)
setPrefetchQueueSize(100);

// Register service worker only in secure contexts to avoid dev/HMR issues
const isLocalhost = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]'
);
const isSecure = window.isSecureContext || window.location.protocol === 'https:' || isLocalhost;
const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
const hasHMR = typeof module !== 'undefined' && !!module.hot;
const noSwParam = /[?&]nosw=1\b/.test(window.location.search);
const forceSwParam = /[?&]sw=1\b/.test(window.location.search);
// Default OFF unless explicitly enabled via ?sw=1; avoids any refresh loops until stabilized
const shouldUseSW = isSecure && !hasHMR && !noSwParam && forceSwParam;
// If we shouldn't use SW (e.g., HMR/dev), proactively unregister any existing workers
if ('serviceWorker' in navigator && !shouldUseSW) {
  navigator.serviceWorker.getRegistrations().then(async (regs) => {
    let hadActive = false;
    await Promise.all(regs.map(async (r) => {
      try {
        if (r.active) hadActive = true;
        await r.unregister();
      } catch (_) {}
    }));
    // Clear caches to avoid stale app shell
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    // Reload once to drop SW controller if there was one
    try {
      if (hadActive && !sessionStorage.getItem('sw_unregistered_once')) {
        sessionStorage.setItem('sw_unregistered_once', '1');
        window.location.replace(window.location.href.replace(/([?&])sw=1\b/, '$1')); // ensure not forcing sw
      }
    } catch (_) {}
  });
}

if ('serviceWorker' in navigator && shouldUseSW) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);

        // Detect new updates to the Service Worker
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.onstatechange = () => {
            if (newWorker.state === 'installed') {
              if (!isProd) {
                // In development, do NOT auto-prompt/reload to avoid reload loops
                console.log('SW installed (dev): skipping auto-reload prompt.');
                return;
              }
              if (navigator.serviceWorker.controller) {
                // New version available
                console.log('New version available!');
                // Throttle reloads to avoid loops
                const RELOAD_THROTTLE_MS = 10000;
                const last = Number(sessionStorage.getItem('sw_last_reload_ts') || '0');
                const now = Date.now();
                if (now - last < RELOAD_THROTTLE_MS) {
                  console.log('Reload throttled.');
                  return;
                }
                if (confirm('New version available. Reload now?')) {
                  sessionStorage.setItem('sw_last_reload_ts', String(now));
                  window.location.reload();
                }
              } else {
                console.log('Content cached for offline use.');
              }
            }
          };
        };
      })
      .catch((err) => console.error('SW registration failed:', err));
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
