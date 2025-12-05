#!/bin/bash

# Script to block an attacking IP address
# Usage: ./block-attacker-ip.sh <IP_ADDRESS>

if [ -z "$1" ]; then
    echo "Usage: $0 <IP_ADDRESS>"
    echo "Example: $0 1.2.3.4"
    exit 1
fi

IP=$1

# Validate IP format
if ! [[ $IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "Error: Invalid IP address format: $IP"
    exit 1
fi

BLOCKED_IPS_FILE="/etc/nginx/blocked_ips.conf"

# Check if IP is already blocked
if grep -q "deny $IP;" "$BLOCKED_IPS_FILE" 2>/dev/null; then
    echo "IP $IP is already blocked"
    exit 0
fi

# Add IP to blocked list
echo "deny $IP;" >> "$BLOCKED_IPS_FILE"
echo "Blocked IP: $IP"

# Test nginx configuration
if nginx -t 2>/dev/null; then
    # Reload nginx
    systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null
    echo "Nginx reloaded successfully"
else
    echo "Warning: Nginx configuration test failed. Reverting change."
    # Remove the last line we added
    sed -i '$ d' "$BLOCKED_IPS_FILE"
    exit 1
fi

echo "IP $IP has been blocked successfully"



