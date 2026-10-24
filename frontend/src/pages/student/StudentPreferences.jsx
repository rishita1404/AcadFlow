import React, { useState } from 'react';

export default function StudentPreferences() {
  const [offsets, setOffsets] = useState({
    offset7d: true,
    offset2d: true,
    offset24h: true,
    overdue: true,
  });

  const [channels, setChannels] = useState({
    inApp: true,
    email: true,
    push: false,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', color: 'var(--text)' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', marginBottom: 20, boxShadow: 'var(--shadow-card)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 4px' }}>
          Notification & Reminder Preferences
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
          Customize how and when you receive proactive assignment and attendance alerts.
        </p>

        <form onSubmit={handleSave}>
          {/* Section 1: Reminder Schedule Offsets */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12 }}>
              ⏰ Deadline Reminder Offsets
            </h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { key: 'offset7d', label: '7 days before due date', desc: 'Early notice to plan research or project outline' },
                { key: 'offset2d', label: '2 days before due date', desc: 'Critical preparation reminder' },
                { key: 'offset24h', label: '24 hours before due date', desc: 'Urgent submission check' },
                { key: 'overdue', label: 'Overdue alert (in grace window)', desc: 'Reminder to submit before hard cutoff closes' },
              ].map(opt => (
                <label key={opt.key} style={toggleRowStyle}>
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--ink-900)' }}>{opt.label}</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={offsets[opt.key]}
                    onChange={e => setOffsets(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Section 2: Channels */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12 }}>
              📡 Delivery Channels
            </h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={toggleRowStyle}>
                <div>
                  <strong style={{ fontSize: 13, color: 'var(--ink-900)' }}>In-App Bell & Dashboard Badges</strong>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Desktop notification banner and sidebar counter</div>
                </div>
                <input
                  type="checkbox"
                  checked={channels.inApp}
                  onChange={e => setChannels(c => ({ ...c, inApp: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
              </label>

              <label style={toggleRowStyle}>
                <div>
                  <strong style={{ fontSize: 13, color: 'var(--ink-900)' }}>Email Digest (Mock Adapter)</strong>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Daily morning digest for critical warnings and deadlines</div>
                </div>
                <input
                  type="checkbox"
                  checked={channels.email}
                  onChange={e => setChannels(c => ({ ...c, email: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
              </label>
            </div>
          </div>

          {/* Section 3: Quiet Hours Policy */}
          <div style={{
            background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--ink-900)', fontSize: 13 }}>
              <span>🌙</span>
              <span>Quiet Hours Protection: 22:00 – 07:00 IST</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              In accordance with academic wellness policy, non-urgent deadline notifications are queued and dispatched at 07:00 IST.
            </p>
          </div>

          {saved && (
            <div style={{ color: 'var(--ok-fg)', background: 'var(--ok-bg)', padding: '8px 14px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700, marginBottom: 14, display: 'inline-block' }}>
              ✓ Preferences updated successfully!
            </div>
          )}

          <div>
            <button
              type="submit"
              style={{
                padding: '10px 24px', background: 'var(--accent)', color: 'var(--on-dark)',
                border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const toggleRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 14px',
  background: 'var(--bg)',
  borderRadius: 'var(--radius-input)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
};
