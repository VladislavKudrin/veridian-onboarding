import { useEffect, useState } from "react";
import { api, Connection, User } from "../api";
import { ConnectionGuide } from "./ConnectionGuide";

export function Dashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connected, setConnected] = useState(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [keriaReady, setKeriaReady] = useState<boolean | null>(null);

  async function refresh() {
    const [health, conn] = await Promise.allSettled([
      api.health(),
      api.getConnection(),
    ]);
    if (health.status === "fulfilled")
      setKeriaReady(health.value.keria.available);
    if (conn.status === "fulfilled") {
      setConnection(conn.value.connection);
      setConnected(conn.value.connected);
      setStaleReason(conn.value.stale ? conn.value.reason ?? "stale" : null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleConnected(c: Connection) {
    setConnection(c);
    setConnected(true);
    setStaleReason(null);
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand-inline">
          <span className="brand-mark sm">◇</span>
          <span>Veridian Sandbox</span>
          <span className="topbar-sub">Credential Issuance</span>
        </div>
        <div className="topbar-right">
          <KeriaBadge ready={keriaReady} />
          <span className="muted">{user.displayName}</span>
          <button className="btn ghost small" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="dash">
        <div className="dash-head">
          <h1>Get a verifiable credential</h1>
          <p className="muted">
            Two steps: link your Veridian wallet to the issuer, then receive your
            verifiable credential. We explain what happens at each step.
          </p>
        </div>

        {keriaReady === false && (
          <div className="alert error">
            The issuer's KERIA agent isn't reachable. Start the
            infrastructure with <code>docker compose up -d</code> and make sure
            the backend booted.
          </div>
        )}

        {/* ── Step 1 — Connection ─────────────────────────────── */}
        <section className={`card step ${connected ? "done" : "active"}`}>
          <header className="step-header">
            <span className="step-num">{connected ? "✓" : "1"}</span>
            <div>
              <h3>Connect your identity wallet</h3>
              <p className="muted">
                Establish a mutual KERI connection between the issuer and your
                wallet.
              </p>
            </div>
          </header>

          {connected ? (
            <div className="connected-summary">
              <div className="alert success">
                ✓ Connected. The issuer and your wallet have resolved each
                other's identifiers.
              </div>
              <div className="kv">
                <span className="kv-k">Your wallet AID</span>
                <code className="kv-v">{connection!.user_aid}</code>
              </div>
            </div>
          ) : (
            <>
              {staleReason && (
                <div className="alert error">{staleMessage(staleReason)}</div>
              )}
              <ConnectionGuide onConnected={handleConnected} />
            </>
          )}
        </section>

        {/* ── Step 2 — Issuance (next chunk) ──────────────────── */}
        <section className="card step locked">
          <header className="step-header">
            <span className="step-num">2</span>
            <div>
              <h3>Receive your credential</h3>
              <p className="muted">
                {connected
                  ? "Coming next: the issuer creates an ACDC credential and IPEX-grants it to your wallet."
                  : "Unlocks once your wallet is connected."}
              </p>
            </div>
          </header>
          <span className="chip">Next chunk →</span>
        </section>
      </main>
    </div>
  );
}

function staleMessage(reason: string): string {
  switch (reason) {
    case "issuer-changed":
      return "The issuer identity changed since you last connected (the agent was re-created). Please reconnect your wallet.";
    case "contact-missing":
      return "The issuer no longer has your wallet on record. Please reconnect.";
    case "agent-unavailable":
      return "Can't verify your connection while the issuer's agent is offline.";
    default:
      return "Your previous connection could not be verified. Please reconnect.";
  }
}

function KeriaBadge({ ready }: { ready: boolean | null }) {
  if (ready === null) return <span className="badge">checking…</span>;
  return ready ? (
    <span className="badge ok">● KERIA online</span>
  ) : (
    <span className="badge warn">● KERIA offline</span>
  );
}
