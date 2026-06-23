import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { handoffInstruction, JOURNEY, TourRole } from "./steps";

const DONE_KEY = "veridian_tour_done";
const ACTIVE_KEY = "veridian_tour_active";
const STEP_KEY = "veridian_tour_step";

interface TourApi {
  /** Start (or restart) the guided journey from the beginning. */
  start: () => void;
}

const TourContext = createContext<TourApi>({ start: () => {} });
export const useTour = () => useContext(TourContext);

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export function TourProvider({
  role,
  children,
}: {
  role: TourRole;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(
    () => localStorage.getItem(ACTIVE_KEY) === "1"
  );
  const [step, setStep] = useState(() =>
    Math.max(0, Number(localStorage.getItem(STEP_KEY) ?? 0))
  );
  // Temporarily hidden (e.g. after "Got it" on a hand-off) but still active —
  // reappears at the right step once the role/step changes (i.e. after login).
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
  }, [role, step]);

  // Auto-pop on first ever visit.
  useEffect(() => {
    if (!localStorage.getItem(DONE_KEY) && !active) {
      setActive(true);
      setStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist so the journey survives logout / role switches.
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, active ? "1" : "0");
  }, [active]);
  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  const start = useCallback(() => {
    localStorage.removeItem(DONE_KEY);
    setStep(0);
    setDismissed(false);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    localStorage.setItem(DONE_KEY, "1");
    setActive(false);
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= JOURNEY.length - 1) {
        finish();
        return s;
      }
      return s + 1;
    });
  }, [finish]);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  return (
    <TourContext.Provider value={{ start }}>
      {children}
      {active && !dismissed && (
        <TourOverlay
          role={role}
          step={step}
          onNext={next}
          onBack={back}
          onSkip={finish}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </TourContext.Provider>
  );
}

function TourOverlay({
  role,
  step,
  onNext,
  onBack,
  onSkip,
  onDismiss,
}: {
  role: TourRole;
  step: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}) {
  const current = JOURNEY[step];
  const matches = current.role === "any" || current.role === role;
  const wantsTarget = matches ? current.target : undefined;

  const [rect, setRect] = useState<Rect | null>(null);

  // Measure (and keep measuring) the spotlight target.
  useLayoutEffect(() => {
    if (!wantsTarget) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${wantsTarget}"]`
      );
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev &&
          Math.abs(prev.top - r.top) < 0.5 &&
          Math.abs(prev.left - r.left) < 0.5 &&
          Math.abs(prev.width - r.width) < 0.5 &&
          Math.abs(prev.height - r.height) < 0.5
            ? prev // unchanged — skip the re-render
            : { top: r.top, left: r.left, width: r.width, height: r.height }
        );
      } else {
        setRect((prev) => (prev === null ? prev : null));
      }
      raf = requestAnimationFrame(measure);
    };
    // Scroll the target into view, then track it.
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${wantsTarget}"]`
    );
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    return () => cancelAnimationFrame(raf);
  }, [wantsTarget, step]);

  // Keyboard: Esc skips, Enter/→ next, ← back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      else if (e.key === "ArrowLeft") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onSkip]);

  const total = JOURNEY.length;
  const isLast = step === total - 1;

  // Hand-off: the journey wants the other role/context. "Got it" closes the
  // card (the tour stays active and re-appears at this step once you switch).
  if (!matches) {
    return (
      <div className="tour-backdrop tour-backdrop--solid">
        <div className="tour-card tour-card--center tour-handoff">
          <div className="tour-handoff-icon">🔄</div>
          <div className="tour-step-no">
            Step {step + 1} of {total}
          </div>
          <h3>{current.title}</h3>
          <p>{current.body}</p>
          <div className="tour-handoff-do">{handoffInstruction(current.role)}</div>
          <p className="tour-handoff-note muted">
            Do that and the tour picks up right here.
          </p>
          <div className="tour-actions">
            <button className="btn ghost small" onClick={onSkip}>
              Skip tour
            </button>
            <div className="tour-actions-right">
              <button
                className="btn ghost small"
                onClick={onBack}
                disabled={step === 0}
              >
                Back
              </button>
              <button className="btn primary small" onClick={onDismiss}>
                Got it →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const spotlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // No spotlight target (intro / done, or target not on screen) → dim via a
  // solid centered backdrop instead of a cutout.
  const solid = !spotlight;

  return (
    <div className={`tour-backdrop${solid ? " tour-backdrop--solid" : ""}`}>
      {/* Spotlight cutout (darkens everything else + glows the target). */}
      {spotlight && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      <TourCard
        rect={spotlight}
        title={current.title}
        body={current.body}
        stepNo={step + 1}
        total={total}
        isLast={isLast}
        canBack={step > 0}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
    </div>
  );
}

function TourCard({
  rect,
  title,
  body,
  stepNo,
  total,
  isLast,
  canBack,
  onNext,
  onBack,
  onSkip,
}: {
  rect: Rect | null;
  title: string;
  body: string;
  stepNo: number;
  total: number;
  isLast: boolean;
  canBack: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the card under (or over) the spotlight, clamped to viewport.
  useLayoutEffect(() => {
    if (!rect) {
      setPos(null);
      return;
    }
    const card = cardRef.current;
    const cw = card?.offsetWidth ?? 340;
    const ch = card?.offsetHeight ?? 200;
    const margin = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.top + rect.height + margin;
    if (top + ch > vh - 10) {
      // not enough room below — go above
      top = Math.max(10, rect.top - ch - margin);
    }
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(12, Math.min(left, vw - cw - 12));
    setPos({ top, left });
  }, [rect, title, body]);

  const centered = !rect || !pos;

  return (
    <div
      ref={cardRef}
      className={`tour-card${centered ? " tour-card--center" : ""}`}
      style={centered ? undefined : { top: pos!.top, left: pos!.left }}
    >
      <div className="tour-step-no">
        Step {stepNo} of {total}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="tour-dots">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`tour-dot${i === stepNo - 1 ? " on" : ""}`}
          />
        ))}
      </div>
      <div className="tour-actions">
        <button className="btn ghost small" onClick={onSkip}>
          Skip tour
        </button>
        <div className="tour-actions-right">
          {canBack && (
            <button className="btn ghost small" onClick={onBack}>
              Back
            </button>
          )}
          <button className="btn primary small" onClick={onNext}>
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
