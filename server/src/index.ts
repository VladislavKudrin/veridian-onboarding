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

  // Public sandbox info — what the user needs to point their wallet here.
  // Prefers public ngrok URLs (so a phone can reach KERIA) when available.
  app.get("/info", async (_req, res) => {
    const tunnels = await discoverTunnels();
    const wallet = tunnels ?? {
      bootUrl: config.walletKeria.bootUrl,
      connectUrl: config.walletKeria.connectUrl,
    };
    res.json({ name: "Veridian Sandbox", sandbox: true, public: !!tunnels, wallet });
  });

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
  // NOTE: keripy rejects the response if the content-type carries a charset
  // (e.g. "; charset=utf-8"). express's res.send(string) adds one — so set the
  // header exactly and end with res.end (which does not).
  app.get("/oobi/:said", (req, res) => {
    const row = getSchemaBySaid(req.params.said);
    if (!row) return res.status(404).json({ error: "Unknown schema" });
    res.setHeader("Content-Type", "application/schema+json");
    res.end(row.definition);
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

/** Read the public boot/connect URLs from the ngrok agent API, if running. */
async function discoverTunnels(): Promise<
  { bootUrl: string; connectUrl: string } | null
> {
  try {
    const res = await fetch(`${config.ngrokApiUrl}/api/tunnels`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const urlFor = (port: string): string | undefined =>
      data.tunnels?.find(
        (t: any) =>
          String(t.config?.addr ?? "").endsWith(`:${port}`) &&
          String(t.public_url ?? "").startsWith("https")
      )?.public_url;

    const bootUrl = urlFor("3903");
    const connectUrl = urlFor("3901");
    return bootUrl && connectUrl ? { bootUrl, connectUrl } : null;
  } catch {
    return null; // ngrok not running / unreachable
  }
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
