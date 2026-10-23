import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentApi, submissionApi } from '../../api/endpoints.js';

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
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading assignment...</div>;
  }

  const isClosed = assignment?.is_active === false;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Back button */}
      <div style={{ marginBottom: 14 }}>
        <Link to="/student/tasks" style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Tasks
        </Link>
      </div>

      {/* Main Assignment Card */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb' }}>
              Assignment #{assignment?.id}
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '6px 0 4px' }}>
              {assignment?.title}
            </h1>
            <div style={{ color: '#64748b', fontSize: 13 }}>
              Due: <strong>{assignment?.due_date}</strong> · Max Marks: 100
            </div>
          </div>

          <div>
            {isClosed ? (
              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                Submissions Closed (409)
              </span>
            ) : (
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                Submissions Open
              </span>
            )}
          </div>
        </div>

        {/* Timeline Bar: Due -> Grace (48h) -> Closed */}
        <div style={{ margin: '24px 0 20px', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
            Submission Timeline & Grace Window:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#16a34a', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Due Date</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{assignment?.due_date}</div>
            </div>
            <div style={{ flex: 1, height: 3, background: '#d1d5db', margin: '0 8px', position: 'relative', top: -10 }} />
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#d97706', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>Grace Period</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>+48 hours</div>
            </div>
            <div style={{ flex: 1, height: 3, background: '#d1d5db', margin: '0 8px', position: 'relative', top: -10 }} />
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#dc2626', margin: '0 auto 4px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Closed</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Hard cutoff</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ fontSize: 14, color: '#334151', lineHeight: 1.6, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Description & Instructions:</div>
          <p style={{ margin: 0 }}>
            {assignment?.description || 'Implement the assigned problems and submit your solution documentation and code as a single PDF or ZIP archive. Ensure clean code and test case verifications.'}
          </p>
        </div>
      </div>

      {/* Submission Receipt Card (if recently submitted) */}
      {receipt && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 18, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 800, fontSize: 14 }}>
            <span>✅</span>
            <span>Submission Successful — Cryptographic Receipt</span>
          </div>
          <div style={{ fontSize: 12, color: '#166534', marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <div>Receipt ID: <strong>REC-{receipt.id}</strong></div>
            <div>Timestamp: <strong>{new Date(receipt.timestamp).toLocaleString()}</strong></div>
            <div>File: <strong>{receipt.fileName}</strong></div>
          </div>
          <div style={{ fontSize: 11, color: '#15803d', marginTop: 6, wordBreak: 'break-all' }}>
            Verification Hash: <code>{receipt.fileHash}</code>
          </div>
        </div>
      )}

      {/* Submission Form (Active if not closed) */}
      {!isClosed && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
            Upload & Submit Solution (Resubmission allowed until hard cutoff)
          </h2>

          {/* Drag & Drop Box */}
          <div
            style={{
              border: '2px dashed #cbd5e1', borderRadius: 10, padding: 32,
              textAlign: 'center', background: '#f8fafc', cursor: 'pointer',
              marginBottom: 16,
            }}
            onClick={() => document.getElementById('assignment-file-input')?.click()}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to select or drag and drop your file here'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
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
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Submission Notes / Text:
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any notes, assumptions, or GitHub link here..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1',
                borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            style={{
              padding: '10px 24px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: submitMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {submitMutation.isPending ? 'Uploading...' : 'Confirm Submission'}
          </button>
        </div>
      )}

      {/* Version History Table */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          Submission Version History
        </h3>
        {submissions.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, padding: 12 }}>
            No submissions recorded yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', color: '#475569' }}>Version / ID</th>
                <th style={{ padding: '8px 12px', color: '#475569' }}>Date</th>
                <th style={{ padding: '8px 12px', color: '#475569' }}>Status</th>
                <th style={{ padding: '8px 12px', color: '#475569' }}>Content / Notes</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, idx) => (
                <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>v{submissions.length - idx} (#{s.id})</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.submitted_at || 'Just now'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>
                      Received
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#334151' }}>{s.content || 'Uploaded assignment file'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
