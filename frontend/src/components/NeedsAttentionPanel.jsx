import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facultyApi } from '../api/endpoints.js';
import InterventionModal from './InterventionModal.jsx';
import {
  AlertTriangle,
  TrendingDown,
  CalendarX,
  CheckCircle2,
  MessageSquare,
  UserCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function NeedsAttentionPanel({ courseId = null }) {
  const [selectedStudentForAction, setSelectedStudentForAction] = useState(null);
  const [filterCourse, setFilterCourse] = useState('all');

  const {
    data: attentionList = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['faculty-needs-attention', courseId],
    queryFn: () =>
      facultyApi.getNeedsAttention(courseId).then((r) => r.data || []),
  });

  const uniqueCourses = Array.from(
    new Set(attentionList.map((item) => item.course_code))
  );

  const filteredList = attentionList.filter((item) => {
    if (filterCourse === 'all') return true;
    return item.course_code === filterCourse;
  });

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-6)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-pill)',
                background: attentionList.length > 0 ? 'var(--warn-bg)' : 'var(--ok-bg)',
                color: attentionList.length > 0 ? 'var(--warn-fg)' : 'var(--ok-fg)',
              }}
            >
              {attentionList.length > 0 ? (
                <AlertTriangle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
            </span>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--ink-900)',
                margin: 0,
              }}
            >
              Needs Attention This Week
            </h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 12,
                fontWeight: 700,
                background: attentionList.length > 0 ? 'var(--warn-bg)' : 'var(--ok-bg)',
                color: attentionList.length > 0 ? 'var(--warn-fg)' : 'var(--ok-fg)',
              }}
            >
              {`${attentionList.length} student${attentionList.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              margin: '4px 0 0 36px',
            }}
          >
            Students who missed 2+ consecutive classes or dropped a risk band since last week.
          </p>
        </div>

        {/* Course Filter Dropdown if multiple courses */}
        {uniqueCourses.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--ink-900)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Courses ({attentionList.length})</option>
              {uniqueCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Checking recent attendance patterns and risk changes...
        </div>
      ) : filteredList.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-input)',
            border: '1px dashed var(--border)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--ok-bg)',
              color: 'var(--ok-fg)',
              marginBottom: 8,
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
            All students are on track this week
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            No consecutive absences or risk band drops detected across your enrolled roster.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredList.map((item) => {
            const isCritical =
              item.current_band_label === 'Needs support' ||
              item.current_band?.toLowerCase() === 'critical';

            return (
              <div
                key={`${item.student_id}-${item.course_id}`}
                style={{
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-card)',
                  padding: '14px 16px',
                  border: `1px solid ${isCritical ? 'var(--crit-fg)' : 'var(--border)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Top row: Student & Course info + Band Badge */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--ink-900)',
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                      }}
                    >
                      ({item.roll_no})
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--accent)',
                      }}
                    >
                      {item.course_code}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 11,
                        fontWeight: 700,
                        background: isCritical ? 'var(--crit-bg)' : 'var(--warn-bg)',
                        color: isCritical ? 'var(--crit-fg)' : 'var(--warn-fg)',
                        border: `1px solid ${isCritical ? 'var(--crit-fg)' : 'var(--warn-fg)'}`,
                      }}
                    >
                      {isCritical ? <AlertTriangle size={12} /> : <TrendingDown size={12} />}
                      {item.current_band_label}
                    </span>
                  </div>
                </div>

                {/* What changed callout */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-input)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    color: 'var(--ink-900)',
                  }}
                >
                  <span
                    style={{
                      color: isCritical ? 'var(--crit-fg)' : 'var(--warn-fg)',
                      display: 'inline-flex',
                    }}
                  >
                    {item.reasons.includes('consecutive_absences') ? (
                      <CalendarX size={15} />
                    ) : (
                      <TrendingDown size={15} />
                    )}
                  </span>
                  <div>
                    <strong style={{ fontWeight: 600 }}>What changed: </strong>
                    <span>{item.what_changed}</span>
                  </div>
                </div>

                {/* Bottom row: Suggested next step + Action Button */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    paddingTop: 2,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <MessageSquare size={13} style={{ color: 'var(--accent)' }} />
                    <span>
                      <strong>Suggested next step:</strong> {item.suggested_next_step}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedStudentForAction(item)}
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--on-dark)',
                      border: 'none',
                      padding: '5px 14px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <UserCheck size={13} />
                    Log action
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Action Modal */}
      {selectedStudentForAction && (
        <InterventionModal
          isOpen={true}
          onClose={() => setSelectedStudentForAction(null)}
          studentId={selectedStudentForAction.student_id}
          studentName={selectedStudentForAction.name}
          courseId={selectedStudentForAction.course_id}
          courseName={selectedStudentForAction.course_name}
          onSuccess={() => {
            setSelectedStudentForAction(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
