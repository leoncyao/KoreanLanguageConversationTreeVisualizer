# HTTPS Setup Guide

Recording on Android requires HTTPS due to browser security policies. Here are your options:

## Option 1: Use Let's Encrypt (Free, Recommended for Production)

1. **Install certbot**:
   ```bash
   sudo apt-get update
   sudo apt-get install certbot
   ```

2. **Get certificates** (replace `yourdomain.com` with your domain):
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

3. **Certificates location**: 
   - Certificate: `/etc/letsencrypt/live/yourdomain.com/fullchain.pem`
   - Private Key: `/etc/letsencrypt/live/yourdomain.com/privkey.pem`

4. **Copy to backend/ssl/**:
   ```bash
   mkdir -p backend/ssl
   sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem backend/ssl/cert.pem
   sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem backend/ssl/key.pem
   sudo chown $USER:$USER backend/ssl/*.pem
   ```

5. **Auto-renewal**: Certbot certificates expire after 90 days. Set up auto-renewal:
   ```bash
   sudo systemctl enable certbot.timer
   sudo systemctl start certbot.timer
   ```

## Option 2: Self-Signed Certificate (Development Only)

⚠️ **Warning**: Self-signed certificates will show security warnings in browsers. Use only for development.

1. **Generate self-signed certificate**:
   ```bash
   mkdir -p backend/ssl
   openssl req -x509 -newkey rsa:4096 -nodes -keyout backend/ssl/key.pem -out backend/ssl/cert.pem -days 365
   ```

2. When prompted:
   - Country: Your country code (e.g., US)
   - State: Your state
   - City: Your city
   - Organization: (leave blank or enter name)
   - Common Name: Enter your IP address or hostname (important for Android)

## Option 3: Use Environment Variables

Set certificate paths via environment variables:

```bash
export SSL_CERT_PATH=/path/to/cert.pem
export SSL_KEY_PATH=/path/to/key.pem
export HTTPS_PORT=5443
export REDIRECT_HTTP_TO_HTTPS=true  # Optional: redirect HTTP to HTTPS
```

Or create a `.env` file:
```
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
HTTPS_PORT=5443
REDIRECT_HTTP_TO_HTTPS=true
```

## Option 4: Use Localhost (Easiest for Development)

For local development, you can use `localhost` which works over HTTP:
- Access via: `http://localhost:5001`
- No certificates needed
- Recording will work on localhost

## After Setup

1. Restart your server
2. Access via HTTPS: `https://YOUR_IP:5443` (or your configured HTTPS_PORT)
3. On Android, the browser may show a certificate warning for self-signed certs - click "Advanced" → "Proceed anyway"

## Troubleshooting

- **Certificate errors**: Make sure the Common Name (CN) in self-signed cert matches your IP/domain
- **Port issues**: Ensure HTTPS_PORT is not blocked by firewall
- **Android still won't record**: Check browser console for errors, ensure you're accessing via HTTPS

