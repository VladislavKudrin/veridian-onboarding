export type AttrType = "string" | "number" | "integer" | "boolean" | "date-time";

export interface Attribute {
  name: string;
  type: AttrType;
}

/** The custom attribute fields (name + type) declared by an ACDC schema. */
export function attributesOf(definition: string): Attribute[] {
  try {
    const def = JSON.parse(definition);
    const props = def?.properties?.a?.oneOf?.[1]?.properties ?? {};
    return Object.keys(props)
      .filter((k) => k !== "d" && k !== "i" && k !== "dt")
      .map((name) => {
        const p = props[name] || {};
        let type: AttrType = "string";
        if (p.type === "number") type = "number";
        else if (p.type === "integer") type = "integer";
        else if (p.type === "boolean") type = "boolean";
        else if (p.type === "string" && p.format === "date-time") type = "date-time";
        return { name, type };
      });
  } catch {
    return [];
  }
}

/** Coerce + validate raw form values against the schema's attribute types. */
export function coerceAttributes(
  definition: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const a of attributesOf(definition)) {
    const v = raw?.[a.name];
    if (v === undefined || v === null || v === "") {
      throw new Error(`Missing value for "${a.name}".`);
    }
    switch (a.type) {
      case "number": {
        const n = Number(v);
        if (Number.isNaN(n)) throw new Error(`"${a.name}" must be a number.`);
        out[a.name] = n;
        break;
      }
      case "integer": {
        const n = Number(v);
        if (!Number.isInteger(n)) throw new Error(`"${a.name}" must be a whole number.`);
        out[a.name] = n;
        break;
      }
      case "boolean":
        out[a.name] = v === true || v === "true";
        break;
      default:
        out[a.name] = String(v);
    }
  }
  return out;
}
