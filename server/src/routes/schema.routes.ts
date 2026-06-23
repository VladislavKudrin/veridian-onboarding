import { Router } from "express";
import {
  deleteSchema,
  getSchemaBySaid,
  listSchemas,
  SchemaRow,
  upsertSchema,
} from "../db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { attributesOf } from "../schema/attributes";
import { CATALOG_SCHEMAS } from "../schema/catalog.data";
import { schemaPublicBase } from "../schema/publicUrl";
import { buildSchema, deriveCredentialType, SchemaField } from "../schema/saidify";
import { signifyService } from "../signify/signify.service";

export const schemaRouter = Router();
schemaRouter.use(requireAuth);

const RESERVED = new Set(["d", "i", "dt", "v", "u", "ri", "s", "a"]);
const FIELD_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function present(row: SchemaRow) {
  const attributes = attributesOf(row.definition);
  return {
    said: row.said,
    title: row.title,
    credentialType: row.credential_type,
    source: row.source,
    fields: attributes.map((a) => a.name),
    attributes,
    oobi: `${schemaPublicBase()}/oobi/${row.said}`,
    createdAt: row.created_at,
  };
}

/** Try to resolve the schema into KERIA; non-fatal so the row still saves. */
async function resolve(said: string): Promise<{ resolved: boolean; error?: string }> {
  if (!signifyService.isAvailable()) {
    return { resolved: false, error: "KERIA agent is not available" };
  }
  try {
    await signifyService.resolveSchemaSaid(said);
    return { resolved: true };
  } catch (e: any) {
    return { resolved: false, error: e?.message || "resolve failed" };
  }
}

/** Schemas this issuer has created/imported. */
schemaRouter.get("/", (_req: AuthedRequest, res) => {
  res.json({ schemas: listSchemas().map(present) });
});

/** Bundled, pre-saidified schemas available to import (with `imported` flag). */
schemaRouter.get("/catalog", (_req: AuthedRequest, res) => {
  const have = new Set(listSchemas().map((s) => s.said));
  res.json({
    catalog: CATALOG_SCHEMAS.map((c) => ({
      said: c.said,
      title: c.title,
      credentialType: c.credentialType,
      fields: c.fields,
      imported: have.has(c.said),
    })),
  });
});

/** Build a brand-new schema from a few fields, SAIDify it, host + resolve it. */
schemaRouter.post("/", async (req: AuthedRequest, res) => {
  const { title, description, fields } = req.body ?? {};
  const credentialType =
    (req.body?.credentialType as string) || deriveCredentialType(title || "");

  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "A title is required." });
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: "Add at least one attribute field." });
  }
  const names = new Set<string>();
  for (const f of fields as SchemaField[]) {
    if (!f?.name || !FIELD_RE.test(f.name)) {
      return res.status(400).json({
        error: `Invalid field name "${f?.name}" — use letters/digits/underscore, starting with a letter.`,
      });
    }
    if (RESERVED.has(f.name)) {
      return res.status(400).json({ error: `"${f.name}" is reserved.` });
    }
    if (names.has(f.name)) {
      return res.status(400).json({ error: `Duplicate field "${f.name}".` });
    }
    names.add(f.name);
  }

  try {
    const { said, schema } = await buildSchema({
      title,
      description,
      credentialType,
      fields,
    });
    const row = upsertSchema({
      said,
      title,
      credential_type: credentialType,
      definition: JSON.stringify(schema),
      source: "builder",
    });
    const r = await resolve(said);
    res.json({ schema: present(row), ...r });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Could not build schema." });
  }
});

/** Import a bundled catalog schema verbatim (preserves its SAID), host + resolve. */
schemaRouter.post("/import", async (req: AuthedRequest, res) => {
  const { said } = req.body ?? {};
  const item = CATALOG_SCHEMAS.find((c) => c.said === said);
  if (!item) return res.status(404).json({ error: "Unknown catalog schema." });

  const row = upsertSchema({
    said: item.said,
    title: item.title,
    credential_type: item.credentialType,
    definition: JSON.stringify(item.schema),
    source: "catalog",
  });
  const r = await resolve(item.said);
  res.json({ schema: present(row), ...r });
});

/** Re-resolve an already-stored schema into KERIA (e.g. after a fresh agent). */
schemaRouter.post("/:said/resolve", async (req: AuthedRequest, res) => {
  const row = getSchemaBySaid(req.params.said);
  if (!row) return res.status(404).json({ error: "Unknown schema." });
  const r = await resolve(row.said);
  res.json({ schema: present(row), ...r });
});

schemaRouter.delete("/:said", (req: AuthedRequest, res) => {
  deleteSchema(req.params.said);
  res.json({ success: true });
});
