import { Router } from "express";
import {
  createRequest,
  getLatestConnection,
  getRequest,
  getSchemaBySaid,
  getUserById,
  insertCredential,
  listAllRequests,
  listRequestsForUser,
  RequestRow,
  setRequestAccepted,
  setRequestDeclined,
  setRequestRevoked,
} from "../db";
import { AuthedRequest, requireAuth, requireIssuer } from "../middleware/auth";
import { coerceAttributes } from "../schema/attributes";
import { signifyService } from "../signify/signify.service";

export const requestRouter = Router();
requestRouter.use(requireAuth);

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/** What the holder sees about their own request. */
function presentForHolder(r: RequestRow) {
  const schema = getSchemaBySaid(r.schema_said);
  return {
    id: r.id,
    status: r.status,
    schemaSaid: r.schema_said,
    schemaTitle: schema?.title ?? r.schema_said,
    attributes: safeParse(r.attributes),
    credSaid: r.cred_said,
    reason: r.reason,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  };
}

/** What the issuer sees — enriched with the holder + their connection. */
function presentForIssuer(r: RequestRow) {
  const holder = getUserById(r.user_id);
  const connection = getLatestConnection(r.user_id);
  return {
    ...presentForHolder(r),
    holder: holder
      ? {
          username: holder.username,
          displayName: holder.display_name,
          email: holder.email,
        }
      : null,
    connected: !!connection,
    userAid: connection?.user_aid ?? null,
  };
}

/** A holder applies for a credential (picks a type + fills attributes). */
requestRouter.post("/", (req: AuthedRequest, res) => {
  const user = req.user!;
  const { said, attributes } = req.body ?? {};

  const schema = said ? getSchemaBySaid(said) : undefined;
  if (!schema) return res.status(400).json({ error: "Unknown credential type." });

  if (!getLatestConnection(user.id)) {
    return res.status(400).json({ error: "Connect your wallet before requesting." });
  }

  let coerced: Record<string, unknown>;
  try {
    coerced = coerceAttributes(schema.definition, attributes ?? {});
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const request = createRequest({
    user_id: user.id,
    schema_said: schema.said,
    attributes: JSON.stringify(coerced),
  });
  res.json({ request: presentForHolder(request) });
});

/** List — holders see their own; the issuer sees everyone's. */
requestRouter.get("/", (req: AuthedRequest, res) => {
  const user = req.user!;
  if (user.role === "issuer") {
    return res.json({ requests: listAllRequests().map(presentForIssuer) });
  }
  res.json({ requests: listRequestsForUser(user.id).map(presentForHolder) });
});

/** Issuer accepts -> issue the ACDC + IPEX-grant it to the holder's wallet. */
requestRouter.post("/:id/accept", requireIssuer, async (req: AuthedRequest, res) => {
  if (!signifyService.isAvailable()) {
    return res.status(503).json({ error: "KERIA agent is not available" });
  }
  const request = getRequest(Number(req.params.id));
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "pending") {
    return res.status(400).json({ error: "This request was already decided." });
  }

  const schema = getSchemaBySaid(request.schema_said);
  if (!schema) return res.status(400).json({ error: "That schema no longer exists." });

  const connection = getLatestConnection(request.user_id);
  if (!connection) {
    return res.status(400).json({ error: "The holder is not connected." });
  }

  // Make sure KERIA has the schema loaded before issuing.
  try {
    await signifyService.resolveSchemaSaid(schema.said);
  } catch (e: any) {
    return res.status(400).json({
      error: `Could not load the schema into KERIA (${e.message}).`,
    });
  }

  try {
    const { said: credSaid } = await signifyService.issueCredentials({
      userAid: connection.user_aid,
      schemaSaid: schema.said,
      attributes: safeParse(request.attributes),
    });
    insertCredential({
      user_id: request.user_id,
      connection_id: connection.id,
      schema_said: schema.said,
      cred_said: credSaid,
      attributes: request.attributes,
    });
    setRequestAccepted(request.id, credSaid);
    res.json({ request: presentForIssuer(getRequest(request.id)!) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/** Issuer declines the request. */
requestRouter.post("/:id/decline", requireIssuer, (req: AuthedRequest, res) => {
  const request = getRequest(Number(req.params.id));
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "pending") {
    return res.status(400).json({ error: "This request was already decided." });
  }
  setRequestDeclined(request.id, String(req.body?.reason ?? "").slice(0, 300));
  res.json({ request: presentForIssuer(getRequest(request.id)!) });
});

/** Issuer revokes an issued credential (writes a rev event to the registry). */
requestRouter.post("/:id/revoke", requireIssuer, async (req: AuthedRequest, res) => {
  if (!signifyService.isAvailable()) {
    return res.status(503).json({ error: "KERIA agent is not available" });
  }
  const request = getRequest(Number(req.params.id));
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "accepted" || !request.cred_said) {
    return res.status(400).json({ error: "Only an issued credential can be revoked." });
  }
  try {
    await signifyService.revokeCredential(request.cred_said);
    setRequestRevoked(request.id);
    res.json({ request: presentForIssuer(getRequest(request.id)!) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
