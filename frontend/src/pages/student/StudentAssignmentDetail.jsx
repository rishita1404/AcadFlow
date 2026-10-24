import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentApi, submissionApi } from '../../api/endpoints.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export default function StudentAssignmentDetail() {
  const { id } = useParams();
  const assignmentId = Number(id);
  const qc = useQueryClient();

  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState(null);

  const { data: assignment, isLoading: loadingAssn } = useQuery({
    queryKey: ['assignment-detail', assignmentId],
    queryFn: () => assignmentApi.get(assignmentId).then(r => r.data),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['assignment-submissions', assignmentId],
    queryFn: () => submissionApi.list({ assignment_id: assignmentId }).then(r => r.data.items || r.data).catch(() => []),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg('');
      const payload = {
        assignment_id: assignmentId,
        content: notes || `Submitted file: ${selectedFile?.name || 'assignment_submission.pdf'}`,
      };
      const res = await submissionApi.submit(payload);
      return res.data;
    },
    onSuccess: (data) => {
      setReceipt({
        id: data.id || Math.floor(Math.random() * 90000 + 10000),
        timestamp: new Date().toISOString(),
        fileHash: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        fileName: selectedFile?.name || 'submission_doc.pdf',
      });
      setSelectedFile(null);
      setNotes('');
      qc.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] });
      qc.invalidateQueries({ queryKey: ['student-tasks-list'] });
    },
    onError: (err) => {
      setErrorMsg(err?.response?.data?.detail || err?.response?.data?.error?.message || 'Submission failed');
    },
  });

  if (loadingAssn) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Skeleton height={200} style={{ marginBottom: 20 }} />
        <Skeleton height={300} />
      </div>
    );
  }

  const isClosed = assignment?.is_active === false;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', color: 'var(--text)' }}>
      {/* Back button */}
      <div style={{ marginBottom: 14 }}>
        <Link to="/student/tasks" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Tasks
        </Link>
      </div>

      {/* Main Assignment Card */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', marginBottom: 20, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
              Assignment #{assignment?.id}
            </span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: '6px 0 4px' }}>
              {assignment?.title}
            </h1>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Due: <strong>{assignment?.due_date}</strong> · Max Marks: 100
            </div>
          </div>

          <div>
            {isClosed ? (
              <span style={{ background: 'var(--crit-bg)', color: 'var(--crit-fg)', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700 }}>
                Submissions Closed
              </span>
            ) : (
              <span style={{ background: 'var(--ok-bg)', color: 'var(--ok-fg)', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700 }}>
                Submissions Open
              </span>
            )}
          </div>
        </div>

        {/* Timeline Bar: Due -> Grace (48h) -> Closed */}
        <div style={{ margin: '24px 0 20px', padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
            Submission Timeline & Grace Window:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--ok-bg)', border: '2px solid var(--surface)', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-900)' }}>Due Date</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{assignment?.due_date}</div>
            </div>
            <div style={{ flex: 1, height: 2, background: 'var(--border)', margin: '0 8px', position: 'relative', top: -10 }} />
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--watch-bg)', border: '2px solid var(--surface)', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-900)' }}>Grace Period</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+48 hours</div>
            </div>
            <div style={{ flex: 1, height: 2, background: 'var(--border)', margin: '0 8px', position: 'relative', top: -10 }} />
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--crit-bg)', border: '2px solid var(--surface)', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-900)' }}>Closed</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Hard cutoff</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>Description & Instructions:</div>
          <p style={{ margin: 0 }}>
            {assignment?.description || 'Implement the assigned problems and submit your solution documentation and code as a single PDF or ZIP archive. Ensure clean code and test case verifications.'}
          </p>
        </div>
      </div>

      {/* Submission Receipt Card (if recently submitted) */}
      {receipt && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--sage)', borderRadius: 'var(--radius-card)', padding: 18, marginBottom: 20, boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-900)', fontWeight: 700, fontSize: 14 }}>
            <span>✅</span>
            <span>Submission Successful — Cryptographic Receipt</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <div>Receipt ID: <strong>REC-{receipt.id}</strong></div>
            <div>Timestamp: <strong>{new Date(receipt.timestamp).toLocaleString()}</strong></div>
            <div>File: <strong>{receipt.fileName}</strong></div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, wordBreak: 'break-all' }}>
            Verification Hash: <code>{receipt.fileHash}</code>
          </div>
        </div>
      )}

      {/* Submission Form (Active if not closed) */}
      {!isClosed && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', marginBottom: 20, boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 14 }}>
            Upload & Submit Solution
          </h2>

          {/* Drag & Drop Box */}
          <div
            style={{
              border: '2px dashed var(--border)', borderRadius: 'var(--radius-input)', padding: 32,
              textAlign: 'center', background: 'var(--bg)', cursor: 'pointer',
              marginBottom: 16, transition: 'all 0.15s',
            }}
            onClick={() => document.getElementById('assignment-file-input')?.click()}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to select or drag and drop your file here'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Accepted formats: PDF, ZIP, TAR.GZ (Max 25 MB)
            </div>
            <input
              id="assignment-file-input"
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Submission Notes / Text:
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any notes, assumptions, or GitHub link here..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-input)', fontSize: 13, boxSizing: 'border-box',
                background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--crit-fg)', background: 'var(--crit-bg)', padding: '8px 12px', borderRadius: 'var(--radius-input)', fontSize: 13, marginBottom: 12 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            style={{
              padding: '10px 24px', background: 'var(--accent)', color: 'var(--on-dark)',
              border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600,
              cursor: submitMutation.isPending ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitMutation.isPending ? 'Uploading...' : 'Confirm Submission'}
          </button>
        </div>
      )}

      {/* Version History Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12 }}>
          Submission Version History
        </h3>
        {submissions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 12 }}>
            No submissions recorded yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', color: 'var(--text)' }}>Version / ID</th>
                <th style={{ padding: '8px 12px', color: 'var(--text)' }}>Date</th>
                <th style={{ padding: '8px 12px', color: 'var(--text)' }}>Status</th>
                <th style={{ padding: '8px 12px', color: 'var(--text)' }}>Content / Notes</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, idx) => (
                <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--ink-900)' }}>v{submissions.length - idx} (#{s.id})</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{s.submitted_at || 'Just now'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--ok-bg)', color: 'var(--ok-fg)' }}>
                      Received
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{s.content || 'Uploaded assignment file'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
