/**
 * Authentication Hook
 *
 * Manages OAuth authentication for the web dashboard.
 *
 * E4.S4.2: OAuth Web Flow
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  user: {
    email: string;
    name?: string;
    picture?: string;
  } | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'intentmail_auth';
const CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
const REDIRECT_URI = import.meta.env?.VITE_OAUTH_REDIRECT_URI || window.location.origin + '/auth/callback';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    loading: true,
    user: null,
    accessToken: null,
  });

  // Check for existing auth on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.accessToken && parsed.expiresAt > Date.now()) {
          setState({
            isAuthenticated: true,
            loading: false,
            user: parsed.user,
            accessToken: parsed.accessToken,
          });
          return;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setState((prev) => ({ ...prev, loading: false }));
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

      if (accessToken) {
        // Fetch user info
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((res) => res.json())
          .then((userInfo) => {
            const authData = {
              accessToken,
              expiresAt: Date.now() + expiresIn * 1000,
              user: {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
              },
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
            setState({
              isAuthenticated: true,
              loading: false,
              user: authData.user,
              accessToken,
            });
            // Clear hash from URL
            window.history.replaceState(null, '', window.location.pathname);
          })
          .catch((err) => {
            console.error('Failed to fetch user info:', err);
            setState((prev) => ({ ...prev, loading: false }));
          });
      }
    }
  }, []);

  const login = useCallback(() => {
    const scope = encodeURIComponent([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' '));

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('include_granted_scopes', 'true');

    window.location.href = authUrl.toString();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      isAuthenticated: false,
      loading: false,
      user: null,
      accessToken: null,
    });
  }, []);

  const refreshToken = useCallback(async () => {
    // For implicit flow, we need to re-authenticate
    // In production, use authorization code flow with refresh tokens
    login();
  }, [login]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
