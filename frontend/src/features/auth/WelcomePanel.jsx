import { useMemo } from 'react';
import { Calendar, ShieldCheck, Clock, Bell, AlertTriangle } from 'lucide-react';
import DeskIllustration from './DeskIllustration.jsx';

const FEATURE_CHIPS = [
  { label: 'Attendance buffer', icon: ShieldCheck },
  { label: 'Deadline radar', icon: Clock },
  { label: 'Early-warning risk', icon: AlertTriangle },
  { label: 'Notices & timetable', icon: Bell },
];

export default function WelcomePanel() {
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

  return (
    <div className="auth-welcome-col">
      <div className="auth-welcome-panel">
        <div>
          <div className="auth-date-badge">
            <Calendar size={14} aria-hidden="true" />
            <span>{formattedDate}</span>
          </div>

          <h1 className="auth-headline">
            Know where you stand, before it&apos;s too late.
          </h1>

          <p className="auth-supporting">
            Attendance buffers, deadline radar and gentle early-warning signals, all in one calm place.
          </p>
        </div>

        <DeskIllustration />

        <div className="auth-chips-row" aria-label="Key platform features">
          {FEATURE_CHIPS.map(({ label, icon: Icon }) => (
            <span key={label} className="auth-chip">
              <Icon size={13} aria-hidden="true" />
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
