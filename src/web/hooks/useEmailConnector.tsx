/**
 * Email Connector Hook
 *
 * Provides access to the email connector from React components.
 *
 * E4.S4.1: React Web App Scaffold
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { createEmailConnector, type EmailConnector } from '../../agents/email-connector.js';
import { useAuth } from './useAuth.js';

interface EmailContextValue {
  connector: EmailConnector | null;
  loading: boolean;
  error: string | null;
}

const EmailContext = createContext<EmailContextValue | null>(null);

interface EmailProviderProps {
  children: ReactNode;
}

export function EmailProvider({ children }: EmailProviderProps) {
  const { isAuthenticated, accessToken } = useAuth();
  const [connector, setConnector] = useState<EmailConnector | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setConnector(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Create email connector with the access token
    // In production, this would be configured with proper credentials
    createEmailConnector({
      provider: 'gmail',
      credentials: {
        accessToken,
      },
    })
      .then((conn) => {
        setConnector(conn);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to create email connector:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to email');
        setLoading(false);
      });
  }, [isAuthenticated, accessToken]);

  const value: EmailContextValue = {
    connector,
    loading,
    error,
  };

  return <EmailContext.Provider value={value}>{children}</EmailContext.Provider>;
}

export function useEmailConnector(): EmailContextValue {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmailConnector must be used within an EmailProvider');
  }
  return context;
}
