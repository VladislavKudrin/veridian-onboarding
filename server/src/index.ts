import cors from "cors";
import express from "express";
import { config } from "./config";
import { getSchemaBySaid, listSchemas, seedAdmin } from "./db";
import { authRouter } from "./routes/auth.routes";
import { connectionRouter } from "./routes/connection.routes";
import { credentialRouter } from "./routes/credential.routes";
import { schemaRouter } from "./routes/schema.routes";
import { signifyService } from "./signify/signify.service";

async function main() {
  seedAdmin();

  const app = express();
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      keria: {
        enabled: config.keria.enabled,
        available: signifyService.isAvailable(),
      },
    });
  });

  // Public, UNauthenticated: KERIA fetches schema OOBIs from here by SAID.
  app.get("/oobi/:said", (req, res) => {
    const row = getSchemaBySaid(req.params.said);
    if (!row) return res.status(404).json({ error: "Unknown schema" });
    res.setHeader("Content-Type", "application/schema+json");
    res.send(row.definition);
  });

  app.use("/auth", authRouter);
  app.use("/connection", connectionRouter);
  app.use("/credentials", credentialRouter);
  app.use("/schemas", schemaRouter);

  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  // Boot the KERIA agent in the background — endpoints that need it return 503
  // until it is ready. Once up, re-resolve stored schemas so a fresh agent
  // (e.g. after `down -v`) knows them again.
  void signifyService.init().then(async () => {
    if (!signifyService.isAvailable()) return;
    for (const s of listSchemas()) {
      await signifyService.resolveSchemaSaid(s.said).catch((e) =>
        console.warn(`[schema] re-resolve ${s.said} failed: ${e?.message || e}`)
      );
    }
  });
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
