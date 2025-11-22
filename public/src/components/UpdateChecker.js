import React, { useState, useEffect } from 'react';
import { api } from '../api';

/**
 * UpdateChecker component for detecting and applying app updates
 * Works with Service Worker updates for PWA installations
 */
function UpdateChecker({ showButton = true, autoCheck = true }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');

  // Get current Service Worker version
  const getCurrentSWVersion = () => {
    // This should match the VERSION constant in public/sw.js
    // In a real implementation, you might want to read this from a config file
    return 'v1.0.1'; // Update this when you update sw.js
  };

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateMessage('');
    
    try {
      // Check Service Worker registration
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Force check for SW updates
          await registration.update();
        }
      }

      // Check server version
      const res = await api.getVersion();
      if (res.ok) {
        const versionInfo = await res.json();
        setLatestVersion(versionInfo);
        
        // Compare Service Worker versions
        const currentSW = getCurrentSWVersion();
        const serverSW = versionInfo.serviceWorkerVersion;
        
        if (serverSW && serverSW !== currentSW) {
          setUpdateAvailable(true);
          setUpdateMessage(`Version ${serverSW} is available (you have ${currentSW})`);
        } else {
          setUpdateMessage('You have the latest version!');
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setUpdateMessage('Unable to check for updates. Please check your connection.');
    } finally {
      setChecking(false);
    }
  };

  const applyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          if (registration.waiting) {
            // Tell the waiting service worker to skip waiting and activate
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          // Reload the page to get the new version
          window.location.reload();
        } else {
          // No service worker, just reload
          window.location.reload();
        }
      });
    } else {
      // No service worker support, just reload
      window.location.reload();
    }
  };

  // Auto-check on mount (optional)
  useEffect(() => {
    if (autoCheck) {
      // Check once per session
      const lastCheck = sessionStorage.getItem('lastUpdateCheck');
      const now = Date.now();
      const oneHour = 3600000;
      
      if (!lastCheck || (now - parseInt(lastCheck)) > oneHour) {
        checkForUpdates();
        sessionStorage.setItem('lastUpdateCheck', String(now));
      }
    }
  }, [autoCheck]);

  // Listen for Service Worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (!registration) return;

        // Check for updates periodically
        const updateInterval = setInterval(() => {
          registration.update();
        }, 6 * 60 * 60 * 1000); // Every 6 hours

        // Listen for updatefound event
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              setUpdateAvailable(true);
              setUpdateMessage('A new version is available!');
            }
          });
        });

        return () => clearInterval(updateInterval);
      });
    }
  }, []);

  if (!showButton && !updateAvailable) return null;

  return (
    <div style={{
      padding: '12px',
      margin: '8px 0',
      background: updateAvailable ? '#d4edda' : '#f8f9fa',
      border: `1px solid ${updateAvailable ? '#28a745' : '#dee2e6'}`,
      borderRadius: '6px',
      fontSize: '14px'
    }}>
      {checking ? (
        <div>🔄 Checking for updates...</div>
      ) : updateAvailable ? (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#155724' }}>
            ✨ Update Available!
          </div>
          {updateMessage && (
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              {updateMessage}
            </div>
          )}
          <button
            onClick={applyUpdate}
            style={{
              padding: '8px 16px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              marginRight: '8px'
            }}
          >
            Update Now
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Later
          </button>
        </div>
      ) : showButton ? (
        <div>
          {updateMessage && (
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              {updateMessage}
            </div>
          )}
          <button
            onClick={checkForUpdates}
            style={{
              padding: '6px 12px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Check for Updates
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UpdateChecker;

