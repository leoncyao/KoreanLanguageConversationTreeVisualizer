# Nginx Setup Guide for neonleon.ca

## Step 1: Install Nginx (if not already installed)

```bash
sudo apt update
sudo apt install nginx
```

## Step 2: Copy the nginx configuration

```bash
# Copy the config file to nginx sites-available
sudo cp nginx.conf /etc/nginx/sites-available/neonleon.ca

# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/neonleon.ca /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default
```

## Step 3: Test nginx configuration

```bash
sudo nginx -t
```

If the test passes, you should see:
```
nginx: the configuration file /etc/nginx/nginx.conf test is successful
```

## Step 4: Set up Let's Encrypt SSL Certificate

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Get SSL certificate (this will automatically configure nginx)

```bash
sudo certbot --nginx -d neonleon.ca -d www.neonleon.ca
```

Certbot will:
1. Request certificates from Let's Encrypt
2. Automatically update your nginx config with SSL settings
3. Set up auto-renewal

### Auto-renewal (should be automatic, but verify)

```bash
# Test renewal
sudo certbot renew --dry-run

# Check if renewal timer is active
sudo systemctl status certbot.timer
```

## Step 5: Configure your backend to run on port 5000

Make sure your backend is configured to run on `127.0.0.1:5000` in production mode.

Update your `.env` file or environment:
```bash
export NODE_ENV=production
```

Or create a `.env` file:
```
NODE_ENV=production
```

## Step 6: Start/restart services

```bash
# Reload nginx
sudo systemctl reload nginx

# Or restart nginx
sudo systemctl restart nginx

# Make sure your backend is running
# (Start your Node.js backend server)
```

## Step 7: Update DNS records

Make sure your DNS is pointing to your server:
- `A` record: `neonleon.ca` → Your server IP
- `A` record: `www.neonleon.ca` → Your server IP (optional, but recommended)

## Step 8: Verify it's working

1. Visit `https://neonleon.ca` - should load your app
2. Check that API calls work: `https://neonleon.ca/api/phrases`
3. Verify SSL: Check that the lock icon appears in browser

## Step 9: Update manifest.json for production domain

The manifest.json should already work, but verify the paths are correct:
- `start_url` should be `/`
- `scope` should be `/`

## Troubleshooting

### Nginx won't start
```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check if port 80/443 is already in use
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

### Backend not accessible
- Verify backend is running: `curl http://127.0.0.1:5000/api/phrases`
- Check nginx proxy_pass is correct in config
- Check firewall allows port 80 and 443: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`

### SSL certificate issues
- Make sure DNS is pointing to your server before running certbot
- Ensure port 80 is open (certbot needs it for verification)
- Check certificate: `sudo certbot certificates`

### SSL "bad key share" errors (TLS 1.3)
If you see errors like `SSL_do_handshake() failed (SSL: error:0A00006C:SSL routines::bad key share)`:
- This is a TLS 1.3 key exchange compatibility issue
- The nginx.conf file has been updated with proper ECDH curve configuration
- After updating nginx.conf, copy it to the server and reload:
  ```bash
  sudo cp nginx.conf /etc/nginx/sites-available/neonleon.ca
  sudo nginx -t  # Test configuration
  sudo systemctl reload nginx
  ```
- If you get errors about `ssl_conf_command` not being supported, your nginx version may be too old (requires nginx >= 1.19.4 with OpenSSL 1.1.1+)
- You can check your nginx version: `nginx -v`
- If needed, remove the `ssl_conf_command` lines from nginx.conf (the `ssl_ecdh_curve` directive should still help)

### Can't access from domain
- Verify DNS propagation: `dig neonleon.ca`
- Check firewall: `sudo ufw status`
- Test locally first: `curl http://127.0.0.1:5000`

## Firewall Configuration

If you have a firewall, make sure these ports are open:

```bash
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 22/tcp   # SSH (if needed)
sudo ufw enable
sudo ufw status
```

## Monitoring

Check nginx status:
```bash
sudo systemctl status nginx
```

View access logs:
```bash
sudo tail -f /var/log/nginx/access.log
```

View error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

