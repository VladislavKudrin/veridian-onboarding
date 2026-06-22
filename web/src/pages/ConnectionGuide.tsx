import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Explain } from "../components/Explain";
import { QrScanner } from "../components/QrScanner";
import { api, Connection } from "../api";

/**
 * The guided connection experience.
 *
 * A "connection" in Veridian is a *mutual* introduction between two
 * identifiers — the issuer's and the holder's. We walk the user through
 * both halves, explaining the KERI concept behind each one.
 */
export function ConnectionGuide({
  onConnected,
}: {
  onConnected: (connection: Connection) => void;
}) {
  const [oobi, setOobi] = useState("");
  const [issuerAid, setIssuerAid] = useState("");
  const [userOobi, setUserOobi] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    api
      .getPlatformOobi()
      .then((r) => {
        setOobi(r.oobi);
        setIssuerAid(r.aid);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function copyOobi() {
    try {
      await navigator.clipboard.writeText(oobi);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function handleScan(text: string) {
    setScanning(false);
    const value = text.trim();
    if (!value.includes("/oobi/")) {
      setError("Scanned a QR, but it's not a wallet OOBI. Try again.");
      return;
    }
    setError("");
    setUserOobi(value);
  }

  async function establish() {
    const value = userOobi.trim();
    if (!value.includes("/oobi/")) {
      setError("That doesn't look like a wallet OOBI — it should contain /oobi/.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { connection } = await api.resolveOobi(value);
      onConnected(connection);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="guide">
      <p className="guide-lead">
        A connection is a two-way introduction between the issuer's identifier
        and your wallet's. Do both halves below and you're linked — no accounts,
        no blockchain, just witnessed key state.
      </p>

      {/* ── Half 1: issuer → wallet ───────────────────────── */}
      <div className="sub-step">
        <div className="sub-step-head">
          <span className="dot">A</span>
          <h4>Introduce the issuer to your wallet</h4>
        </div>
        <p className="muted">
          Open your Veridian wallet, choose <em>Scan</em>, and point it at this
          code (or copy the link into the wallet).
        </p>

        <div className="qr-row">
          <div className="qr-wrap">
            {oobi ? (
              <QRCodeSVG value={oobi} size={180} />
            ) : (
              <div className="qr-placeholder muted">Loading OOBI…</div>
            )}
          </div>
          <div className="qr-side">
            {issuerAid && (
              <div className="kv">
                <span className="kv-k">Issuer AID</span>
                <code className="kv-v">{issuerAid}</code>
              </div>
            )}
            <button
              className="btn ghost small"
              disabled={!oobi}
              onClick={copyOobi}
            >
              {copied ? "Copied ✓" : "Copy issuer OOBI"}
            </button>
          </div>
        </div>

        <Explain endpoint="GET /connection/oobi">
          <p>
            That QR encodes the issuer's <strong>OOBI</strong>{" "}
            (Out-Of-Band Introduction) — a discovery URL that points at its{" "}
            <strong>AID</strong> (Autonomic Identifier). When your wallet
            resolves it, it fetches and verifies the issuer's signed key state
            from its witnesses.
          </p>
          <p>
            From now on your wallet can cryptographically verify anything the
            issuer signs — including the credential it's about to send you.
          </p>
        </Explain>
      </div>

      {/* ── Half 2: wallet → issuer ───────────────────────── */}
      <div className="sub-step">
        <div className="sub-step-head">
          <span className="dot">B</span>
          <h4>Introduce your wallet back to the issuer</h4>
        </div>
        <p className="muted">
          In your wallet open the identifier you just used and show its OOBI QR
          — scan it with your camera, or paste the OOBI link below.
        </p>

        {scanning ? (
          <div className="scanner-box">
            <QrScanner
              onResult={handleScan}
              onError={(m) => {
                setError(m);
                setScanning(false);
              }}
            />
            <button
              className="btn ghost small"
              onClick={() => setScanning(false)}
            >
              Cancel scan
            </button>
          </div>
        ) : (
          <button
            className="btn ghost small scan-btn"
            onClick={() => {
              setError("");
              setScanning(true);
            }}
          >
            📷 Scan wallet QR
          </button>
        )}

        <div className="or-divider">
          <span>or paste it</span>
        </div>

        <textarea
          placeholder="Paste your wallet identifier's OOBI (…/oobi/…)"
          value={userOobi}
          onChange={(e) => setUserOobi(e.target.value)}
          rows={3}
        />

        {error && <div className="alert error">{error}</div>}

        <button
          className="btn primary"
          onClick={establish}
          disabled={loading || !userOobi.trim()}
        >
          {loading ? "Establishing connection…" : "Establish Connection"}
        </button>

        <Explain endpoint="POST /connection/resolve">
          <p>
            Connections are bidirectional. The issuer now resolves{" "}
            <em>your</em> OOBI to learn your AID — the address it will later send
            (IPEX-grant) your credential to.
          </p>
          <p>
            The backend persists this AID, so the link survives restarts and the
            issuer always knows where your credential should go.
          </p>
        </Explain>
      </div>
    </div>
  );
}
