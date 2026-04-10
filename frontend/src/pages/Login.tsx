import { FormEvent, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, KeyRound, Eye, EyeOff, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fetchProfileApi, SESSION_TOKEN_KEY, type AuthUserProfile } from "@/services/authApi";

const hasActiveSessionConflict = (value: unknown): value is { requiresConfirmation: true } => {
  return Boolean(value) && typeof value === "object" && (value as { requiresConfirmation?: boolean }).requiresConfirmation === true;
};

const resolveProfileStudentId = (profile: Partial<AuthUserProfile> & {
  id?: string | number;
  student_id?: string | number;
  userId?: string | number;
  user_id?: string | number;
}) => String(
  profile.studentId ||
  profile.student_id ||
  profile.userId ||
  profile.user_id ||
  profile.id ||
  "",
).trim();

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAsUser, loginWithEmail } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = typeof location.state === "object" && location.state && "from" in location.state
    ? String((location.state as { from?: { pathname?: string } }).from?.pathname || "/dashboard")
    : "/dashboard";

  const hydrateLoginFromSession = async () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY) || "";
    if (!token) {
      return false;
    }

    const profileResult = await fetchProfileApi();
    if (!profileResult.ok || !profileResult.data) {
      return false;
    }

    const profile = profileResult.data as Partial<AuthUserProfile> & {
      id?: string | number;
      student_id?: string | number;
      userId?: string | number;
      user_id?: string | number;
    };
    const studentId = resolveProfileStudentId(profile);
    if (!studentId) {
      return false;
    }

    loginAsUser({
      studentId,
      name: profile.name || "Student",
      email: profile.email || "",
      mobile: profile.mobile || "",
      address: profile.address || "",
      gender: profile.gender || "",
      country: profile.country || "",
      state: profile.state || "",
      city: profile.city || "",
      pin: profile.pin || "",
      course: profile.course || "",
      level: profile.level || "",
      attemptYear: profile.attemptYear || "",
    });
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      toast.error("Please enter your email/mobile and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginWithEmail(identifier, password);
      if (!result.ok) {
        if (hasActiveSessionConflict(result.data)) {
          const shouldContinue = window.confirm(result.message || "This account is already active on another device. Continue login?");
          if (!shouldContinue) {
            toast.message("Login cancelled.");
            return;
          }

          const forcedResult = await loginWithEmail(identifier, password, { forceLogin: true });
          if (!forcedResult.ok) {
            const recovered = await hydrateLoginFromSession();
            if (recovered) {
              toast.success(forcedResult.message || "Login successful.");
              navigate(redirectTo, { replace: true });
              return;
            }

            toast.error(forcedResult.message || "Login failed. Please try again.");
            return;
          }

          toast.success(forcedResult.message || "Login successful.");
          flushSync(() => {});
          navigate(redirectTo, { replace: true });
          return;
        }

        const recovered = await hydrateLoginFromSession();
        if (recovered) {
          toast.success(result.message || "Login successful.");
          navigate(redirectTo, { replace: true });
          return;
        }

        toast.error(result.message || "Login failed. Please try again.");
        return;
      }

      toast.success(result.message || "Login successful.");
      flushSync(() => {});
      navigate(redirectTo, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[rgb(38,72,151)]/30 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      </div>

      <div className="absolute top-6 left-6">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 rounded-full px-3"
          asChild
        >
          <Link to="/" className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-10 items-center">
        {/* Left intro */}
        <div className="text-slate-100 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200 border border-white/10 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Secure Student Login
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            Welcome back to{" "}
            <span className="text-[rgb(129,215,248)]">Ednovate</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-lg">
            Access your dashboard, purchased courses, progress reports and more. Continue your preparation with
            high-quality lectures and study material.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-200/80 pt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10">
              100% Online Learning
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10">
              Lifetime Access to Recordings
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10">
              Doubt Solving Support
            </span>
          </div>
        </div>

        {/* Right card */}
        <Card className="relative bg-card/95 backdrop-blur-xl border-border/70 shadow-[0_24px_60px_rgba(15,23,42,0.65)]">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-foreground">Login to your account</CardTitle>
            <CardDescription className="text-sm">
              Use your registered email / mobile number and password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email or Mobile No</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    autoComplete="username"
                    placeholder="email@example.com or 10-digit mobile"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className="h-11 pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-[rgb(38,72,151)] hover:text-[rgb(30,60,125)]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 pl-10 pr-10 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-[rgb(38,72,151)] hover:bg-[rgb(30,60,125)] text-primary-foreground font-semibold mt-2"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <p className="mt-4 text-xs sm:text-sm text-center text-muted-foreground">
              New to Ednovate?{" "}
              <Link
                to="/signup"
                className="font-semibold text-[rgb(38,72,151)] hover:text-[rgb(30,60,125)]"
              >
                Create a new account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;

