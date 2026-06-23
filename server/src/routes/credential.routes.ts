import { Response, Router } from "express";
import {
  CredentialRow,
  getLatestConnection,
  getSchemaBySaid,
  insertCredential,
  listCredentials,
} from "../db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { coerceAttributes } from "../schema/attributes";
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

function present(row: CredentialRow) {
  const schema = getSchemaBySaid(row.schema_said);
  return {
    id: row.id,
    credSaid: row.cred_said,
    schemaSaid: row.schema_said,
    schemaTitle: schema?.title ?? row.schema_said,
    attributes: safeParse(row.attributes),
    status: row.status,
    issuedAt: row.issued_at,
  };
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/** Credentials this holder has been issued. */
credentialRouter.get("/", (req: AuthedRequest, res) => {
  res.json({ credentials: listCredentials(req.user!.id).map(present) });
});

/**
 * Issue a credential of the chosen schema (with the supplied attribute values)
 * to the connected wallet, then IPEX-grant it.
 */
credentialRouter.post("/issue", async (req: AuthedRequest, res) => {
  if (!ensureAgent(res)) return;

  const user = req.user!;
  const { said, attributes } = req.body ?? {};

  const connection = getLatestConnection(user.id);
  if (!connection) {
    return res
      .status(400)
      .json({ error: "No connection — connect your wallet first." });
  }

  const schema = said ? getSchemaBySaid(said) : undefined;
  if (!schema) {
    return res.status(400).json({
      error: "Unknown schema — create or import it in the Issuer tab first.",
    });
  }

  let coerced: Record<string, unknown>;
  try {
    coerced = coerceAttributes(schema.definition, attributes ?? {});
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  // Make sure KERIA has this schema loaded (idempotent) — a credential can't be
  // issued against a schema the agent hasn't resolved by OOBI.
  try {
    await signifyService.resolveSchemaSaid(schema.said);
  } catch (e: any) {
    return res.status(400).json({
      error: `Could not load the schema into KERIA (${e.message}). Check that SCHEMA_HOST is reachable from the KERIA container.`,
    });
  }

  try {
    const { said: credSaid } = await signifyService.issueCredentials({
      userAid: connection.user_aid,
      schemaSaid: schema.said,
      attributes: coerced,
    });

    const credential = insertCredential({
      user_id: user.id,
      connection_id: connection.id,
      schema_said: schema.said,
      cred_said: credSaid,
      attributes: JSON.stringify(coerced),
    });

    res.json({ success: true, credential: present(credential) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
