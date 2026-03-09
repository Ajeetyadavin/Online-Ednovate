import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  userName: string;
  login: (name?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  userName: "",
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("ednovate_logged_in") === "true");
  const [userName, setUserName] = useState(() => localStorage.getItem("ednovate_user_name") || "Student");

  const login = (name?: string) => {
    setIsLoggedIn(true);
    setUserName(name || "Student");
    localStorage.setItem("ednovate_logged_in", "true");
    localStorage.setItem("ednovate_user_name", name || "Student");
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserName("");
    localStorage.removeItem("ednovate_logged_in");
    localStorage.removeItem("ednovate_user_name");
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, userName, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
