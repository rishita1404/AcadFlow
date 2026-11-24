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
      {/* Inner wrapper — provides consistent horizontal padding (Fix 1) */}
      <div className="auth-welcome-inner">
        {/* Main heading area */}
        <div className="auth-welcome-heading-block">
          <h1 className="auth-welcome-h1">
            Support <em>every student</em> before it's too late.
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

        {/* Bottom grid rule + metadata pills */}
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
    </div>
  );
}
