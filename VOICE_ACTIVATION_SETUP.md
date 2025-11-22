# Voice Activation Setup for Android (Hey Google)

This guide explains how to enable "Hey Google" voice activation for your Korean Learning web app on Pixel phones.

## Prerequisites

1. **HTTPS Required**: Your app must be served over HTTPS (not HTTP)
2. **PWA Installed**: The app must be installed as a PWA on the device
3. **Domain Verification**: You need access to your domain to add verification files

## Method 1: Android App Links (Recommended)

This allows Google Assistant to open your app via voice commands like "Hey Google, open Korean Learning".

### Step 1: Update manifest.json

Your manifest.json already has `url_handlers` configured. Ensure it includes your domain:

```json
"url_handlers": [
  {
    "origin": "https://neonleon.ca"
  }
]
```

### Step 2: Create Digital Asset Links File

Create a file at: `public/.well-known/assetlinks.json`

This file verifies your domain ownership and enables Android App Links.

**Important**: Replace `YOUR_PACKAGE_NAME` and `YOUR_SHA256_FINGERPRINT` with your actual values.

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "web",
    "site": "https://neonleon.ca"
  }
}]
```

### Step 3: Get Your App's SHA-256 Fingerprint

For a PWA, you need to generate a SHA-256 fingerprint. Since PWAs don't have a traditional package, you can:

1. **Option A**: Use your domain's SSL certificate fingerprint
   ```bash
   openssl s_client -connect neonleon.ca:443 -servername neonleon.ca < /dev/null 2>/dev/null | openssl x509 -fingerprint -sha256 -noout -in /dev/stdin
   ```

2. **Option B**: Create a simple Android app wrapper and use its fingerprint
   - Create a minimal Android app with the same domain
   - Get its SHA-256 from Google Play Console or `keytool -list -v -keystore your.keystore`

### Step 4: Deploy assetlinks.json

1. Upload `public/.well-known/assetlinks.json` to your server
2. Ensure it's accessible at: `https://neonleon.ca/.well-known/assetlinks.json`
3. Verify with: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://neonleon.ca&relation=delegate_permission/common.handle_all_urls

### Step 5: Install PWA on Device

1. Open Chrome on your Pixel phone
2. Navigate to `https://neonleon.ca`
3. Tap the menu (3 dots) → "Install app" or "Add to Home screen"
4. Confirm installation

### Step 6: Test Voice Activation

1. Say: **"Hey Google, open Korean Learning"**
2. Or: **"Hey Google, launch Korean Learning app"**
3. Or: **"Hey Google, open neonleon.ca"**

## Method 2: Google Assistant App Actions (Advanced)

This allows custom voice commands like "Hey Google, translate to Korean" that directly open specific features.

### Requirements

1. Google Cloud Project
2. Actions Console setup
3. Firebase project (optional but recommended)

### Step 1: Create Actions in Google Cloud

1. Go to [Actions Console](https://console.actions.google.com/)
2. Create a new project
3. Add "App Actions" capability
4. Configure intents for your app features:
   - "Translate to Korean" → opens `/translate`
   - "Practice Korean" → opens `/quiz-mode`
   - "View Korean stats" → opens `/stats`

### Step 2: Configure App Actions

Create an `actions.xml` file (for native apps) or use web-based actions.

For PWAs, you'll need to:
1. Set up App Actions via Actions Console
2. Link your web app domain
3. Configure voice shortcuts

### Step 3: Test in Google Assistant

1. Say: **"Hey Google, translate to Korean"**
2. Assistant should open your app at the translate page

## Method 3: Manual Voice Shortcuts (Easiest)

Users can create custom voice shortcuts manually:

1. Open Google Assistant on Pixel
2. Say: **"Hey Google, open Assistant settings"**
3. Go to: **Shortcuts** → **Add shortcut**
4. Create shortcut:
   - **When I say**: "Open Korean Learning"
   - **Google Assistant should**: Open app "Korean Learning"

## Troubleshooting

### App doesn't open via voice

1. **Check PWA installation**: Ensure app is installed (not just bookmarked)
2. **Verify HTTPS**: Must be served over HTTPS
3. **Check manifest.json**: Ensure `start_url` and `scope` are correct
4. **Clear cache**: Clear Google Assistant cache in Android settings
5. **Reinstall PWA**: Uninstall and reinstall the PWA

### assetlinks.json not working

1. **Verify file is accessible**: Check `https://neonleon.ca/.well-known/assetlinks.json` in browser
2. **Check Content-Type**: Should be `application/json`
3. **Verify JSON syntax**: Use a JSON validator
4. **Check robots.txt**: Ensure `.well-known` directory isn't blocked

### Voice commands not recognized

1. **Use exact app name**: Say the exact name from manifest.json ("Korean Learning")
2. **Check language**: Ensure Google Assistant language matches
3. **Retrain voice model**: Go to Assistant settings → Voice Match

## Testing Commands

Try these voice commands after setup:

- "Hey Google, open Korean Learning"
- "Hey Google, launch Korean Learning app"
- "Hey Google, open Korean Learning app"
- "Hey Google, start Korean Learning"
- "Hey Google, translate to Korean" (if App Actions configured)

## Additional Resources

- [Android App Links Documentation](https://developer.android.com/training/app-links)
- [Digital Asset Links](https://developers.google.com/digital-asset-links)
- [Google Assistant App Actions](https://developers.google.com/assistant/app/overview)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)











