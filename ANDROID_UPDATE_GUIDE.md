# Android App Update Guide

This guide explains how to update the Korean Language Learning app on Android devices and how users can download updated versions.

## Current App Architecture

This app is a **Progressive Web App (PWA)** that can be installed on Android devices. It's not a native Android app (APK), but rather a web app that runs in a browser-like container when installed.

## Update Mechanisms

### 1. Automatic Service Worker Updates (Currently Implemented)

**How it works:**
- The app uses a Service Worker (`public/sw.js`) for offline functionality
- When you deploy a new version, the Service Worker file changes
- Android automatically detects the change and prompts users to reload

**Current implementation:**
- Service Worker version is tracked in `public/sw.js` (currently `v1.0.1`)
- Update detection happens in `public/src/index.js`
- Users see a confirmation dialog: "New version available. Reload now?"

**Limitations:**
- Only works when the Service Worker file changes
- Requires user confirmation to reload
- May not detect updates if the user hasn't visited the app in a while

### 2. In-App Update Checker (Recommended Addition)

Add a manual "Check for Updates" button that users can tap to check for new versions.

**Implementation Steps:**

#### A. Create Version API Endpoint

Add to `backend/server.js`:

```javascript
// Version endpoint
app.get('/api/version', async (req, res) => {
  try {
    const packageJson = require('../package.json');
    const swVersion = 'v1.0.1'; // Should match public/sw.js VERSION
    res.json({
      appVersion: packageJson.version,
      serviceWorkerVersion: swVersion,
      buildDate: new Date().toISOString(),
      updateAvailable: false // Can be set based on client version comparison
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get version' });
  }
});
```

#### B. Create Update Checker Component

Create `public/src/components/UpdateChecker.js`:

```javascript
import React, { useState, useEffect } from 'react';
import { api } from '../api';

function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      // Check Service Worker registration
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update(); // Force check for SW updates
        }
      }

      // Check server version
      const res = await api.getVersion();
      if (res.ok) {
        const versionInfo = await res.json();
        setLatestVersion(versionInfo);
        
        // Compare versions (simplified - you can use semver for proper comparison)
        const swVersion = 'v1.0.1'; // Current SW version from sw.js
        if (versionInfo.serviceWorkerVersion !== swVersion) {
          setUpdateAvailable(true);
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setChecking(false);
    }
  };

  const applyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        } else {
          window.location.reload();
        }
      });
    } else {
      window.location.reload();
    }
  };

  // Auto-check on mount (optional - can be removed if you only want manual checks)
  useEffect(() => {
    // Check once per session
    const lastCheck = sessionStorage.getItem('lastUpdateCheck');
    const now = Date.now();
    if (!lastCheck || (now - parseInt(lastCheck)) > 3600000) { // Check every hour
      checkForUpdates();
      sessionStorage.setItem('lastUpdateCheck', String(now));
    }
  }, []);

  if (!updateAvailable && !checking) return null;

  return (
    <div style={{
      padding: '12px',
      margin: '8px',
      background: updateAvailable ? '#d4edda' : '#f8f9fa',
      border: `1px solid ${updateAvailable ? '#28a745' : '#dee2e6'}`,
      borderRadius: '6px',
      fontSize: '14px'
    }}>
      {checking ? (
        <div>Checking for updates...</div>
      ) : updateAvailable ? (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            ✨ Update Available!
          </div>
          <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
            Version {latestVersion?.serviceWorkerVersion || 'new'} is available
          </div>
          <button
            onClick={applyUpdate}
            style={{
              padding: '6px 12px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Update Now
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UpdateChecker;
```

#### C. Add Update Check Button to Navbar

Add to `public/src/Navbar.js`:

```javascript
import UpdateChecker from './components/UpdateChecker';

// In the Navbar component, add:
<div style={{ marginTop: '8px' }}>
  <UpdateChecker />
  <button
    onClick={async () => {
      // Trigger update check
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          alert('Update check complete. If an update is available, you will be prompted to reload.');
        }
      }
    }}
    style={{
      padding: '6px 12px',
      fontSize: '12px',
      marginTop: '4px'
    }}
  >
    Check for Updates
  </button>
</div>
```

#### D. Add Version API to api.js

Add to `public/src/api.js`:

```javascript
getVersion: () => fetch(`${API_BASE_URL}/api/version`),
```

### 3. Periodic Background Update Checks

Enhance the Service Worker to check for updates periodically:

**Update `public/sw.js`:**

```javascript
// Add at the end of sw.js
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic update check (every 6 hours)
setInterval(() => {
  self.registration.update();
}, 6 * 60 * 60 * 1000);
```

### 4. APK Distribution (If Packaging as Native App)

If you want to distribute the app as a native Android APK, you have two options:

#### Option A: Trusted Web Activity (TWA) - Recommended

**What it is:**
- Wraps your PWA in a native Android app shell
- Users get an APK they can install
- App still runs as a web app, but appears as a native app
- Can be published to Google Play Store

