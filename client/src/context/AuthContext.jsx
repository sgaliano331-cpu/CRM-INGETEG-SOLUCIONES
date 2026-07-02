import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('crm_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
  }, []);

  const isCoordinador = user?.rol === 'COORDINADOR';
  const isAsesora = user?.rol === 'ASESORA';
  const isGestor = user?.rol === 'GESTOR';

  return (
    <AuthContext.Provider value={{ user, login, logout, isCoordinador, isAsesora, isGestor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
