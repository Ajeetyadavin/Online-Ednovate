import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { professorApi, type ProfessorUser } from "@/services/professorApi";

const STORAGE_KEY = "ednovate_professor_session";
const FORCED_LOGOUT_NOTICE_KEY = "ednovate_forced_logout_notice";

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
  const sessionAlertShownRef = useRef(false);

  const clearSession = useCallback(() => {
    setToken("");
    setUser(null);
    writeStoredSession(null);
    sessionAlertShownRef.current = false;
  }, []);

  const refresh = useCallback(async () => {
    const currentToken = token || readStoredSession()?.token || "";
    if (!currentToken) {
      clearSession();
      return;
    }

    try {
      const status = await professorApi.sessionStatus(currentToken);
      const nextUser = status.user;
      setToken(currentToken);
      setUser(nextUser);
      writeStoredSession({ token: currentToken, user: nextUser });
    } catch {
      clearSession();
      throw new Error("Professor session expired");
    }
  }, [clearSession, token]);

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
    clearSession();
  }, [clearSession, token]);

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
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!token || !user) return;

    let mounted = true;

    const checkSession = async () => {
      try {
        const status = await professorApi.sessionStatus(token);
        if (!mounted) return;
        setUser(status.user);
        writeStoredSession({ token, user: status.user });
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error && error.message
          ? error.message
          : "Professor login detected from another place. You have been logged out.";
        if (!sessionAlertShownRef.current) {
          sessionAlertShownRef.current = true;
          localStorage.setItem(
            FORCED_LOGOUT_NOTICE_KEY,
            JSON.stringify({
              message,
              at: new Date().toISOString(),
              audience: "professor",
            }),
          );
          toast.error(message);
        }
        clearSession();
      }
    };

    void checkSession();
    const interval = window.setInterval(() => {
      void checkSession();
    }, 4000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [clearSession, token, user]);

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
