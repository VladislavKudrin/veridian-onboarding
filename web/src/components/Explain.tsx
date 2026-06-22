import { ReactNode, useState } from "react";

/**
 * A collapsible "under the hood" note. This is what makes the POC a *guide*:
 * every step pairs a plain-language action with an optional deeper explanation
 * of the Veridian / KERI concept behind it, plus the API call it triggers.
 */
export function Explain({
  title = "What's happening under the hood",
  endpoint,
  children,
  defaultOpen = false,
}: {
  title?: string;
  endpoint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`explain ${open ? "open" : ""}`}>
      <button className="explain-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="explain-icon">💡</span>
        <span>{title}</span>
        {endpoint && <code className="explain-endpoint">{endpoint}</code>}
        <span className="explain-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="explain-body">{children}</div>}
    </div>
  );
}
