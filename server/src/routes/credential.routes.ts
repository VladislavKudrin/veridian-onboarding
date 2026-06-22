import { Response, Router } from "express";
import { config } from "../config";
import {
  getLatestConnection,
  getLatestCredential,
  insertCredential,
} from "../db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { signifyService } from "../signify/signify.service";

export const credentialRouter = Router();
credentialRouter.use(requireAuth);

function ensureAgent(res: Response): boolean {
  if (!signifyService.isAvailable()) {
    res.status(503).json({ error: "KERIA agent is not available" });
    return false;
  }
  return true;
}

function splitName(displayName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = displayName.trim().split(/\s+/);
  return { firstName: firstName || "", lastName: rest.join(" ") };
}

/** Credential status for the logged-in user (DB record + live KERIA check). */
credentialRouter.get("/status", async (req: AuthedRequest, res) => {
  const record = getLatestCredential(req.user!.id) ?? null;
  let active = !!record;

  if (signifyService.isAvailable()) {
    try {
      active = await signifyService.hasActiveCredentials(req.user!.email);
    } catch {
      /* fall back to DB record */
    }
  }

  res.json({ active, credential: record });
});

/** Issue the certification credential to the connected wallet. */
credentialRouter.post("/issue", async (req: AuthedRequest, res) => {
  if (!ensureAgent(res)) return;

  const user = req.user!;
  const connection = getLatestConnection(user.id);
  if (!connection) {
    return res
      .status(400)
      .json({ error: "No connection — create a connection first" });
  }

  try {
    const { firstName, lastName } = splitName(user.display_name);
    const { said } = await signifyService.issueCredentials({
      userAid: connection.user_aid,
      email: user.email,
      firstName,
      lastName,
    });

    const credential = insertCredential({
      user_id: user.id,
      connection_id: connection.id,
      schema_said: config.schema.said,
      cred_said: said,
      attributes: JSON.stringify({
        email: user.email,
        firstName,
        lastName,
      }),
    });

    res.json({ success: true, credential });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
