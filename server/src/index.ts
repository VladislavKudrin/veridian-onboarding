import cors from "cors";
import express from "express";
import { config } from "./config";
import { seedAdmin } from "./db";
import { authRouter } from "./routes/auth.routes";
import { connectionRouter } from "./routes/connection.routes";
import { credentialRouter } from "./routes/credential.routes";
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

  app.use("/auth", authRouter);
  app.use("/connection", connectionRouter);
  app.use("/credentials", credentialRouter);

  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  // Boot the KERIA agent in the background — endpoints that need it return 503
  // until it is ready.
  void signifyService.init();
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
