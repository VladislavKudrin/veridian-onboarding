import { useEffect, useState } from "react";
import { api } from "../api";

/**
 * "Before you start" — two paths, so people aren't shown setup they don't need:
 *   • Already have a wallet  -> just connect (Step 1). KERIA URLs are irrelevant.
 *   • Need a wallet          -> spin one up on THIS sandbox's KERIA (collapsed).
 *
 * Key correctness point: the boot/connect URLs decide WHERE a wallet's agent is
 * hosted — NOT which issuers it can use. Any wallet can receive credentials
 * from this issuer regardless of whose KERIA it runs on.
 */
export function Prerequisites() {
  const [boot, setBoot] = useState("");
  const [connect, setConnect] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    api
      .info()
      .then((i) => {
        setBoot(i.wallet.bootUrl);
        setConnect(i.wallet.connectUrl);
        setIsPublic(i.public);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="card prereq">
      <div className="alert warn-soft">
        <strong>⚠️ Sandbox — not for production.</strong> Wallets set up here run
        on ephemeral local infrastructure; if it restarts you may need to set the
        wallet up again.
      </div>

      <p className="prereq-lead">
        <strong>Already have a Veridian wallet?</strong> You're set — just use{" "}
        <strong>Create Connection</strong> below. It works with any wallet, on
        any KERIA.
      </p>

      <button
        className={`setup-toggle ${setupOpen ? "open" : ""}`}
        onClick={() => setSetupOpen((o) => !o)}
      >
        <span>📱 New to Veridian? Set up a wallet for this sandbox</span>
        <span className="setup-chevron">{setupOpen ? "▾" : "▸"}</span>
      </button>

      {setupOpen && (
        <div className="setup-body">
          <ol className="prereq-list">
            <li>
              <strong>Get the Veridian wallet</strong> from{" "}
              <a href="https://veridian.id" target="_blank" rel="noreferrer">
                veridian.id
              </a>{" "}
              (or run the dev build).
            </li>
            <li>
              <strong>Host its agent on this sandbox's KERIA.</strong> When the
              wallet asks for KERIA endpoints, use:
              <div className="url-fields">
                <CopyField label="Boot URL" value={boot} />
                <CopyField label="Connect URL" value={connect} />
              </div>
              <span className="url-reach muted">
                {isPublic
                  ? "Public URLs (via ngrok) — reachable from a phone on any network."
                  : "Local URLs — only reachable from a wallet on this same machine."}
              </span>
            </li>
          </ol>

          <p className="setup-note muted">
            The <strong>boot</strong> URL bootstraps your wallet's agent the
            first time; <strong>connect</strong> is what it talks to afterwards.
            These only decide <em>where your wallet lives</em> — not which
            issuers you can use. Any wallet can connect to this issuer and
            receive credentials, so if you already have one, ignore these.
          </p>
        </div>
      )}
    </section>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="url-field">
      <span className="url-label">{label}</span>
      <code className="url-value">{value || "…"}</code>
      <button className="btn ghost small" onClick={copy} disabled={!value}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
