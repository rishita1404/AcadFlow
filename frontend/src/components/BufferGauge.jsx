import React from 'react';

export default function BufferGauge({ bufferClasses }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-slate-50">
      <span className="text-3xl font-bold text-blue-600">{bufferClasses}</span>
      <span className="text-xs text-slate-500 mt-1">Classes you can miss without shortfall</span>
    </div>
  );
}
