"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthResponse, AuthUser, getMyProfile, login, register } from "@/services/backendApi";

interface RegisterInput {
  userName: string;
  email: string;
  password: string;
  bio?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (loginValue: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

interface StoredSession {
  accessToken: string;
  user: AuthUser;
  expiresAtUtc: string;
}

const SESSION_STORAGE_KEY = "musicle.session.v1";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistSession(session: StoredSession | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.accessToken || !parsed?.user?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function toStoredSession(response: AuthResponse): StoredSession {
  return {
    accessToken: response.accessToken,
    expiresAtUtc: response.expiresAtUtc,
    user: response.user,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      const stored = readSession();
      if (!stored) {
        setLoading(false);
        return;
      }

      try {
        const user = await getMyProfile(stored.accessToken);
        const nextSession: StoredSession = {
          ...stored,
          user,
        };

        setSession(nextSession);
        persistSession(nextSession);
      } catch {
        setSession(null);
        persistSession(null);
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const signIn = async (loginValue: string, password: string) => {
      const result = await login({ login: loginValue, password });
      const nextSession = toStoredSession(result);
      setSession(nextSession);
      persistSession(nextSession);
    };

    const signUp = async (input: RegisterInput) => {
      const result = await register(input);
      const nextSession = toStoredSession(result);
      setSession(nextSession);
      persistSession(nextSession);
    };

    const signOut = () => {
      setSession(null);
      persistSession(null);
    };

    const refreshProfile = async () => {
      if (!session?.accessToken) {
        return;
      }

      const user = await getMyProfile(session.accessToken);
      const nextSession: StoredSession = {
        ...session,
        user,
      };

      setSession(nextSession);
      persistSession(nextSession);
    };

    return {
      user: session?.user ?? null,
      token: session?.accessToken ?? null,
      loading,
      isAuthenticated: Boolean(session?.accessToken),
      signIn,
      signUp,
      signOut,
      refreshProfile,
    };
  }, [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}