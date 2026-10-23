import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import BufferGauge from './BufferGauge.jsx';

export default function CourseCard({ course, onClick }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (onClick) {
      onClick(course);
    } else if (course?.course_id || course?.id) {
      navigate(`/student/courses/${course.course_id || course.id}`);
    }
  };

  const pct = course?.attendance_pct ?? course?.attendancePct;
  const pctColor = pct >= 75 ? '#16a34a' : pct >= 65 ? '#d97706' : '#dc2626';

  return (
    <div
      onClick={handleCardClick}
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: '#2563eb',
            background: '#eff6ff', padding: '3px 8px', borderRadius: '4px',
          }}>
            {course?.code || course?.courseCode}
          </span>
          <StatusBadge status={course?.risk_band || course?.status || 'safe'} />
        </div>

        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: '4px 0 8px' }}>
          {course?.name || course?.title}
        </h3>

        {/* Attendance Bar */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#64748b' }}>Attendance</span>
            <span style={{ fontWeight: 700, color: pctColor }}>
              {pct != null ? `${pct}%` : 'N/A'}
            </span>
          </div>
          <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(pct || 0, 100)}%`,
              height: '100%',
              background: pctColor,
              borderRadius: '4px',
              transition: 'width 0.4s',
            }} />
          </div>
        </div>

        {/* Buffer Gauge */}
        <BufferGauge
          bufferClasses={course?.buffer}
          insufficientData={course?.insufficient_data}
        />
      </div>

      {/* ML Chip & Stats Footer */}
      <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#64748b' }}>
          Attended: <strong>{course?.attended ?? 0}</strong>/{course?.held ?? 0}
        </span>
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          padding: '2px 6px',
          borderRadius: '4px',
          color: '#475569',
        }}>
          🤖 Model: Safe (v1)
        </span>
      </div>
    </div>
  );
}
