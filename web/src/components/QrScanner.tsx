import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

/**
 * Opens the device camera and reports the first QR code it decodes.
 * Used to scan a wallet identifier OOBI instead of pasting it.
 *
 * Written to survive React 18 StrictMode's mount→cleanup→mount double-invoke:
 * html5-qrcode's stop() throws synchronously if start() hasn't finished, so the
 * cleanup always waits for start to settle and stops defensively.
 */
export function QrScanner({
  onResult,
  onError,
}: {
  onResult: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const elementId = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const [status, setStatus] = useState("Starting camera…");

  useEffect(() => {
    let cancelled = false;
    let done = false;
    const scanner = new Html5Qrcode(elementId.current);
    let startPromise: Promise<unknown> = Promise.resolve();

    async function safeStop() {
      try {
        const state = scanner.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          await scanner.stop();
        }
      } catch {
        /* not running — ignore */
      }
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
    }

    async function begin() {
      // Pick a real camera — a hard facingMode:"environment" fails on laptops.
      let camera: string | { facingMode: string } = { facingMode: "environment" };
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras?.length) {
          const rear = cameras.find((c) =>
            /back|rear|environment/i.test(c.label)
          );
          camera = (rear ?? cameras[cameras.length - 1]).id;
        }
      } catch (e: any) {
        if (/denied|permission|NotAllowed/i.test(String(e?.message))) {
          throw new Error("Camera permission was denied. Allow it and retry.");
        }
        // else keep the facingMode fallback
      }
      if (cancelled) return;

      startPromise = scanner.start(
        camera,
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (text) => {
          if (done) return;
          done = true;
          onResult(text);
        },
        () => {
          /* ignore per-frame "not found" errors */
        }
      );
      await startPromise;

      if (cancelled) {
        await safeStop(); // unmounted during start → release the camera
        return;
      }
      setStatus("");
    }

    begin().catch((e: any) => {
      if (!cancelled) onError?.(e?.message || "Could not start the camera.");
    });

    return () => {
      cancelled = true;
      // Only stop after start() has settled, so stop() never throws.
      startPromise.then(safeStop, safeStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qr-scanner-wrap">
      <div id={elementId.current} className="qr-scanner" />
      {status && <div className="qr-status muted">{status}</div>}
    </div>
  );
}
