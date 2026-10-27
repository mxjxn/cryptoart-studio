#!/bin/sh
# Call an mvp cron route. Requires MVP_INTERNAL_URL and CRON_SECRET.
set -eu

path="${1:-}"
if [ -z "$path" ]; then
  echo "usage: run-cron.sh /api/cron/..." >&2
  exit 1
fi

base="${MVP_INTERNAL_URL:-http://mvp:3000}"
url="${base}${path}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[cron] CRON_SECRET is not set; refusing to call $url" >&2
  exit 1
fi

echo "[cron] $(date -u +%Y-%m-%dT%H:%M:%SZ) GET $path"
code=$(curl -sS -o /tmp/cron-body -w "%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "User-Agent: cryptoart-vps-cron/1.0" \
  "$url" || echo "000")

echo "[cron] $path -> HTTP $code"
if [ "$code" != "200" ] && [ "$code" != "204" ]; then
  head -c 500 /tmp/cron-body 2>/dev/null || true
  echo
  exit 1
fi
