/**
 * WelcomePanel — left column of the redesigned login page.
 * 60% width on desktop. Contains the 3D product scene and
 * typographic context. The scene is lazy-loaded so the form
 * is never blocked by scene initialisation.
 */
import { lazy, Suspense } from 'react';

const ProductScene = lazy(() => import('./ProductScene.jsx'));

export default function WelcomePanel() {
  return (
    <div className="auth-welcome-col" aria-hidden="true" tabIndex={-1}>
      {/* Top metadata bar */}
      <div className="auth-welcome-eyebrow">
        <span className="auth-eyebrow-mono">AcadFlow</span>
        <span className="auth-eyebrow-sep" aria-hidden="true">·</span>
        <span className="auth-eyebrow-mono">Academic management</span>
        <span className="auth-eyebrow-status">
          <span className="auth-status-dot" aria-hidden="true" />
          Live
        </span>
      </div>

      {/* Main heading area */}
      <div className="auth-welcome-heading-block">
        <h1 className="auth-welcome-h1">
          Know where
          <br />
          <em>every student</em>
          <br />
          stands.
        </h1>
        <p className="auth-welcome-subline">
          Attendance, support signals, targeted notices and timetable — for your department.
        </p>
      </div>

      {/* 3D product scene — lazy, decorative, aria-hidden */}
      <div className="auth-scene-wrap">
        <Suspense fallback={<div className="auth-scene-placeholder" />}>
          <ProductScene />
        </Suspense>
      </div>

      {/* Bottom grid rule + metadata */}
      <div className="auth-welcome-footer-meta">
        <div className="auth-thin-rule" />
        <div className="auth-meta-row">
          <span className="auth-meta-pill">Notices</span>
          <span className="auth-meta-pill">Timetable</span>
          <span className="auth-meta-pill">Attendance buffer</span>
          <span className="auth-meta-pill">Early warnings</span>
        </div>
      </div>
    </div>
  );
}
