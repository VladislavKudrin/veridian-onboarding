import { FormEvent, useState } from "react";
import { api, setToken, User } from "../api";

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const isRegister = mode === "register";

  return (
    <div className="centered">
      <div className="card login-card">
        <div className="brand">
          <div className="brand-mark">◇</div>
          <h1>Veridian Sandbox</h1>
          <p className="muted">
            {isRegister
              ? "Create an account to connect your wallet and request credentials."
              : "Sign in to connect your wallet and request verifiable credentials."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form">
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

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button className="btn primary" disabled={loading}>
            {loading
              ? isRegister
                ? "Creating…"
                : "Signing in…"
              : isRegister
                ? "Create account"
                : "Log In"}
          </button>

          <p className="hint muted">
            {isRegister ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Create an account
                </button>
                <br />
                Issuer demo: <code>admin / admin</code>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
