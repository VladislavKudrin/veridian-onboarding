import { Response, Router } from "express";
import {
  getLatestConnection,
  insertConnection,
} from "../db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { signifyService } from "../signify/signify.service";
import { getAidFromOobi } from "../signify/signify.utils";

export const connectionRouter = Router();
connectionRouter.use(requireAuth);

function ensureAgent(res: Response): boolean {
  if (!signifyService.isAvailable()) {
    res.status(503).json({ error: "KERIA agent is not available" });
    return false;
  }
  return true;
}

/** The platform agent's OOBI — rendered as a QR for the user's wallet to scan. */
connectionRouter.get("/oobi", async (_req: AuthedRequest, res) => {
  if (!ensureAgent(res)) return;
  try {
    const [oobi, aid] = await Promise.all([
      signifyService.getClientOobi(),
      signifyService.getClientAid(),
    ]);
    res.json({ oobi, aid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Current connection state for the logged-in user.
 *
 * The DB row alone is not proof of a live link: if the agent was re-created
 * (new bran, or `down -v`), the stored connection belongs to a dead issuer AID
 * and the agent no longer knows the wallet. So we validate against the live
 * agent and report `stale` (with a reason) instead of lying with "connected".
 */
connectionRouter.get("/", async (req: AuthedRequest, res) => {
  const connection = getLatestConnection(req.user!.id);
  if (!connection) {
    return res.json({ connected: false, connection: null });
  }

  // Can't confirm anything if the agent isn't up.
  if (!signifyService.isAvailable()) {
    return res.json({
      connected: false,
      stale: true,
      reason: "agent-unavailable",
      connection,
    });
  }

  try {
    const liveIssuerAid = await signifyService.getClientAid();
    const storedIssuerAid = getAidFromOobi(connection.platform_oobi).userAid;

    // The issuer identity changed since this connection was made.
    if (storedIssuerAid !== liveIssuerAid) {
      return res.json({
        connected: false,
        stale: true,
        reason: "issuer-changed",
        connection,
      });
    }

    // The agent no longer has the wallet as a resolved contact.
    if (!(await signifyService.hasContact(connection.user_aid))) {
      return res.json({
        connected: false,
        stale: true,
        reason: "contact-missing",
        connection,
      });
    }

    return res.json({ connected: true, connection });
  } catch (err: any) {
    return res.json({
      connected: false,
      stale: true,
      reason: "verify-failed",
      connection,
    });
  }
});

/** Resolve the user's wallet OOBI -> establishes & persists the connection. */
connectionRouter.post("/resolve", async (req: AuthedRequest, res) => {
  if (!ensureAgent(res)) return;

  const { oobi } = req.body ?? {};
  if (!oobi || typeof oobi !== "string") {
    return res.status(400).json({ error: "Missing oobi" });
  }

  try {
    const { userAid } = await signifyService.resolveUserOobi(oobi);
    const platformOobi = await signifyService.getClientOobi();

    const connection = insertConnection({
      user_id: req.user!.id,
      user_oobi: oobi,
      user_aid: userAid,
      platform_oobi: platformOobi,
    });

    res.json({ success: true, connection });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
