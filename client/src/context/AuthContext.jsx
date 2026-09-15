import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('crm_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const timerRef = useRef(null);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (localStorage.getItem('crm_token')) {
        logout();
        window.location.href = '/login';
      }
    }, INACTIVITY_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, resetTimer]);

  // Token refresh automático
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (data.token) {
          localStorage.setItem('crm_token', data.token);
        }
      } catch (e) {
        logout();
        window.location.href = '/login';
      }
    }, 3 * 60 * 60 * 1000); // Refresh cada 3 horas

    return () => clearInterval(interval);
  }, [user, logout]);

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
