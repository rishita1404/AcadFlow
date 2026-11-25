/**
 * ProductScene — CSS 3D perspective stack of real product panels.
 * Uses only CSS transforms + opacity. No Three.js, no WebGL, no images.
 * Respects prefers-reduced-motion: disables tilt, parallax, and idle float.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  TrendingDown,
  Clock,
  Users,
  CheckCircle2,
  Layers,
} from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00'];

/** Timetable slab — deepest layer */
function TimetablePanel({ lifted, label }) {
  return (
    <div
      className={`pscene-panel pscene-timetable ${lifted ? 'is-lifted' : ''}`}
      data-label={label}
    >
      <div className="pscene-panel-eyebrow">
        <Layers size={11} aria-hidden="true" />
        <span>Semester V · Sec B</span>
      </div>
      <div className="pscene-tt-grid">
        {/* Header row */}
        <div className="pscene-tt-cell pscene-tt-corner" />
        {DAYS.map((d) => (
          <div key={d} className="pscene-tt-cell pscene-tt-head">{d}</div>
        ))}

        {PERIODS.map((p, ri) => (
          <Fragment key={p}>
            <div className="pscene-tt-cell pscene-tt-time">{p}</div>
            {DAYS.map((d, ci) => {
              const isHighlight = ri === 1 && ci === 2; // Wed 10:00 — clash slot
              const isFilled = (ri === 0 && ci === 0) ||
                (ri === 0 && ci === 2) ||
                (ri === 1 && ci === 2) ||
                (ri === 1 && ci === 4) ||
                (ri === 2 && ci === 1) ||
                (ri === 3 && ci === 3) ||
                (ri === 4 && ci === 0) ||
                (ri === 4 && ci === 2);

              return (
                <div
                  key={`${d}${p}`}
                  className={`pscene-tt-cell pscene-tt-slot ${isFilled ? 'has-class' : ''} ${isHighlight ? 'has-clash' : ''}`}
                >
                  {isHighlight && (
                    <span className="pscene-clash-badge">
                      <AlertTriangle size={8} aria-hidden="true" />
                    </span>
                  )}
                  {isFilled && !isHighlight && (
                    <span className="pscene-slot-dot" />
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Notice card — middle layer */
function NoticePanel({ lifted, label }) {
  return (
    <div
      className={`pscene-panel pscene-notice ${lifted ? 'is-lifted' : ''}`}
      data-label={label}
    >
      <div className="pscene-panel-eyebrow">
        <Bell size={11} aria-hidden="true" />
        <span>Notice · Exam</span>
        <span className="pscene-eyebrow-pill pscene-pill-important">Important</span>
      </div>

      <p className="pscene-notice-title">End-semester exam schedule confirmed</p>

      <div className="pscene-notice-to">
        <Users size={10} aria-hidden="true" />
        <span>Sent to: <strong>Sem 5, Section B</strong></span>
      </div>

      <div className="pscene-notice-chips">
        <span className="pscene-deadline-chip">
          <Clock size={9} aria-hidden="true" />
          <span>14 Dec — detected deadline</span>
          <CheckCircle2 size={9} className="pscene-chip-check" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

/** Support signal card — top layer */
function SupportPanel({ lifted, label }) {
  return (
    <div
      className={`pscene-panel pscene-support ${lifted ? 'is-lifted' : ''}`}
      data-label={label}
    >
      <div className="pscene-panel-eyebrow">
        <TrendingDown size={11} aria-hidden="true" />
        <span>Early signal</span>
      </div>

      <div className="pscene-support-row">
        {/* Attendance ring — SVG, purely decorative */}
        <svg
          viewBox="0 0 44 44"
          className="pscene-ring-svg"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="22" cy="22" r="18" className="pscene-ring-track" />
          <circle
            cx="22"
            cy="22"
            r="18"
            className="pscene-ring-fill"
            strokeDasharray={`${2 * Math.PI * 18 * 0.59} ${2 * Math.PI * 18}`}
            strokeDashoffset={2 * Math.PI * 18 * 0.25}
          />
          <text x="22" y="27" className="pscene-ring-text" textAnchor="middle">59%</text>
        </svg>

        <div className="pscene-support-info">
          <span className="pscene-needs-label">
            <AlertTriangle size={11} aria-hidden="true" />
            Needs support
          </span>
          <p className="pscene-student-name">Student A — CS501</p>
          <p className="pscene-student-meta">3 consecutive absences · Band dropped</p>
        </div>
      </div>
    </div>
  );
}

export default function ProductScene() {
  const sceneRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hoveredLayer, setHoveredLayer] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const el = sceneRef.current;
    if (!el) return;

    const handleMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      setTilt({
        x: -dy * 12,  // max 12 degrees
        y: dx * 12,
      });
    };

    const handleMouseLeave = () => {
      setTilt({ x: 0, y: 0 });
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [reducedMotion]);

  const tiltStyle = reducedMotion
    ? {}
    : {
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.15s ease-out',
      };

  const layers = [
    { id: 'timetable', label: 'Timetable with clash warnings', depth: 0 },
    { id: 'notice', label: 'Targeted notices', depth: 1 },
    { id: 'support', label: 'Early support signals', depth: 2 },
  ];

  return (
    <div
      className={`pscene-root ${reducedMotion ? 'is-reduced-motion' : ''}`}
      aria-hidden="true"
      tabIndex={-1}
      focusable="false"
      ref={sceneRef}
    >
      <div className="pscene-stage" style={tiltStyle}>
        {/* Each layer has its own parallax depth via CSS var */}
        <div
          className={`pscene-layer pscene-layer-0 ${hoveredLayer === layers[0].label ? 'is-hovered' : ''}`}
          style={{ '--depth': reducedMotion ? '0px' : `${tilt.x * 2}px` }}
          onMouseEnter={() => setHoveredLayer(layers[0].label)}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <TimetablePanel
            lifted={hoveredLayer === layers[0].label}
            label={layers[0].label}
          />
        </div>

        <div
          className={`pscene-layer pscene-layer-1 ${hoveredLayer === layers[1].label ? 'is-hovered' : ''}`}
          style={{ '--depth': reducedMotion ? '0px' : `${tilt.x * 1}px` }}
          onMouseEnter={() => setHoveredLayer(layers[1].label)}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <NoticePanel
            lifted={hoveredLayer === layers[1].label}
            label={layers[1].label}
          />
        </div>

        <div
          className={`pscene-layer pscene-layer-2 ${hoveredLayer === layers[2].label ? 'is-hovered' : ''}`}
          style={{ '--depth': reducedMotion ? '0px' : `${tilt.x * -1}px` }}
          onMouseEnter={() => setHoveredLayer(layers[2].label)}
          onMouseLeave={() => setHoveredLayer(null)}
        >
          <SupportPanel
            lifted={hoveredLayer === layers[2].label}
            label={layers[2].label}
          />
        </div>
      </div>

      {/* Subtle ambient shadow beneath the stack */}
      <div className="pscene-ground-shadow" aria-hidden="true" />
    </div>
  );
}
