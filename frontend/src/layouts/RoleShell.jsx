
import { Outlet } from 'react-router-dom';

export default function RoleShell() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="h-16 border-b bg-white px-6 flex items-center justify-between">
        <div className="font-bold text-xl text-blue-600">AcadFlow</div>
        <div className="flex items-center gap-4 text-sm">
          <span>Unified Academic Platform</span>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
