import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PlayerProgress } from '@/types/game';
import {
  getAccountSession,
  getAuthConfig,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveAccountProgress,
  type AccountSession,
  type AuthConfig,
  type LoginPayload,
  type RegisterPayload,
} from './accountApi';

export type AuthStatus = 'loading' | 'guest' | 'authenticated';
export type AccountSyncState = 'idle' | 'saving' | 'saved' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  session: AccountSession | null;
  config: AuthConfig | null;
  startupError: string;
  syncState: AccountSyncState;
  lastSyncedAt: number | null;
  login: (payload: LoginPayload, signal?: AbortSignal) => Promise<AccountSession>;
  register: (payload: RegisterPayload, signal?: AbortSignal) => Promise<AccountSession>;
  syncProgress: (progress: PlayerProgress, signal?: AbortSignal) => Promise<PlayerProgress>;
  logout: (signal?: AbortSignal) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AccountSession | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [startupError, setStartupError] = useState('');
  const [syncState, setSyncState] = useState<AccountSyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.allSettled([
      getAuthConfig(controller.signal).then(setConfig),
      getAccountSession(controller.signal).then(next => {
        setSession(next);
        setStatus(next ? 'authenticated' : 'guest');
      }),
    ]).then(results => {
      if (controller.signal.aborted) return;
      const sessionResult = results[1];
      if (sessionResult.status === 'rejected') {
        setStatus('guest');
        setStartupError('Не удалось проверить вход. Гостевая игра продолжает работать.');
      }
    });

    return () => controller.abort();
  }, []);

  const applySession = useCallback((next: AccountSession) => {
    setSession(next);
    setStatus('authenticated');
    setStartupError('');
    setSyncState('saved');
    setLastSyncedAt(Date.now());
    return next;
  }, []);

  const login = useCallback(async (payload: LoginPayload, signal?: AbortSignal) => (
    applySession(await loginAccount(payload, signal))
  ), [applySession]);

  const register = useCallback(async (payload: RegisterPayload, signal?: AbortSignal) => (
    applySession(await registerAccount(payload, signal))
  ), [applySession]);

  const syncProgress = useCallback(async (progress: PlayerProgress, signal?: AbortSignal) => {
    if (status !== 'authenticated') return progress;
    setSyncState('saving');
    try {
      const saved = await saveAccountProgress(progress, signal);
      setSession(current => current ? {
        ...current,
        progress: saved.progress,
        revision: saved.revision,
      } : current);
      setSyncState('saved');
      setLastSyncedAt(saved.savedAt || Date.now());
      return saved.progress;
    } catch (error) {
      setSyncState('error');
      throw error;
    }
  }, [status]);

  const logout = useCallback(async (signal?: AbortSignal) => {
    await logoutAccount(signal);
    setSession(null);
    setStatus('guest');
    setSyncState('idle');
    setLastSyncedAt(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    config,
    startupError,
    syncState,
    lastSyncedAt,
    login,
    register,
    syncProgress,
    logout,
  }), [config, lastSyncedAt, login, logout, register, session, startupError, status, syncProgress, syncState]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Context and hook intentionally share this module so their public contract stays together.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
