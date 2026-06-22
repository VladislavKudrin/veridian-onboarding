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
  },

  schema: {
    // Base URL where THIS server hosts schema OOBIs (GET /oobi/:said). Must be
    // reachable by the KERIA container: `http://server:4000` in full-docker,
    // `http://host.docker.internal:4000` when the server runs on the host.
    host: process.env.SCHEMA_HOST || "http://host.docker.internal:4000",
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
