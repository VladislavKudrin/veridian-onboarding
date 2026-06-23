#!/bin/sh
# Generate an ngrok config exposing the three KERIA ports a wallet needs:
#   3902 protocol/OOBI  (STABLE reserved domain — the one the issuer advertises)
#   3901 connect/admin  (random url — wallet boot/connect; ephemeral by design)
#   3903 boot
set -e

# A reserved (free) domain is required so the OOBI host is stable across
# restarts. Reserve one at https://dashboard.ngrok.com/domains.
if [ -z "$NGROK_DOMAIN" ]; then
  echo "[ngrok-init] ERROR: NGROK_DOMAIN is required." >&2
  echo "[ngrok-init]   Reserve a free domain at https://dashboard.ngrok.com/domains" >&2
  echo "[ngrok-init]   then set NGROK_DOMAIN=your-name.ngrok-free.app in .env." >&2
  exit 1
fi

CONF=/tmp/ngrok.yml
{
  echo 'version: "2"'
  echo 'web_addr: 0.0.0.0:4040'
  echo 'tunnels:'
  echo '  protocol:'
  echo '    proto: http'
  echo '    addr: keria:3902'
  echo "    domain: $NGROK_DOMAIN"
  echo '  connect:'
  echo '    proto: http'
  echo '    addr: keria:3901'
  echo '  boot:'
  echo '    proto: http'
  echo '    addr: keria:3903'
} > "$CONF"

echo "[ngrok-init] tunnels -> 3902 (protocol${NGROK_DOMAIN:+ @ $NGROK_DOMAIN}), 3901 (connect), 3903 (boot)"
exec ngrok start --all --config "$CONF"
