import React from 'react';

export default function CourseCard({ courseCode, title, facultyName, attendancePct }) {
  return (
    <div className="rounded-xl border border-slate-200 p-5 shadow-sm bg-white">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{courseCode}</span>
        <span className="text-sm font-medium">{attendancePct}% Attendance</span>
      </div>
      <h3 className="font-semibold text-slate-900 text-lg">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">Faculty: {facultyName}</p>
    </div>
  );
}