**Tools:**
- [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) - CLI tool to create TWA
- [PWA Builder](https://www.pwabuilder.com/) - Web-based tool

**Steps:**
1. Install Bubblewrap:
   ```bash
   npm install -g @bubblewrap/cli
   ```

2. Initialize TWA:
   ```bash
   bubblewrap init --manifest https://neonleon.ca/manifest.json
   ```

3. Build APK:
   ```bash
   bubblewrap build
   ```

4. Update APK:
   - Increment version in `twa-manifest.json`
   - Rebuild: `bubblewrap build`
   - Distribute new APK

**Update Mechanism for TWA:**
- Users can download new APK from your website
- Or publish to Google Play Store for automatic updates
- Or implement in-app update check that downloads APK

#### Option B: Capacitor (Full Native App)

**What it is:**
- Converts web app to fully native Android/iOS app
- More control, but more complex

**Steps:**
1. Install Capacitor:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npm install @capacitor/android
   ```

2. Initialize:
   ```bash
   npx cap init
   npx cap add android
   ```

3. Build and sync:
   ```bash
   npm run build
   npx cap sync android
   ```

4. Open in Android Studio:
   ```bash
   npx cap open android
   ```

**Update Mechanism:**
- Build new APK in Android Studio
- Increment version in `android/app/build.gradle`
- Distribute via:
  - Google Play Store (automatic updates)
  - Direct APK download from your website
  - In-app update checker with APK download

### 5. In-App APK Download (For Direct Distribution)

If distributing APKs directly (not through Play Store), add an in-app downloader:

**Create `public/src/components/ApkDownloader.js`:**

```javascript
import React, { useState } from 'react';

function ApkDownloader() {
  const [downloading, setDownloading] = useState(false);
  const APK_URL = 'https://neonleon.ca/downloads/app.apk'; // Your APK URL
  const VERSION_CHECK_URL = 'https://neonleon.ca/api/version';

  const checkAndDownload = async () => {
    setDownloading(true);
    try {
      // Check if update is needed
      const res = await fetch(VERSION_CHECK_URL);
      const versionInfo = await res.json();
      
      // Compare versions (implement your version comparison logic)
      const needsUpdate = true; // Replace with actual comparison
      
      if (needsUpdate) {
        // Download APK
        window.location.href = APK_URL;
      } else {
        alert('You have the latest version!');
      }
    } catch (error) {
      console.error('Error checking version:', error);
      // Still allow download
      window.location.href = APK_URL;
    } finally {
      setDownloading(false);
    }
  };

  // Detect if running as installed PWA
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone || 
                      document.referrer.includes('android-app://');

  if (!isInstalled) return null; // Only show if app is installed

  return (
    <div style={{ padding: '12px', margin: '8px', background: '#e7f3ff', border: '1px solid #2196F3', borderRadius: '6px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        📱 Native App Available
      </div>
      <div style={{ fontSize: '12px', marginBottom: '8px', color: '#666' }}>
        Download the native Android app for better performance and automatic updates.
      </div>
      <button
        onClick={checkAndDownload}
        disabled={downloading}
        style={{
          padding: '8px 16px',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: downloading ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }}
      >
        {downloading ? 'Downloading...' : 'Download APK'}
      </button>
    </div>
  );
}

export default ApkDownloader;
```

## Recommended Update Strategy

### For PWA (Current Setup):

1. **Automatic Updates (Service Worker)**
   - Already implemented
   - Works when SW file changes
   - Users get prompt to reload

2. **Manual Update Check**
   - Add "Check for Updates" button in settings
   - Implement version API endpoint
   - Show update notification when available

3. **Periodic Checks**
   - Check for updates on app launch (once per session)
   - Check every hour if app is open

### For APK Distribution:

1. **Google Play Store** (Best for automatic updates)
   - Publish APK to Play Store
   - Users get automatic updates via Play Store
   - No in-app update code needed

2. **Direct APK Distribution**
   - Host APK on your server
   - Add in-app update checker
   - Download and install new APK when available
   - Requires user to enable "Install from unknown sources"

## Implementation Priority

1. **High Priority**: Add version API endpoint and manual update check button
2. **Medium Priority**: Enhance Service Worker update detection
3. **Low Priority**: APK packaging (only if you want native app distribution)

## Testing Checklist

- [ ] Version API endpoint returns correct version info
- [ ] Update checker detects new versions
- [ ] Service Worker updates trigger reload prompt
- [ ] Manual update check button works
- [ ] Update notification appears when new version available
- [ ] App reloads correctly after update
- [ ] Works on Android devices (test on real device)
- [ ] Works when app is installed as PWA
- [ ] Works when app is opened in browser

## Notes

- **PWA Updates**: Work automatically when Service Worker changes, but users must reload
- **APK Updates**: Require downloading and installing new APK (unless using Play Store)
- **Version Tracking**: Keep `package.json` version and `sw.js` VERSION in sync
- **User Experience**: Always provide clear feedback about update status
- **Offline**: Update checks require internet connection

