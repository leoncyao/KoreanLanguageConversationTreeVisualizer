#!/bin/bash

# Generate self-signed SSL certificate for development
# Usage: ./generate-ssl.sh [IP_ADDRESS_OR_DOMAIN]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$SCRIPT_DIR/ssl"

mkdir -p "$SSL_DIR"

# Get IP address or use provided argument
if [ -z "$1" ]; then
  # Try to get local IP
  IP=$(hostname -I | awk '{print $1}')
  if [ -z "$IP" ]; then
    IP="localhost"
  fi
  echo "No IP/domain provided. Using: $IP"
else
  IP="$1"
fi

echo "Generating self-signed certificate for: $IP"
echo "⚠️  Self-signed certificates show security warnings. Use only for development."

# Create a config file with Subject Alternative Names (SAN) for localhost and IP
CONFIG_FILE=$(mktemp)
cat > "$CONFIG_FILE" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Development
CN = localhost

[v3_req]
keyUsage = digitalSignature, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = $IP
EOF

openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -days 365 \
  -config "$CONFIG_FILE" \
  -extensions v3_req

rm "$CONFIG_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Certificates generated successfully!"
  echo "   Certificate: $SSL_DIR/cert.pem"
  echo "   Private Key: $SSL_DIR/key.pem"
  echo ""
  echo "Next steps:"
  echo "  1. Restart your server"
  echo "  2. Access via: https://$IP:5443"
  echo "  3. Accept the security warning in your browser"
else
  echo "❌ Failed to generate certificates"
  exit 1
fi

