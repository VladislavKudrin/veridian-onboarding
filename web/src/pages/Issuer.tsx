import { useEffect, useState } from "react";
import {
  api,
  CatalogItem,
  CredRequest,
  SchemaField,
  SchemaSummary,
} from "../api";
import { CodePeek } from "../components/CodePeek";
import { Explain } from "../components/Explain";
import { StatusTag } from "./RequestStep";

const FIELD_TYPES: SchemaField["type"][] = [
  "string",
  "number",
  "integer",
  "boolean",
  "date-time",
];

const ISSUER_CODE = `// server/src/signify/signify.service.ts

// Accept → issue the ACDC, then IPEX-grant it to the holder's wallet:
const res = await client.credentials().issue(name, {
  ri: regk, s: schemaSaid, a: { i: holderAid, ...attributes },
});
await waitOperation(client, res.op);
await client.ipex().submitGrant(name, grant, gsigs, gend, [holderAid]);

// Revoke → write a 'rev' event to the registry (TEL); verifiers + the
// wallet then see the credential as invalid:
const rev = await client.credentials().revoke(name, credSaid);
await waitOperation(client, rev.op);`;

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
        <h1>Issuer console</h1>
        <p className="muted">
          Review incoming credential requests and accept or decline them, and
          manage the credential types (schemas) you offer.
        </p>
      </div>

      {keriaReady === false && (
        <div className="alert error">
          KERIA is offline — you can manage schemas, but issuing requires the
          agent. Start it with <code>docker compose up -d</code>.
        </div>
      )}

      <IssuerRequests />

      <h2 className="issuer-divider">Credential types</h2>

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

function IssuerRequests() {
  const [requests, setRequests] = useState<CredRequest[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const r = await api.listRequests().catch(() => null);
    if (r) setRequests(r.requests);
  }
  useEffect(() => {
    refresh();
  }, []);

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  async function decide(
    r: CredRequest,
    action: "accept" | "decline" | "revoke"
  ) {
    if (
      action === "revoke" &&
      !window.confirm(
        `Revoke “${r.schemaTitle}” from ${r.holder?.displayName ?? "this holder"}? This writes a revocation event to the registry.`
      )
    ) {
      return;
    }
    let reason = "";
    if (action === "decline") reason = window.prompt("Reason (optional):") ?? "";
    setError("");
    setBusyId(r.id);
    try {
      if (action === "accept") await api.acceptRequest(r.id);
      else if (action === "decline") await api.declineRequest(r.id, reason);
      else await api.revokeRequest(r.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function attrLine(r: CredRequest) {
    return Object.entries(r.attributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join("  ·  ");
  }

  return (
    <section className="card">
      <h3 className="section-title">Requests</h3>
      {error && <div className="alert error">{error}</div>}

      {pending.length === 0 ? (
        <p className="muted">No pending requests.</p>
      ) : (
        <div className="schema-list">
          {pending.map((r) => (
            <div className="request-item" key={r.id}>
              <div className="schema-main">
                <div className="schema-title">
                  {r.holder?.displayName ?? "?"}{" "}
                  <span className="muted">requested</span> {r.schemaTitle}
                  {!r.connected && (
                    <span className="status-tag declined">not connected</span>
                  )}
                </div>
                <div className="schema-fields muted">{attrLine(r)}</div>
              </div>
              <div className="request-actions">
                <button
                  className="btn primary small"
                  disabled={busyId === r.id || !r.connected}
                  onClick={() => decide(r, "accept")}
                  title={r.connected ? "" : "Holder must be connected"}
                >
                  {busyId === r.id ? "…" : "Accept"}
                </button>
                <button
                  className="btn ghost small"
                  disabled={busyId === r.id}
                  onClick={() => decide(r, "decline")}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <>
          <h4 className="section-title" style={{ marginTop: 18 }}>
            History
          </h4>
          <div className="schema-list">
            {decided.map((r) => (
              <div className="request-item" key={r.id}>
                <div className="schema-main">
                  <div className="schema-title">
                    {r.holder?.displayName ?? "?"} — {r.schemaTitle}
                    <StatusTag status={r.status} />
                  </div>
                  {r.status === "declined" && r.reason && (
                    <div className="schema-fields" style={{ color: "var(--error)" }}>
                      Declined: {r.reason}
                    </div>
                  )}
                  {r.credSaid && (
                    <code className="schema-said">{r.credSaid}</code>
                  )}
                </div>
                {r.status === "accepted" && (
                  <div className="request-actions">
                    <button
                      className="btn ghost small danger"
                      disabled={busyId === r.id}
                      onClick={() => decide(r, "revoke")}
                    >
                      {busyId === r.id ? "…" : "Revoke"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Explain endpoint="POST /requests/:id/accept">
        <p>
          Accepting mints the ACDC against the requested schema with the
          holder's values and IPEX-grants it to their wallet AID — where they
          accept it. Declining records a reason the holder sees.
        </p>
      </Explain>

      <CodePeek
        file="server/src/signify/signify.service.ts"
        symbol="issue & revoke"
        code={ISSUER_CODE}
      />
    </section>
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
  async function toggleLogin() {
    setBusy(true);
    try {
      await api.toggleSchemaLogin(schema.said, !schema.loginEnabled);
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
      <label
        className="switch-row"
        title="Accept this credential type for log-in"
      >
        <span className="switch-text">
          <span className="switch-icon">🔑</span> Login
        </span>
        <span className={`switch ${schema.loginEnabled ? "on" : ""}`}>
          <input
            type="checkbox"
            checked={schema.loginEnabled}
            onChange={toggleLogin}
            disabled={busy}
          />
          <span className="switch-track" />
          <span className="switch-knob" />
        </span>
      </label>
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
