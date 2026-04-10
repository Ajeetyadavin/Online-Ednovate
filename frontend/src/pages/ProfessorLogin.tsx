import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfessorAuth } from "@/context/ProfessorAuthContext";

export default function ProfessorLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useProfessorAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const redirectTo = typeof location.state === "object" && location.state && "from" in location.state
    ? String((location.state as { from?: { pathname?: string } }).from?.pathname || "/professor/dashboard")
    : "/professor/dashboard";

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      if (message.toLowerCase().includes("already logged in")) {
        const force = window.confirm(`${message}\n\nLogin here anyway?`);
        if (force) {
          await login(email.trim(), password, true);
          navigate(redirectTo, { replace: true });
          return;
        }
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backgroundColor: "#f5f5f5" }}>
      <div style={{ width: "100%", maxWidth: "400px", backgroundColor: "#fff", padding: "30px", border: "1px solid #ddd", borderRadius: "6px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px", color: "#333" }}>Professor Login</h1>
        <p style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}>Sign in to view your course revenue and reports</p>

        {error && (
          <div style={{ backgroundColor: "#fee", border: "1px solid #fcc", color: "#c33", padding: "10px", marginBottom: "15px", borderRadius: "4px", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "5px", color: "#333" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="faculty@example.com"
            style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "5px", color: "#333" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
          />
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: isLoading ? "#999" : "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Signing in..." : "Login"}
        </button>
        </form>
      </div>
    </div>
  );
}
