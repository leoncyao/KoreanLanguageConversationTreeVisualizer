import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import { initBackgroundAudio } from './backgroundAudio';

// Initialize background audio system for Android Brave/Chrome
initBackgroundAudio();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch((err) => console.error('SW registration failed:', err));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
