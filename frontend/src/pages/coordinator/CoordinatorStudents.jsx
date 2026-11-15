import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { coordinatorApi } from '../../api/endpoints.js';
import { formatPct } from '../../utils/format.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export default function CoordinatorStudents() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced filter parameters
  const queryParam = searchParams.get('q') || '';
  const bandParam = searchParams.get('band') || 'all';
  const sortParam = searchParams.get('sort') || 'roll_no';
  const orderParam = searchParams.get('order') || 'asc';

  const [searchInput, setSearchInput] = useState(queryParam);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Debounce search query input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (searchInput.trim()) {
          next.set('q', searchInput.trim());
        } else {
          next.delete('q');
        }
        return next;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, setSearchParams]);

  // Sync internal state when external URL params change
  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  // Fetch directory with server-side filtering, sorting and limit for virtualization
  const { data: students = [], isLoading, isPlaceholderData } = useQuery({
    queryKey: ['coordinator-students-list', queryParam, bandParam, sortParam, orderParam],
    queryFn: () =>
      coordinatorApi.getStudents({
        limit: 5000,
        q: queryParam || undefined,
        band: bandParam !== 'all' ? bandParam : undefined,
        sort: sortParam,
        order: orderParam,
      }).then(r => r.data || []),
    placeholderData: keepPreviousData,
  });

  // Fetch individual student profile with audit logging
  const { data: studentDetail, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ['coordinator-student-profile', selectedStudentId],
    queryFn: () => coordinatorApi.getStudentDetail(selectedStudentId).then(r => r.data),
    enabled: !!selectedStudentId,
    retry: false,
  });

  const parentRef = useRef(null);

  const filtered = useMemo(() => {
    return students.filter(s => {
      if (bandParam !== 'all') {
        const b = (s.risk_level || '').toLowerCase().replace('-', ' ').replace('_', ' ');
        const target = bandParam.toLowerCase().replace('-', ' ').replace('_', ' ');
        if (b !== target) return false;
      }
      return true;
    });
  }, [students, bandParam]);

  // TanStack Virtualizer setup for smooth scrolling over 3,000+ items
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  const handleBandFilterChange = (newBand) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newBand === 'all') {
        next.delete('band');
      } else {
        next.set('band', newBand);
      }
      return next;
    });
  };

  const handleSortChange = (field) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (sortParam === field) {
        next.set('order', orderParam === 'asc' ? 'desc' : 'asc');
      } else {
        next.set('sort', field);
        next.set('order', 'asc');
      }
      return next;
    });
  };

  if (isLoading && !isPlaceholderData) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={60} style={{ marginBottom: 20 }} />
        <Skeleton height={400} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Students Directory
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
          Department Students Directory
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Virtualized high-performance table (@tanstack/react-virtual) · Server-side pagination & URL-synced search · Access is audited.
        </p>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '14px 20px', border: '1px solid var(--border)',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: 'var(--shadow-card)',
      }}>
        <input
          type="text"
          placeholder="Search by student name, roll number, or email..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, flex: 1, minWidth: 260 }}
        />

        {/* Risk Band Quick-Filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['all', 'safe', 'watch', 'at-risk', 'critical'].map(b => (
            <button
              key={b}
              onClick={() => handleBandFilterChange(b)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                border: bandParam === b ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: bandParam === b ? 'var(--accent)' : 'var(--bg)',
                color: bandParam === b ? 'var(--on-dark, #fff)' : 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {b === 'all' ? 'All Bands' : b.replace('-', ' ')}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {filtered.length} matching students
        </span>
      </div>

      {/* Virtualized Students Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        {/* Table Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.2fr 2.5fr 1.3fr 1.5fr 1.2fr', padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
          <div onClick={() => handleSortChange('roll_no')} style={{ cursor: 'pointer', userSelect: 'none' }}>
            Roll No {sortParam === 'roll_no' && (orderParam === 'asc' ? '↑' : '↓')}
          </div>
          <div onClick={() => handleSortChange('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
            Name {sortParam === 'name' && (orderParam === 'asc' ? '↑' : '↓')}
          </div>
          <div>Batch</div>
          <div>Email</div>
          <div>Attendance %</div>
          <div>Risk Status</div>
          <div>Action</div>
        </div>

        {/* Virtualized Viewport Container */}
        <div
          ref={parentRef}
          style={{
            height: '520px',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No students found matching current filters.
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const s = filtered[virtualRow.index];
                return (
                  <div
                    key={s.student_id}
                    onClick={() => setSelectedStudentId(s.student_id)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 2fr 1.2fr 2.5fr 1.3fr 1.5fr 1.2fr',
                      alignItems: 'center',
                      padding: '0 16px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                      cursor: 'pointer',
                      background: selectedStudentId === s.student_id ? 'var(--bg)' : 'transparent',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>
                      {s.roll_no || `S-${s.student_id}`}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {s.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {s.batch || '2023-2027'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.email}
                    </div>
                    <div style={{ fontWeight: 700, color: s.attendance_percentage != null && s.attendance_percentage >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>
                      {formatPct(s.attendance_percentage)}
                    </div>
                    <div>
                      <StatusBadge band={s.risk_level || 'Safe'} size="sm" />
                    </div>
                    <div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedStudentId(s.student_id); }}
                        style={{
                          background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)',
                          padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Profile →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Audited Profile Drawer */}
      {selectedStudentId && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
          background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          {/* Drawer Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>
                {studentDetail?.name || 'Student Profile'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Roll No: {studentDetail?.roll_no || selectedStudentId}
              </div>
            </div>
            <button
              onClick={() => setSelectedStudentId(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>

          {/* Mandatory Audit Notice Banner */}
          <div style={{
            background: 'var(--watch-bg)', borderBottom: '1px solid var(--border)', padding: '10px 18px',
            fontSize: 12, color: 'var(--watch-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>🔒</span>
            <span>This view is recorded in the audit log (Actor ID, timestamp, and target student ID recorded).</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {detailLoading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading student record...</div>
            ) : detailError ? (
              <div style={{ color: 'var(--crit-fg)', background: 'var(--crit-bg)', padding: 16, borderRadius: 'var(--radius-input)', textAlign: 'center' }}>
                {detailError.response?.status === 403 ? 'Access Denied: Student belongs to another department.' : 'Failed to load details.'}
              </div>
            ) : (
              <div>
                <div style={{
                  background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: 16, border: '1px solid var(--border)',
                  marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Attendance</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)' }}>
                      {formatPct(studentDetail?.attendance_percentage)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Buffer</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: studentDetail?.buffer_classes != null && studentDetail.buffer_classes < 0 ? 'var(--crit-fg)' : 'var(--ok-fg)' }}>
                      {studentDetail?.buffer_classes != null ? `${studentDetail.buffer_classes > 0 ? '+' : ''}${studentDetail.buffer_classes} classes` : 'No data'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Risk Band</div>
                    <div style={{ marginTop: 2 }}>
                      <StatusBadge band={studentDetail?.risk_level || 'Safe'} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Enrolled Courses</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)' }}>
                      {studentDetail?.enrolled_courses ?? 0} Courses
                    </div>
                  </div>
                </div>

                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>Approved Directory Fields</h4>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: 12, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{studentDetail?.email}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Batch:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{studentDetail?.batch || '2023-2027'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>Dept #{studentDetail?.department_id}</span>
                  </div>
                </div>

                <div style={{ marginTop: 20, background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: 12, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  🔒 Ethical Privacy Guard: Submissions, personal files, and credentials are intentionally excluded from coordinator directories.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
