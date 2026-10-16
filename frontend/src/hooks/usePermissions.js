export function usePermissions() {
  const currentRole = localStorage.getItem('role') || 'student';
  const hasRole = (role) => currentRole === role || currentRole === 'admin';
  return { currentRole, hasRole };
}
