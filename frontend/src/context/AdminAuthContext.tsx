import React, { createContext, useContext, useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export type AdminAction = "read" | "create" | "edit" | "delete";
export type AdminModuleKey =
  | "dashboard"
  | "courses"
  | "course-content"
  | "categories"
  | "masters"
  | "coupons"
  | "faculty"
  | "homepage"
  | "users"
  | "orders"
  | "leads"
  | "announcements"
  | "technical-support"
  | "marketing"
  | "settings"
  | "subadmins"
  | "logs";

export type ModulePermission = Record<AdminAction, boolean>;
export type AdminPermissions = Record<AdminModuleKey, ModulePermission>;

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin?: boolean;
  permissions?: AdminPermissions;
}

interface AdminSessionPayload {
  token: string;
  user: AdminUser;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    options?: { forceLogin?: boolean },
  ) => Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean }>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (module: AdminModuleKey, action?: AdminAction) => boolean;
}

const SESSION_KEY = "admin_session_v2";
const FORCED_LOGOUT_NOTICE_KEY = "ednovate_forced_logout_notice";

const defaultModulePermission: ModulePermission = {
  read: false,
  create: false,
  edit: false,
  delete: false,
};

const fullPermissions = (): AdminPermissions => ({
  dashboard: { read: true, create: true, edit: true, delete: true },
  courses: { read: true, create: true, edit: true, delete: true },
  "course-content": { read: true, create: true, edit: true, delete: true },
  categories: { read: true, create: true, edit: true, delete: true },
  masters: { read: true, create: true, edit: true, delete: true },
  coupons: { read: true, create: true, edit: true, delete: true },
  faculty: { read: true, create: true, edit: true, delete: true },
  homepage: { read: true, create: true, edit: true, delete: true },
  users: { read: true, create: true, edit: true, delete: true },
  orders: { read: true, create: true, edit: true, delete: true },
  leads: { read: true, create: true, edit: true, delete: true },
  announcements: { read: true, create: true, edit: true, delete: true },
  "technical-support": { read: true, create: true, edit: true, delete: true },
  marketing: { read: true, create: true, edit: true, delete: true },
  settings: { read: true, create: true, edit: true, delete: true },
  subadmins: { read: true, create: true, edit: true, delete: true },
  logs: { read: true, create: true, edit: true, delete: true },
});

const normalizePermissions = (permissions?: Partial<AdminPermissions>): AdminPermissions => {
  const base = fullPermissions();
  if (!permissions) return base;

  (Object.keys(base) as AdminModuleKey[]).forEach((module) => {
    const incoming = permissions[module] || defaultModulePermission;
    base[module] = {
      read: Boolean(incoming.read),
      create: Boolean(incoming.create),
      edit: Boolean(incoming.edit),
      delete: Boolean(incoming.delete),
    };
  });

  return base;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionAlertShownRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AdminSessionPayload;
        if (parsed?.user && parsed?.token) {
          setAdmin({
            ...parsed.user,
            permissions: normalizePermissions(parsed.user.permissions),
          });
          setToken(parsed.token);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, options?: { forceLogin?: boolean }) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, forceLogin: options?.forceLogin === true }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.token || !payload?.user) {
        setIsLoading(false);
        if (payload?.requiresConfirmation === true) {
          return {
            success: false,
            error: payload?.message || "This account is already logged in on another device.",
            requiresConfirmation: true,
          };
        }
        return { success: false, error: payload?.message || "Invalid email or password" };
      }

      const nextUser: AdminUser = {
        ...payload.user,
        permissions: normalizePermissions(payload.user.permissions),
      };

      setAdmin(nextUser);
      setToken(payload.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token: payload.token, user: nextUser }));
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error instanceof Error ? error.message : "Login failed" };
    }
  };

  const logout = () => {
    setAdmin(null);
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
    sessionAlertShownRef.current = false;
  };

  useEffect(() => {
    if (!admin || !token) return;

    let mounted = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/admin/session-status", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) return;

        const payload = await response.json().catch(() => ({} as { message?: string }));
        if (!mounted) return;

        const message = String(payload?.message || "Admin login detected from another place. You have been logged out.");
        if (!sessionAlertShownRef.current) {
          sessionAlertShownRef.current = true;
          localStorage.setItem(
            FORCED_LOGOUT_NOTICE_KEY,
            JSON.stringify({
              message,
              at: new Date().toISOString(),
              audience: "admin",
            }),
          );
          toast.error(message);
        }
        logout();
      } catch {
        // Ignore temporary network errors; next poll will retry.
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
  }, [admin, token]);

  const hasPermission = (module: AdminModuleKey, action: AdminAction = "read") => {
    if (!admin) return false;
    if (admin.isSuperAdmin || admin.role === "super_admin") return true;
    const permissions = normalizePermissions(admin.permissions);
    return Boolean(permissions[module]?.[action]);
  };

  const value = useMemo(
    () => ({ admin, token, isLoading, login, logout, isAuthenticated: !!admin && !!token, hasPermission }),
    [admin, token, isLoading],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
};
