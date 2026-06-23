import fs from "fs";
import { config } from "../config";

function strip(u: string): string {
  return u.replace(/\/+$/, "");
}

/**
 * The public base URL where the schema host is reachable BY A WALLET'S KERIA.
 * This is what goes into the IPEX grant's `oobiUrl`.
 *
 * Resolution order:
 *   1. SCHEMA_PUBLIC_URL — an explicit override (your own domain).
 *   2. the cloudflared quick-tunnel URL, auto-read from its log file.
 *   3. the internal host (only reachable by wallets on OUR KERIA).
 */
export function schemaPublicBase(): string {
  if (config.schema.publicUrlEnv) return strip(config.schema.publicUrlEnv);

  try {
    const log = fs.readFileSync(config.schema.tunnelLogFile, "utf8");
    const matches = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi);
    if (matches?.length) return matches[matches.length - 1]; // latest (survives restarts)
  } catch {
    /* no tunnel log — fall through */
  }

  return strip(config.schema.host);
}
