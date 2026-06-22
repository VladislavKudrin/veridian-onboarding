import { ReactNode } from "react";
import { User } from "../api";

export type Tab = "holder" | "issuer";

export function Shell({
  user,
  onLogout,
  tab,
  setTab,
  keriaReady,
  children,
}: {
  user: User;
  onLogout: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  keriaReady: boolean | null;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand-inline">
          <span className="brand-mark sm">◇</span>
          <span>Veridian Sandbox</span>
        </div>

        <nav className="tabs">
          <button
            className={`tab ${tab === "holder" ? "active" : ""}`}
            onClick={() => setTab("holder")}
          >
            Holder
          </button>
          <button
            className={`tab ${tab === "issuer" ? "active" : ""}`}
            onClick={() => setTab("issuer")}
          >
            Issuer
          </button>
        </nav>

        <div className="topbar-right">
          <KeriaBadge ready={keriaReady} />
          <span className="muted">{user.displayName}</span>
          <button className="btn ghost small" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="dash">{children}</main>
    </div>
  );
}

function KeriaBadge({ ready }: { ready: boolean | null }) {
  if (ready === null) return <span className="badge">checking…</span>;
  return ready ? (
    <span className="badge ok">● KERIA online</span>
  ) : (
    <span className="badge warn">● KERIA offline</span>
  );
}
