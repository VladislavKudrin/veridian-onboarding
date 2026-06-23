import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-prod",

  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin",
  },

  dbPath: process.env.DB_PATH || path.join(__dirname, "..", "veridian-poc.sqlite"),

  keria: {
    enabled: process.env.KERIA_ENABLED === "true",
    bootUrl: process.env.KERIA_BOOT_URL || "http://localhost:3903",
    connectUrl: process.env.KERIA_CONNECT_URL || "http://localhost:3901",
    bran: process.env.SIGNIFY_BRAN || undefined,
    agentName: process.env.AGENT_NAME || "VeridianPoc",
    // Fixed seed for the ISSUER IDENTIFIER (not the client). Passing this to
    // identifiers().create makes the issuer AID DETERMINISTIC, so it survives a
    // `down -v` / agent recreation instead of rotating (which silently breaks
    // every wallet connection). Without it signify uses a random salt each time.
    identifierBran:
      process.env.SIGNIFY_IDENTIFIER_BRAN || "veridianPocIssuerSeed",
  },

  // KERIA boot/connect URLs to show the user for THEIR wallet. Must be reachable
  // by the wallet device (localhost for a wallet on this machine; a LAN IP or
  // public URL otherwise).
  walletKeria: {
    bootUrl: process.env.WALLET_KERIA_BOOT_URL || "http://localhost:3903",
    connectUrl: process.env.WALLET_KERIA_CONNECT_URL || "http://localhost:3901",
  },

  // ngrok agent API — used to discover the public boot/connect tunnel URLs to
  // show the user (so a phone can reach them). http://ngrok:4040 in full-docker.
  ngrokApiUrl: process.env.NGROK_API_URL || "http://localhost:4040",

  schema: {
    // Base URL where THIS server hosts schema OOBIs (GET /oobi/:said). Must be
    // reachable by the KERIA container: `http://server:4000` in full-docker,
    // `http://host.docker.internal:4000` when the server runs on the host.
    host: process.env.SCHEMA_HOST || "http://host.docker.internal:4000",
    // Public base URL a WALLET uses to fetch schemas (goes into the grant's
    // oobiUrl). Leave SCHEMA_PUBLIC_URL empty to auto-discover the cloudflared
    // quick-tunnel URL from its log; set it to pin your own domain.
    publicUrlEnv: process.env.SCHEMA_PUBLIC_URL || "",
    tunnelLogFile: process.env.CLOUDFLARED_LOG || "/cf/cf.log",
    said:
      process.env.EXPECTED_SCHEMA_SAID ||
      "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
    // Empty string = skip schema resolution (the connection chunk doesn't need
    // it). Set it once the credential schema server is running (issuance chunk).
    oobiUrl:
      process.env.SCHEMA_OOBI_URL ??
      "http://cred-issuance:3001/oobi/EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
  },
};
