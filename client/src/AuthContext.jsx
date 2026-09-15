import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

export function needsVerification(user) {
  if (!user) return false;
  return user.emailVerified === false || user.emailVerified === 0 || user.emailVerified === 'false';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { setReady(true); return; }
    api('/api/auth/me', { auth: true })
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    async login(email, password) {
      const d = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      setToken(d.token);
      setUser(d.user);
      return d.user;
    },
    async register(payload) {
      return api('/api/auth/register', { method: 'POST', body: payload });
    },
    async verifyEmail(token) {
      const d = await api('/api/auth/verify?token=' + encodeURIComponent(token));
      if (d.token) setToken(d.token);
      if (d.user) setUser(d.user);
      return d;
    },
    async resendVerify(email) {
      return api('/api/auth/resend-verify', { method: 'POST', body: { email } });
    },
    async refreshUser() {
      const d = await api('/api/auth/me', { auth: true });
      setUser(d.user);
      return d.user;
    },
    logout() {
      setToken(null);
      setUser(null);
    }
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
