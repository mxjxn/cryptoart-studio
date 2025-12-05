#!/bin/bash

# Script to find attacking IPs from nginx logs
# Usage: ./find-attacking-ips.sh [log_file] [threshold]

LOG_FILE=${1:-/var/log/nginx/access.log}
THRESHOLD=${2:-100}  # Requests per minute threshold

echo "Analyzing nginx logs: $LOG_FILE"
echo "Threshold: $THRESHOLD requests per minute"
echo ""

# Get IPs with high request rates in the last 5 minutes
echo "Top attacking IPs (last 5 minutes):"
tail -n 10000 "$LOG_FILE" 2>/dev/null | \
    awk -v threshold="$THRESHOLD" '
    {
        # Extract IP and timestamp
        ip = $1
        time = $4
        gsub(/\[/, "", time)
        
        # Count requests per IP
        count[ip]++
        last_time[ip] = time
    }
    END {
        for (ip in count) {
            if (count[ip] >= threshold) {
                printf "%-15s %6d requests\n", ip, count[ip]
            }
        }
    }
' | sort -k2 -rn | head -20

echo ""
echo "To block an IP, run:"
echo "  sudo ./block-attacker-ip.sh <IP_ADDRESS>"



