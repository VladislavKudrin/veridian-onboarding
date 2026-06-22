import { ready, Saider } from "signify-ts";

export type FieldType = "string" | "number" | "integer" | "boolean" | "date-time";

export interface SchemaField {
  name: string;
  type: FieldType;
  description?: string;
}

export interface BuildSchemaInput {
  title: string;
  description?: string;
  credentialType: string;
  fields: SchemaField[];
}

function jsonType(t: FieldType): Record<string, unknown> {
  switch (t) {
    case "date-time":
      return { type: "string", format: "date-time" };
    case "number":
      return { type: "number" };
    case "integer":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    default:
      return { type: "string" };
  }
}

/**
 * Build a flat ACDC credential schema from a few fields and SAIDify it.
 *
 * The structure and key order match the reference schemas exactly, so the SAIDs
 * we compute here are identical to keripy's (verified against the Foundation
 * Employee schema -> EL9oOWU…). A schema's `$id` IS its SAID — a self-addressing
 * digest of the content, not a key signature. SAIDify the attribute block
 * first, embed it, then SAIDify the whole document.
 */
export async function buildSchema(input: BuildSchemaInput): Promise<{
  said: string;
  attrSaid: string;
  schema: Record<string, unknown>;
}> {
  await ready();
  const { title, credentialType, fields } = input;
  const description = input.description || `${title} credential`;

  const attrProps: Record<string, unknown> = {
    d: { description: "Attributes block SAID", type: "string" },
    i: { description: "Issuee AID", type: "string" },
    dt: { description: "Issuance date time", type: "string", format: "date-time" },
  };
  for (const f of fields) {
    attrProps[f.name] = { description: f.description || f.name, ...jsonType(f.type) };
  }

  const attrBlock = {
    $id: "",
    description: "Attributes block",
    type: "object",
    properties: attrProps,
    additionalProperties: false,
    required: ["i", "dt", ...fields.map((f) => f.name)],
  };
  const [, attrSad] = Saider.saidify(attrBlock as any, undefined, undefined, "$id");

  const schema = {
    $id: "",
    $schema: "http://json-schema.org/draft-07/schema#",
    title,
    description,
    type: "object",
    credentialType,
    version: "1.0.0",
    properties: {
      v: { description: "Version", type: "string" },
      d: { description: "Credential SAID", type: "string" },
      u: { description: "One time use nonce", type: "string" },
      i: { description: "Issuee AID", type: "string" },
      ri: { description: "Credential status registry", type: "string" },
      s: { description: "Schema SAID", type: "string" },
      a: {
        oneOf: [
          { description: "Attributes block SAID", type: "string" },
          attrSad,
        ],
      },
    },
    additionalProperties: false,
    required: ["i", "ri", "s", "d", "a"],
  };
  const [, schemaSad] = Saider.saidify(schema as any, undefined, undefined, "$id");

  return {
    said: schemaSad.$id as string,
    attrSaid: attrSad.$id as string,
    schema: schemaSad,
  };
}

/** Turn a human title into a CamelCase credential type, e.g. "Course Cert" -> "CourseCertCredential". */
export function deriveCredentialType(title: string): string {
  const camel = title
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
  return camel ? `${camel}Credential` : "Credential";
}
