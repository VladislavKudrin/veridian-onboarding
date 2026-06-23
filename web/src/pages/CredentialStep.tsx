import { useEffect, useState } from "react";
import { api, IssuedCredential, SchemaField, SchemaSummary, User } from "../api";
import { CodePeek } from "../components/CodePeek";
import { Explain } from "../components/Explain";

const ISSUE_CODE = `// server/src/signify/signify.service.ts — issueCredentials()
const result = await client.credentials().issue(name, {
  ri: regk,                          // the credential registry
  s: schemaSaid,                     // which schema
  a: { i: userAid, ...attributes },  // issuee AID + your values
});
await waitOperation(client, result.op);

// IPEX-grant it so it lands in the wallet's notifications:
const [grant, gsigs, gend] = await client.ipex().grant({
  senderName: name, recipient: userAid, acdc, iss, anc, datetime,
});
await client.ipex().submitGrant(name, grant, gsigs, gend, [userAid]);`;

function prefill(field: string, user: User): string {
  const n = field.toLowerCase();
  if (n === "email") return user.email;
  if (n === "firstname") return user.displayName.split(/\s+/)[0] ?? "";
  if (n === "lastname") return user.displayName.split(/\s+/).slice(1).join(" ");
  if (n === "name" || n === "fullname") return user.displayName;
  return "";
}

export function CredentialStep({
  user,
  credentials,
  onIssued,
  onGoToIssuer,
}: {
  user: User;
  credentials: IssuedCredential[];
  onIssued: () => void;
  onGoToIssuer: () => void;
}) {
  const [schemas, setSchemas] = useState<SchemaSummary[] | null>(null);
  const [said, setSaid] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState(false);

  useEffect(() => {
    api
      .listSchemas()
      .then((r) => {
        setSchemas(r.schemas);
        if (r.schemas[0]) setSaid(r.schemas[0].said);
      })
      .catch(() => setSchemas([]));
  }, []);

  const selected = schemas?.find((s) => s.said === said);

  // Reset + prefill the form whenever the chosen schema changes.
  useEffect(() => {
    if (!selected) return;
    const next: Record<string, string> = {};
    for (const a of selected.attributes) {
      next[a.name] =
        a.type === "date-time" ? new Date().toISOString() : prefill(a.name, user);
    }
    setValues(next);
    setIssued(false);
    setError("");
  }, [said]); // eslint-disable-line react-hooks/exhaustive-deps

  async function request() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.issueCredential({ said: selected.said, attributes: values });
      setIssued(true);
      onIssued();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (schemas === null) {
    return <p className="muted">Loading credential types…</p>;
  }

  if (schemas.length === 0) {
    return (
      <div className="empty-credentials">
        <p className="muted">
          The issuer doesn't offer any credential types yet. Create or import a
          schema first.
        </p>
        <button className="btn primary" onClick={onGoToIssuer}>
          Go to the Issuer tab →
        </button>
      </div>
    );
  }

  return (
    <div className="issue">
      <label>
        Credential type
        <select value={said} onChange={(e) => setSaid(e.target.value)}>
          {schemas.map((s) => (
            <option key={s.said} value={s.said}>
              {s.title}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="form" style={{ marginTop: 14 }}>
          {selected.attributes.length === 0 && (
            <p className="muted">This schema has no fillable attributes.</p>
          )}
          {selected.attributes.map((a) => (
            <AttrInput
              key={a.name}
              attr={a}
              value={values[a.name] ?? ""}
              onChange={(v) => setValues((p) => ({ ...p, [a.name]: v }))}
            />
          ))}

          {error && <div className="alert error">{error}</div>}
          {issued && (
            <div className="alert success">
              🎉 Issued! Open your Veridian wallet and accept it from your
              notifications.
            </div>
          )}

          <button className="btn primary" onClick={request} disabled={busy}>
            {busy ? "Issuing…" : `Request “${selected.title}”`}
          </button>
        </div>
      )}

      <Explain endpoint="POST /credentials/issue">
        <p>
          The issuer mints an <strong>ACDC</strong> against the chosen schema
          with your values, then <strong>IPEX-grants</strong> it to your wallet's
          AID — where it arrives as a notification to accept. The issuer's key
          signs the credential (this is the real signature, vs. the schema's
          self-addressing SAID).
        </p>
      </Explain>

      <CodePeek
        file="server/src/signify/signify.service.ts"
        symbol="issueCredentials()"
        code={ISSUE_CODE}
      />

      {credentials.length > 0 && (
        <div className="issued-list">
          <h4 className="section-title" style={{ marginTop: 18 }}>
            Issued
          </h4>
          {credentials.map((c) => (
            <div className="schema-item" key={c.id}>
              <div className="schema-main">
                <div className="schema-title">{c.schemaTitle}</div>
                <div className="schema-fields muted">
                  {Object.entries(c.attributes)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("  ·  ")}
                </div>
                <code className="schema-said">{c.credSaid}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttrInput({
  attr,
  value,
  onChange,
}: {
  attr: SchemaField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (attr.type === "boolean") {
    return (
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        {attr.name}
      </label>
    );
  }
  return (
    <label>
      {attr.name} <span className="muted">({attr.type})</span>
      <input
        type={attr.type === "number" || attr.type === "integer" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={attr.name}
      />
    </label>
  );
}
