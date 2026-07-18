/**
 * Auth against the AURA backend.
 *
 * Replaces the previous Supabase provider. Two things changed beyond the
 * provider swap:
 *
 * 1. Role is no longer derived from the email address. The old version made
 *    anyone whose email began with "admin" an administrator, which is a naming
 *    convention, not an access check. Role must come from the server, which is
 *    the only party that can assert it.
 *
 * 2. The session is a backend token, so every request carries an identity the
 *    API actually verifies.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, get, getToken, signInDev } from '../lib/api';

type Role = 'patient' | 'doctor' | 'admin';

interface BackendUser {
  id: number;
  email: string;
}

interface Auth {
  user: BackendUser | null;
  loading: boolean;
  role: Role;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string;
}

const C = createContext<Auth>({
  user: null,
  loading: true,
  role: 'patient',
  signIn: async () => {},
  signOut: async () => {},
  error: '',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Restore the session by asking the backend who the stored token belongs to.
  // A token that no longer verifies is discarded rather than trusted.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    get<BackendUser>('/api/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string) => {
    setError('');
    signInDev(email);
    try {
      setUser(await get<BackendUser>('/api/me'));
    } catch (e) {
      clearToken();
      const message = e instanceof Error ? e.message : 'Sign in failed';
      setError(message);
      throw e;
    }
  };

  const signOut = async () => {
    clearToken();
    setUser(null);
  };

  return (
    <C.Provider value={{ user, loading, role: 'patient', signIn, signOut, error }}>
      {children}
    </C.Provider>
  );
}

export const useAuth = () => useContext(C);
