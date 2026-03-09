import React, { createContext, useContext, useState, useEffect } from "react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// Mock admin credentials (no DB — change these later)
const MOCK_ADMIN = {
  email: "admin@ednovate.com",
  password: "admin123",
  user: {
    id: "mock-admin-1",
    name: "Super Admin",
    email: "admin@ednovate.com",
    role: "super_admin",
  },
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("admin_session");
    if (stored) {
      try {
        setAdmin(JSON.parse(stored));
      } catch {
        localStorage.removeItem("admin_session");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800)); // simulate network
    if (email === MOCK_ADMIN.email && password === MOCK_ADMIN.password) {
      setAdmin(MOCK_ADMIN.user);
      localStorage.setItem("admin_session", JSON.stringify(MOCK_ADMIN.user));
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, error: "Invalid email or password" };
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem("admin_session");
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
};
