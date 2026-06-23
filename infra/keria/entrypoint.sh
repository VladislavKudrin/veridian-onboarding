#!/bin/sh
# KERIA init: decide which public URL to advertise (curls), write it into the
# config, then start KERIA.
#
#   KERIA_PUBLIC_URL=https://keria.example.org  -> use your own domain
#   KERIA_PUBLIC_URL=ngrok                       -> auto-discover the ngrok tunnel
#   KERIA_PUBLIC_URL=local (or unset)            -> internal only (wallet can't reach)
#
# The OOBI a wallet scans carries this URL, so it must be reachable BY THE WALLET.

TEMPLATE=/config/config.json
DEST=/keria/scripts/keri/cf/backer-oobis.json
mkdir -p /keria/scripts/keri/cf

resolve_url() {
  case "$KERIA_PUBLIC_URL" in
    http://* | https://*)
      printf '%s' "$KERIA_PUBLIC_URL"
      ;;
    ngrok)
      # A reserved (free) ngrok domain is REQUIRED, so the issuer's OOBI host is
      # STABLE. KERIA bakes this host into the agent at first boot, and a stable
      # host is what lets a wallet connection survive restarts. Using it directly
      # is also deterministic — no tunnel-discovery race.
      if [ -z "$NGROK_DOMAIN" ]; then
        echo "[keria-init] ERROR: NGROK_DOMAIN is required for the ngrok path." >&2
        echo "[keria-init]   Reserve a free domain at https://dashboard.ngrok.com/domains" >&2
        echo "[keria-init]   then set NGROK_DOMAIN=your-name.ngrok-free.app in .env." >&2
        return 1
      fi
      printf '%s' "https://$NGROK_DOMAIN"
      ;;
    *)
      echo "[keria-init] KERIA_PUBLIC_URL is local/unset — advertising internal host (a wallet will NOT be able to connect)." >&2
      printf '%s' "http://keria:3902"
      ;;
  esac
}

URL=$(resolve_url) || exit 1
# Normalise to a single trailing slash.
URL=$(printf '%s' "$URL" | sed 's:/*$::')/
echo "[keria-init] advertising KERIA at: $URL"

TEMPLATE="$TEMPLATE" DEST="$DEST" URL="$URL" python3 - <<'PY'
import json, os
cfg = json.load(open(os.environ["TEMPLATE"]))
cfg.setdefault("keria", {})["curls"] = [os.environ["URL"]]
json.dump(cfg, open(os.environ["DEST"], "w"), indent=2)
print("[keria-init] wrote", os.environ["DEST"])
PY

cd /keria
exec keria start --config-file backer-oobis --config-dir ./scripts --loglevel "${KERIA_LOGLEVEL:-INFO}"
