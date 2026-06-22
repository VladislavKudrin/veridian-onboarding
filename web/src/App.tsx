import { useEffect, useState } from "react";
import { api, getToken, setToken, User } from "./api";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  function handleLogout() {
    setToken(null);
    setUser(null);
  }

  if (loading) {
    return <div className="centered muted">Loading…</div>;
  }

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} />
  ) : (
    <Login onLogin={setUser} />
  );
}
