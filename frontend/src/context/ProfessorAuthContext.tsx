import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { professorApi, type ProfessorUser } from "@/services/professorApi";

const STORAGE_KEY = "ednovate_professor_session";

type ProfessorSession = {
  token: string;
  user: ProfessorUser;
};

type ProfessorAuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string;
  user: ProfessorUser | null;
  login: (email: string, password: string, forceLogin?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ProfessorAuthContext = createContext<ProfessorAuthContextValue | undefined>(undefined);

const readStoredSession = (): ProfessorSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfessorSession;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStoredSession = (session: ProfessorSession | null) => {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
};

export const ProfessorAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<ProfessorUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const currentToken = token || readStoredSession()?.token || "";
    if (!currentToken) {
      setToken("");
      setUser(null);
      writeStoredSession(null);
      return;
    }

    const status = await professorApi.sessionStatus(currentToken);
    const nextUser = status.user;
    setToken(currentToken);
    setUser(nextUser);
    writeStoredSession({ token: currentToken, user: nextUser });
  }, [token]);

  const login = useCallback(async (email: string, password: string, forceLogin = false) => {
    const result = await professorApi.login({ email, password, forceLogin });
    setToken(result.token);
    setUser(result.user);
    writeStoredSession({ token: result.token, user: result.user });
  }, []);

  const logout = useCallback(async () => {
    const currentToken = token || readStoredSession()?.token || "";
    if (currentToken) {
      try {
        await professorApi.logout(currentToken);
      } catch {
        // ignore logout errors; clear local session anyway
      }
    }
    setToken("");
    setUser(null);
    writeStoredSession(null);
  }, [token]);

  useEffect(() => {
    const bootstrap = async () => {
      const stored = readStoredSession();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      setToken(stored.token);
      setUser(stored.user);
      try {
        const status = await professorApi.sessionStatus(stored.token);
        setUser(status.user);
        writeStoredSession({ token: stored.token, user: status.user });
      } catch {
        setToken("");
        setUser(null);
        writeStoredSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const value = useMemo<ProfessorAuthContextValue>(() => ({
    isAuthenticated: Boolean(token && user),
    isLoading,
    token,
    user,
    login,
    logout,
    refresh,
  }), [token, user, isLoading, login, logout, refresh]);

  return (
    <ProfessorAuthContext.Provider value={value}>
      {children}
    </ProfessorAuthContext.Provider>
  );
};

export const useProfessorAuth = () => {
  const ctx = useContext(ProfessorAuthContext);
  if (!ctx) throw new Error("useProfessorAuth must be used within ProfessorAuthProvider");
  return ctx;
};
