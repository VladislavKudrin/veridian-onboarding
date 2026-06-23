import { useEffect, useState } from "react";
import { api, CredRequest, SchemaField, SchemaSummary, User } from "../api";
import { CodePeek } from "../components/CodePeek";
import { Explain } from "../components/Explain";

const REQUEST_CODE = `// server/src/routes/request.routes.ts — the holder applies; the
// issuer later accepts (issues) or declines. No self-issue.
POST /requests           { said, attributes }   // create a pending request
POST /requests/:id/accept                        // issuer → mint + IPEX-grant
POST /requests/:id/decline { reason }`;

function prefill(field: string, user: User): string {
  const n = field.toLowerCase();
  if (n === "email") return user.email;
  if (n === "firstname") return user.displayName.split(/\s+/)[0] ?? "";
  if (n === "lastname") return user.displayName.split(/\s+/).slice(1).join(" ");
  if (n === "name" || n === "fullname") return user.displayName;
  return "";
}

export function RequestStep({ user }: { user: User }) {
  const [schemas, setSchemas] = useState<SchemaSummary[] | null>(null);
  const [requests, setRequests] = useState<CredRequest[]>([]);
  const [said, setSaid] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function refreshRequests() {
    const r = await api.listRequests().catch(() => null);
    if (r) setRequests(r.requests);
  }

  useEffect(() => {
    api
      .listSchemas()
      .then((r) => {
        setSchemas(r.schemas);
        if (r.schemas[0]) setSaid(r.schemas[0].said);
      })
      .catch(() => setSchemas([]));
    refreshRequests();
  }, []);

  const selected = schemas?.find((s) => s.said === said);

  useEffect(() => {
    if (!selected) return;
    const next: Record<string, string> = {};
    for (const a of selected.attributes) {
      next[a.name] =
        a.type === "date-time" ? new Date().toISOString() : prefill(a.name, user);
    }
    setValues(next);
    setSubmitted(false);
    setError("");
  }, [said]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.createRequest({ said: selected.said, attributes: values });
      setSubmitted(true);
      refreshRequests();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (schemas === null) return <p className="muted">Loading…</p>;

  return (
    <div className="issue">
      {schemas.length === 0 ? (
        <p className="muted">
          The issuer doesn't offer any credential types yet — check back later.
        </p>
      ) : (
        <>
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
              {selected.attributes.map((a) => (
                <AttrInput
                  key={a.name}
                  attr={a}
                  value={values[a.name] ?? ""}
                  onChange={(v) => setValues((p) => ({ ...p, [a.name]: v }))}
                />
              ))}

              {error && <div className="alert error">{error}</div>}
              {submitted && (
                <div className="alert success">
                  ✓ Request submitted — the issuer will review it. Watch its
                  status below.
                </div>
              )}

              <button className="btn primary" onClick={submit} disabled={busy}>
                {busy ? "Submitting…" : `Request “${selected.title}”`}
              </button>
            </div>
          )}
        </>
      )}

      <Explain title="What happens to my request?">
        <p>
          Your request goes to the issuer as <strong>pending</strong>. They
          review the details you entered and either <strong>accept</strong> — in
          which case the credential is minted and IPEX-granted to your wallet to
          accept — or <strong>decline</strong>. You can't issue to yourself; the
          issuer is the authority.
        </p>
      </Explain>

      <CodePeek
        file="server/src/routes/request.routes.ts"
        symbol="apply / accept / decline"
        code={REQUEST_CODE}
      />

      {requests.length > 0 && (
        <div className="issued-list">
          <h4 className="section-title" style={{ marginTop: 18 }}>
            My requests
          </h4>
          {requests.map((r) => (
            <div className="schema-item" key={r.id}>
              <div className="schema-main">
                <div className="schema-title">
                  {r.schemaTitle}
                  <StatusTag status={r.status} />
                </div>
                <div className="schema-fields muted">
                  {Object.entries(r.attributes)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("  ·  ")}
                </div>
                {r.status === "declined" && r.reason && (
                  <div className="schema-fields" style={{ color: "var(--error)" }}>
                    Declined: {r.reason}
                  </div>
                )}
                {r.status === "revoked" && (
                  <div className="schema-fields" style={{ color: "var(--error)" }}>
                    Revoked by the issuer — no longer valid.
                  </div>
                )}
                {r.credSaid && <code className="schema-said">{r.credSaid}</code>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusTag({ status }: { status: CredRequest["status"] }) {
  return <span className={`status-tag ${status}`}>{status}</span>;
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
