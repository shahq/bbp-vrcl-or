/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { checkAdminSession, logoutAdminSession } from '../services/adminAuth';

interface AuthContextType {
  adminSessionId: string | null;
  isAdminVerified: boolean;
  isCheckingAuth: boolean;
  login: (sessionId: string) => void;
  logout: () => Promise<void>;
  verifyAdminSession: (sessionIdToVerify?: string | null) => Promise<boolean>;
  handleExpiredAdminSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [adminSessionId, setAdminSessionId] = useState<string | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const clearAdminSession = useCallback(() => {
    localStorage.removeItem('adminSessionId');
    setAdminSessionId(null);
    setIsAdminVerified(false);
  }, []);

  const verifyAdminSession = useCallback(async (sessionIdToVerify?: string | null) => {
    const storedSessionId = sessionIdToVerify ?? localStorage.getItem('adminSessionId');

    if (!storedSessionId) {
      clearAdminSession();
      return false;
    }

    try {
      const isAuthenticated = await checkAdminSession(storedSessionId);
      if (!isAuthenticated) {
        clearAdminSession();
        return false;
      }

      setAdminSessionId(storedSessionId);
      setIsAdminVerified(true);
      return true;
    } catch (error) {
      console.error('[Auth] Error verifying admin session:', error);
      clearAdminSession();
      return false;
    }
  }, [clearAdminSession]);

  const handleExpiredAdminSession = useCallback(async () => {
    clearAdminSession();
    navigate('/login', {
      replace: true,
      state: { reason: 'expired' }
    });
  }, [clearAdminSession, navigate]);

  const login = useCallback((sessionId: string) => {
    setAdminSessionId(sessionId);
    setIsAdminVerified(true);
  }, []);

  const logout = useCallback(async () => {
    if (adminSessionId) {
      try {
        await logoutAdminSession(adminSessionId);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    clearAdminSession();
  }, [adminSessionId, clearAdminSession]);

  // Verify admin session on mount
  useEffect(() => {
    let cancelled = false;

    const runInitialAuthCheck = async () => {
      await verifyAdminSession();
      if (!cancelled) {
        setIsCheckingAuth(false);
      }
    };

    runInitialAuthCheck();

    return () => {
      cancelled = true;
    };
  }, [verifyAdminSession]);

  // Re-verify whenever the app regains focus
  useEffect(() => {
    if (isCheckingAuth || !adminSessionId || !isAdminVerified) {
      return;
    }

    const recheckAuth = async () => {
      const isStillValid = await verifyAdminSession(adminSessionId);
      if (!isStillValid) {
        navigate('/login', {
          replace: true,
          state: { reason: 'expired' }
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void recheckAuth();
      }
    };

    void recheckAuth();
    window.addEventListener('focus', recheckAuth);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', recheckAuth);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [adminSessionId, isAdminVerified, isCheckingAuth, location.pathname, navigate, verifyAdminSession]);

  const value: AuthContextType = {
    adminSessionId,
    isAdminVerified,
    isCheckingAuth,
    login,
    logout,
    verifyAdminSession,
    handleExpiredAdminSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
