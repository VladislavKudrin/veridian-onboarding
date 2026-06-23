import { useEffect, useState } from "react";
import { api, getToken, setToken, User } from "./api";
import { Dashboard } from "./pages/Dashboard";
import { Issuer } from "./pages/Issuer";
import { Login } from "./pages/Login";
import { Shell } from "./pages/Shell";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [keriaReady, setKeriaReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .health()
      .then((h) => setKeriaReady(h.keria.available))
      .catch(() => setKeriaReady(false));
  }, [user]);

  function handleLogout() {
    setToken(null);
    setUser(null);
  }

  if (loading) {
    return <div className="centered muted">Loading…</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Shell user={user} onLogout={handleLogout} keriaReady={keriaReady}>
      {user.role === "issuer" ? (
        <Issuer keriaReady={keriaReady} />
      ) : (
        <Dashboard user={user} keriaReady={keriaReady} />
      )}
    </Shell>
  );
}
