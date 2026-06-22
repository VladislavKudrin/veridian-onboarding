import { useEffect, useState } from "react";
import {
  api,
  CatalogItem,
  SchemaField,
  SchemaSummary,
} from "../api";
import { CodePeek } from "../components/CodePeek";
import { Explain } from "../components/Explain";

const FIELD_TYPES: SchemaField["type"][] = [
  "string",
  "number",
  "integer",
  "boolean",
  "date-time",
];

const SAIDIFY_CODE = `// server/src/schema/saidify.ts — a schema's $id IS its SAID:
// a Blake3 digest of the content (self-addressing), NOT a key signature.

const [, attr] = Saider.saidify(attrBlock, undefined, undefined, "$id");
// ...embed attr into the schema document, then hash the whole thing:
const [, schema] = Saider.saidify(doc, undefined, undefined, "$id");

return schema.$id; // identical to keripy's output (verified vs Foundation Employee)`;

export function Issuer({ keriaReady }: { keriaReady: boolean | null }) {
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  async function refresh() {
    const [s, c] = await Promise.allSettled([
      api.listSchemas(),
      api.schemaCatalog(),
    ]);
    if (s.status === "fulfilled") setSchemas(s.value.schemas);
    if (c.status === "fulfilled") setCatalog(c.value.catalog);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <>
      <div className="dash-head">
        <h1>Define what you issue</h1>
        <p className="muted">
          A credential is issued against a <strong>schema</strong>. Build your
          own or import a ready-made one — either way it's saidified and made
          resolvable so the wallet and KERIA can verify credentials against it.
        </p>
      </div>

      <Explain title="What is a credential schema?" defaultOpen={false}>
        <p>
          An ACDC schema is a JSON Schema whose <code>$id</code> is its{" "}
          <strong>SAID</strong> — a digest of the content itself
          (self-addressing). "Creating" one means <em>saidifying</em> it; it's
          immutable (any change = a new SAID). To issue against it, KERIA must
          resolve it by SAID, so the issuer <strong>hosts</strong> it at{" "}
          <code>/oobi/&lt;said&gt;</code>.
        </p>
      </Explain>

      {keriaReady === false && (
        <div className="alert error">
          KERIA is offline — schemas will save and host, but won't resolve into
          the agent until it's up.
        </div>
      )}

      <SchemaBuilder onCreated={refresh} />

      <section className="card">
        <h3 className="section-title">Your schemas</h3>
        {schemas.length === 0 ? (
          <p className="muted">None yet — build one above or import below.</p>
        ) : (
          <div className="schema-list">
            {schemas.map((s) => (
              <SchemaCard key={s.said} schema={s} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="section-title">Catalog</h3>
        <p className="muted">
          Pre-saidified schemas bundled with the POC (incl. vLEI). Import to
          host + resolve them as-is.
        </p>
        <div className="schema-list">
          {catalog.map((c) => (
            <CatalogCard key={c.said} item={c} onImported={refresh} />
          ))}
        </div>
      </section>
    </>
  );
}

function SchemaBuilder({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<SchemaField[]>([
    { name: "", type: "string" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    schema: SchemaSummary;
    resolved: boolean;
    error?: string;
  } | null>(null);

  function setField(i: number, patch: Partial<SchemaField>) {
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  async function create() {
    setError("");
    setResult(null);
    const clean = fields.filter((f) => f.name.trim());
    if (!title.trim()) return setError("Give the credential a title.");
    if (clean.length === 0) return setError("Add at least one attribute.");
    setBusy(true);
    try {
      const res = await api.buildSchema({
        title: title.trim(),
        description: description.trim() || undefined,
        fields: clean,
      });
      setResult(res);
      setTitle("");
      setDescription("");
      setFields([{ name: "", type: "string" }]);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3 className="section-title">Build a schema</h3>

      <div className="form">
        <label>
          Credential title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Course Certificate"
          />
        </label>
        <label>
          Description <span className="muted">(optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this credential attests"
          />
        </label>

        <div className="fields">
          <span className="fields-label muted">Attributes</span>
          {fields.map((f, i) => (
            <div className="field-row" key={i}>
              <input
                value={f.name}
                onChange={(e) => setField(i, { name: e.target.value })}
                placeholder="fieldName"
              />
              <select
                value={f.type}
                onChange={(e) =>
                  setField(i, { type: e.target.value as SchemaField["type"] })
                }
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                onClick={() =>
                  setFields((fs) =>
                    fs.length > 1 ? fs.filter((_, j) => j !== i) : fs
                  )
                }
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn ghost small"
            onClick={() =>
              setFields((fs) => [...fs, { name: "", type: "string" }])
            }
          >
            + Add attribute
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}

        {result && (
          <div className={`alert ${result.resolved ? "success" : "error"}`}>
            <div>
              ✓ Built <strong>{result.schema.title}</strong> —{" "}
              {result.resolved
                ? "saidified, hosted, and resolved into KERIA."
                : `saidified & hosted, but not resolved (${result.error}).`}
            </div>
            <div className="kv" style={{ marginTop: 8 }}>
              <span className="kv-k">Schema SAID</span>
              <code className="kv-v">{result.schema.said}</code>
            </div>
          </div>
        )}

        <button className="btn primary" onClick={create} disabled={busy}>
          {busy ? "Saidifying…" : "Create schema"}
        </button>

        <CodePeek
          file="server/src/schema/saidify.ts"
          symbol="buildSchema()"
          code={SAIDIFY_CODE}
        />
      </div>
    </section>
  );
}

function SchemaCard({
  schema,
  onChanged,
}: {
  schema: SchemaSummary;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await api.deleteSchema(schema.said);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="schema-item">
      <div className="schema-main">
        <div className="schema-title">
          {schema.title}
          <span className={`tag ${schema.source}`}>{schema.source}</span>
        </div>
        <div className="schema-fields muted">
          {schema.fields.join(", ") || "—"}
        </div>
        <code className="schema-said">{schema.said}</code>
      </div>
      <button className="icon-btn" onClick={remove} disabled={busy} title="Delete">
        🗑
      </button>
    </div>
  );
}

function CatalogCard({
  item,
  onImported,
}: {
  item: CatalogItem;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function importIt() {
    setBusy(true);
    try {
      await api.importSchema(item.said);
      onImported();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="schema-item">
      <div className="schema-main">
        <div className="schema-title">{item.title}</div>
        <div className="schema-fields muted">
          {item.fields.join(", ") || "(complex: edges/rules)"}
        </div>
        <code className="schema-said">{item.said}</code>
      </div>
      {item.imported ? (
        <span className="tag catalog">imported</span>
      ) : (
        <button className="btn ghost small" onClick={importIt} disabled={busy}>
          {busy ? "Importing…" : "Import"}
        </button>
      )}
    </div>
  );
}
