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
      echo "[keria-init] waiting for ngrok tunnel (http://ngrok:4040)..." >&2
      i=0
      while [ "$i" -lt 60 ]; do
        url=$(curl -s http://ngrok:4040/api/tunnels 2>/dev/null \
          | python3 -c "import sys,json; d=json.load(sys.stdin); t=[x['public_url'] for x in d.get('tunnels',[]) if x.get('public_url','').startswith('https')]; print(t[0] if t else '')" 2>/dev/null)
        if [ -n "$url" ]; then printf '%s' "$url"; return 0; fi
        sleep 2
        i=$((i + 1))
      done
      echo "[keria-init] ERROR: ngrok URL not available (is the tunnel profile up + NGROK_AUTHTOKEN set?)" >&2
      return 1
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
exec keria start --config-file backer-oobis --config-dir ./scripts --loglevel INFO
