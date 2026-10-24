import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi } from '../api/endpoints.js';
import apiClient from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('acadflow_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('acadflow_token') || null);
  const [permissions, setPermissions] = useState(() => {
    try {
      const stored = localStorage.getItem('acadflow_permissions');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [activeRole, setActiveRole] = useState(() => {
    return localStorage.getItem('acadflow_active_role') || null;
  });

  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    const { access_token } = res.data;
    localStorage.setItem('acadflow_token', access_token);
    localStorage.setItem('token', access_token);
    setToken(access_token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

    try {
      // 1. Fetch user profile
      const meRes = await authApi.me();
      const userData = meRes.data;
      localStorage.setItem('acadflow_user', JSON.stringify(userData));
      setUser(userData);

      // 2. Fetch permissions (duties and allowed roles)
      let permsData = {
        primary_role: userData.role,
        duties: [userData.role],
        allowed_roles: [userData.role],
        department_id: userData.department_id,
      };
      try {
        const permRes = await apiClient.get('/me/permissions');
        permsData = permRes.data;
      } catch (e) {
        console.warn('Failed to load permissions, falling back to role:', e);
      }
      localStorage.setItem('acadflow_permissions', JSON.stringify(permsData));
      setPermissions(permsData);

      const defaultRole = permsData.primary_role || userData.role;
      localStorage.setItem('acadflow_active_role', defaultRole);
      setActiveRole(defaultRole);

      return { user: userData, permissions: permsData, role: defaultRole };
    } catch (err) {
      console.error('Error post-login initialization:', err);
      return null;
    }
  }, []);

  const switchRole = useCallback((newRole) => {
    localStorage.setItem('acadflow_active_role', newRole);
    setActiveRole(newRole);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('acadflow_token');
    localStorage.removeItem('token');
    localStorage.removeItem('acadflow_user');
    localStorage.removeItem('acadflow_permissions');
    localStorage.removeItem('acadflow_active_role');
    delete apiClient.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setPermissions(null);
    setActiveRole(null);
  }, []);

  const currentRole = activeRole || permissions?.primary_role || user?.role || 'student';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        activeRole: currentRole,
        switchRole,
        login,
        logout,
        isLoggedIn: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
