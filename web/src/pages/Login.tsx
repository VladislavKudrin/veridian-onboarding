import { FormEvent, useEffect, useRef, useState } from "react";
import { api, setToken, User } from "../api";
import { CodePeek } from "../components/CodePeek";
import { Explain } from "../components/Explain";
import { useTour } from "../tour/Tour";

type Mode = "login" | "register" | "credential";

const PRESENTATION_CODE = `// 1. Send a presentation request (IPEX apply) to the wallet AID. The
//    oobiUrl lets the wallet resolve the requested schema (or it drops it):
const data = { m: "", s: schemaSaid, a: {}, oobiUrl: \`\${base}/oobi\` };
const [apply, sigs] = await client.exchanges()
  .createExchangeMessage(hab, "/ipex/apply", data, {}, holderAid);
const op = await client.ipex().submitApply(name, apply, sigs, [holderAid]);
await waitOperation(client, op);

// 2. A poller watches for the wallet's offer, verifies the credential
//    (schema is login-enabled · issued by us · holder AID matches · not
//    revoked), agrees to complete the exchange, then mints the session:
await client.ipex().agree({ senderName: name, recipient, offerSaid });`;

const FAIL_MESSAGES: Record<string, string> = {
  "schema-not-allowed": "That credential type can't be used to log in.",
  "issuer-mismatch": "That credential wasn't issued by this sandbox.",
  "holder-mismatch": "That credential doesn't belong to this account.",
  revoked: "That credential has been revoked.",
  "bad-offer": "The presentation couldn't be read. Try again.",
  "account-removed": "Account not found.",
  expired: "The request timed out — try again.",
};

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const { start: startTour } = useTour();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // credential-login state
  const [waiting, setWaiting] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function finishWithToken(token: string) {
    setToken(token);
    const user = await api.me();
    onLogin(user);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } =
        mode === "login"
          ? await api.login(username, password)
          : await api.register({ username, password, displayName, email });
      setToken(token);
      onLogin(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function startCredLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { sessionId } = await api.credLoginStart(username);
      setLoading(false);
      setWaiting(true);
      cancelled.current = false;
      poll(sessionId);
    } catch (err) {
      setLoading(false);
      setError((err as Error).message);
    }
  }

  async function poll(sessionId: string) {
    while (!cancelled.current) {
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelled.current) return;
      let res;
      try {
        res = await api.credLoginStatus(sessionId);
      } catch {
        continue;
      }
      if (res.status === "success" && res.token) {
        await finishWithToken(res.token);
        return;
      }
      if (res.status === "failed" || res.status === "expired") {
        setWaiting(false);
        setError(FAIL_MESSAGES[res.reason ?? res.status] ?? "Login failed.");
        return;
      }
    }
  }

  const isRegister = mode === "register";
  const isCredential = mode === "credential";

  return (
    <div className="centered">
      <div className="card login-card">
        <div className="brand">
          <div className="brand-mark">◇</div>
          <h1>Veridian Sandbox</h1>
          <p className="muted">
            {isRegister
              ? "Create an account to connect your wallet and request credentials."
              : isCredential
                ? "Log in by presenting a credential from your Veridian wallet."
                : "Sign in to connect your wallet and request verifiable credentials."}
          </p>
        </div>

        {isCredential && waiting ? (
          <div className="cred-waiting">
            <div className="cred-spinner">📲</div>
            <p>
              Check your Veridian wallet and <strong>approve the request</strong>
              .
            </p>
            <button
              className="btn ghost small"
              onClick={() => {
                cancelled.current = true;
                setWaiting(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <form
            onSubmit={isCredential ? startCredLogin : handleSubmit}
            className="form"
          >
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>

            {isRegister && (
              <>
                <label>
                  Full name
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alice Smith"
                  />
                </label>
                <label>
                  Email <span className="muted">(optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
              </>
            )}

            {!isCredential && (
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
              </label>
            )}

            {error && <div className="alert error">{error}</div>}

            <button className="btn primary" disabled={loading}>
              {loading
                ? "…"
                : isRegister
                  ? "Create account"
                  : isCredential
                    ? "Send request to my wallet"
                    : "Log In"}
            </button>

            {mode === "login" && (
              <button
                type="button"
                className="btn ghost"
                data-tour="wallet-login"
                onClick={() => {
                  setMode("credential");
                  setError("");
                }}
              >
                ◇ Log in with your wallet
              </button>
            )}
          </form>
        )}

        {isCredential && (
          <div className="cred-explain">
            <Explain title="How logging in with a credential works">
              <p>
                The platform sends a <strong>presentation request</strong> (an
                IPEX <code>apply</code>) to your wallet for a login-enabled
                credential. You approve and <strong>present</strong> it; the
                platform verifies it — issued here, an accepted schema, signed
                by your AID, and not revoked — then starts a session.
              </p>
              <p className="muted">
                The username only tells us where to send the request — your
                wallet's approval is what authenticates you. No password.
              </p>
            </Explain>

            <CodePeek
              file="server/src/signify/signify.service.ts + auth/credLoginPoller.ts"
              symbol="apply → verify → agree"
              code={PRESENTATION_CODE}
            />
          </div>
        )}

        <p className="hint muted">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode("login")}
              >
                Sign in
              </button>
            </>
          ) : isCredential ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode("login")}
            >
              ← Back to password login
            </button>
          ) : (
            <>
              New here?{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode("register")}
              >
                Create an account
              </button>
              <br />
              Issuer demo: <code>admin / admin</code>
              <br />
              New to all this?{" "}
              <button type="button" className="link-btn" onClick={startTour}>
                Take the guided tour
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );

  function switchMode(m: Mode) {
    cancelled.current = true;
    setWaiting(false);
    setMode(m);
    setError("");
  }
}
