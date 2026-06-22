import { useState } from "react";

/**
 * A collapsible "here's the actual code, and where it lives" panel. This is the
 * lift-the-chunks half of the POC: each step can show the real signify-ts call
 * behind it, copyable, with a path into the repo.
 */
export function CodePeek({
  file,
  symbol,
  code,
}: {
  file: string;
  symbol?: string;
  code: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`codepeek ${open ? "open" : ""}`}>
      <button className="codepeek-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="codepeek-icon">{"</>"}</span>
        <span>View the code</span>
        <code className="codepeek-file">
          {file}
          {symbol ? ` · ${symbol}` : ""}
        </code>
        <span className="codepeek-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="codepeek-body">
          <div className="codepeek-head">
            <code className="muted">{file}</code>
            <button className="btn ghost small" onClick={copy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <pre className="codepeek-pre">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
