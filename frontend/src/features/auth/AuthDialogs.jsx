import Dialog from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';

export default function AuthDialogs({ activeDialog, onClose }) {
  return (
    <>
      {/* Forgot Password Dialog */}
      <Dialog
        open={activeDialog === 'forgot'}
        onClose={onClose}
        title="Reset Password"
        width={440}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Got it
          </Button>
        }
      >
        <p style={{ color: 'var(--text)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          Please contact your course coordinator or administrator to reset your password.
        </p>
      </Dialog>

      {/* Help Dialog */}
      <Dialog
        open={activeDialog === 'help'}
        onClose={onClose}
        title="Need Help?"
        width={460}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <p style={{ color: 'var(--text)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          If you are experiencing issues signing in or need assistance with your AcadFlow account, please reach out to your course coordinator or department administrator.
        </p>
      </Dialog>

      {/* Privacy Dialog */}
      <Dialog
        open={activeDialog === 'privacy'}
        onClose={onClose}
        title="Privacy & Data Protection"
        width={480}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <p style={{ color: 'var(--text)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          AcadFlow stores only essential academic records (attendance logs, assignment checkpoints, and timetable schedules) strictly within your institution. Your academic health metrics are visible only to you, your designated faculty, mentors, and academic administrators.
        </p>
      </Dialog>
    </>
  );
}
