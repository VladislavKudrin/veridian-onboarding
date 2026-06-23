import { useEffect, useState } from "react";
import { api, Connection, User } from "../api";
import { ConnectionGuide } from "./ConnectionGuide";
import { Prerequisites } from "./Prerequisites";
import { RequestStep } from "./RequestStep";

export function Dashboard({
  user,
  keriaReady,
}: {
  user: User;
  keriaReady: boolean | null;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connected, setConnected] = useState(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  async function refresh() {
    const conn = await api.getConnection().catch(() => null);
    if (conn) {
      setConnection(conn.connection);
      setConnected(conn.connected);
      setStaleReason(conn.stale ? conn.reason ?? "stale" : null);
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

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api.disconnect();
      setConnection(null);
      setConnected(false);
      setStaleReason(null);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      <div className="dash-head">
        <h1>Request a verifiable credential</h1>
        <p className="muted">
          Connect your Veridian wallet, then request a credential — the issuer
          reviews it and, if accepted, sends it to your wallet.
        </p>
      </div>

      {keriaReady === false && (
        <div className="alert error">
          The issuer's KERIA agent isn't reachable. Start the infrastructure with{" "}
          <code>docker compose up -d</code> and make sure the backend booted.
        </div>
      )}

      {!connected && <Prerequisites />}

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
              ✓ Connected. The issuer and your wallet have resolved each other's
              identifiers.
            </div>
            <div className="kv">
              <span className="kv-k">Your wallet AID</span>
              <code className="kv-v">{connection!.user_aid}</code>
            </div>
            <button
              className="btn ghost small"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect & start over"}
            </button>
          </div>
        ) : (
          <>
            {staleReason && (
              <div className="alert error" style={{ marginTop: 18 }}>
                {staleMessage(staleReason)}
              </div>
            )}
            <ConnectionGuide onConnected={handleConnected} />
          </>
        )}
      </section>

      {/* ── Step 2 — Request ────────────────────────────────── */}
      <section className={`card step ${connected ? "active" : "locked"}`}>
        <header className="step-header">
          <span className="step-num">2</span>
          <div>
            <h3>Request a credential</h3>
            <p className="muted">
              {connected
                ? "Pick a credential the issuer offers, fill in the details, and submit it for review."
                : "Unlocks once your wallet is connected."}
            </p>
          </div>
        </header>

        {connected && <RequestStep user={user} />}
      </section>
    </>
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
