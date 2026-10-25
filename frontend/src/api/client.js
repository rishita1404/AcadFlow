import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach token from localStorage ─────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('acadflow_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 ────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Clear stale auth and redirect to login
      localStorage.removeItem('acadflow_token');
      localStorage.removeItem('token');
      localStorage.removeItem('acadflow_user');
      localStorage.removeItem('acadflow_permissions');
      localStorage.removeItem('acadflow_active_role');
      delete apiClient.defaults.headers.common['Authorization'];

      const currentPath = window.location.pathname + window.location.search;
      if (!currentPath.startsWith('/login')) {
        window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
