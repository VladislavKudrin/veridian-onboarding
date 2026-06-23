#!/bin/sh
# Generate an ngrok config exposing the three KERIA ports a wallet needs:
#   3902 protocol/OOBI  (stable reserved domain if NGROK_DOMAIN is set)
#   3901 connect/admin  (random url — wallet boot/connect; ephemeral by design)
#   3903 boot
set -e

CONF=/tmp/ngrok.yml
{
  echo 'version: "2"'
  echo 'web_addr: 0.0.0.0:4040'
  echo 'tunnels:'
  echo '  protocol:'
  echo '    proto: http'
  echo '    addr: keria:3902'
  [ -n "$NGROK_DOMAIN" ] && echo "    domain: $NGROK_DOMAIN"
  echo '  connect:'
  echo '    proto: http'
  echo '    addr: keria:3901'
  echo '  boot:'
  echo '    proto: http'
  echo '    addr: keria:3903'
} > "$CONF"

echo "[ngrok-init] tunnels -> 3902 (protocol${NGROK_DOMAIN:+ @ $NGROK_DOMAIN}), 3901 (connect), 3903 (boot)"
exec ngrok start --all --config "$CONF"
