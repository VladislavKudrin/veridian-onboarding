import { FormEvent, useState } from "react";
import { api, setToken, User } from "../api";

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.login(username, password);
      setToken(token);
      onLogin(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered">
      <div className="card login-card">
        <div className="brand">
          <div className="brand-mark">◇</div>
          <h1>Veridian Sandbox</h1>
          <p className="muted">
            Sign in to connect your Veridian wallet and receive a verifiable
            credential.
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
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button className="btn primary" disabled={loading}>
            {loading ? "Signing in…" : "Log In"}
          </button>
          <p className="hint muted">Demo account: admin / admin</p>
        </form>
      </div>
    </div>
  );
}
