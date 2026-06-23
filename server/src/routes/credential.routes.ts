import { Router } from "express";
import { CredentialRow, getSchemaBySaid, listCredentials } from "../db";
import { AuthedRequest, requireAuth } from "../middleware/auth";

export const credentialRouter = Router();
credentialRouter.use(requireAuth);

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
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

/**
 * Credentials this holder has been issued. Issuance now happens via the
 * request → accept flow (see request.routes.ts), so there is no self-issue
 * endpoint here.
 */
credentialRouter.get("/", (req: AuthedRequest, res) => {
  res.json({ credentials: listCredentials(req.user!.id).map(present) });
});
