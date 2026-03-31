import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, KeyRound, Phone, User2, Eye, EyeOff, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const Signup = () => {
  const navigate = useNavigate();
  const { signup, loginWithEmail } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !mobile.trim() || !password.trim() || !confirmPassword.trim()) {
      toast.error("Please fill all required fields.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Password and confirm password do not match.");
      return;
    }

    if (!termsAccepted) {
      toast.error("Please accept the terms & privacy policy.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signup({
        name,
        email,
        mobile,
        password,
      });

      if (!result.ok) {
        toast.error(result.message || "Signup failed. Please try again.");
        return;
      }

      toast.success(result.message || "Signup successful. Logging you in...");

      const loginResult = await loginWithEmail(email, password);
      if (!loginResult.ok) {
        navigate("/login");
        return;
      }

      navigate("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizedMobile = mobile.replace(/\D/g, "").slice(0, 10);

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
            <Sparkles className="w-3.5 h-3.5 text-[rgb(129,215,248)]" />
            Join Ednovate in 2 minutes
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            Create your{" "}
            <span className="text-[rgb(129,215,248)]">student account</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-lg">
            Track your progress, access purchased courses anytime, and receive updates for new batches, mock tests
            and doubt solving sessions.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-200/80 pt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10">
              One-time signup, lifetime access
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10">
              Access from mobile, tablet, laptop
            </span>
          </div>
        </div>

        {/* Right card */}
        <Card className="relative bg-card/95 backdrop-blur-xl border-border/70 shadow-[0_24px_60px_rgba(15,23,42,0.65)]">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-foreground">Create a new account</CardTitle>
            <CardDescription className="text-sm">
              Enter your basic details to start learning with Ednovate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <div className="relative">
                  <User2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="h-11 px-3 rounded-xl bg-muted flex items-center text-xs font-semibold text-muted-foreground border border-border shrink-0">
                    +91
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      autoComplete="tel"
                      placeholder="10-digit mobile number"
                      value={normalizedMobile}
                      onChange={(event) => setMobile(event.target.value)}
                      maxLength={10}
                      className="h-11 pl-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Min 6 characters"
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

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Confirm Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-11 pl-10 pr-10 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((previous) => !previous)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[rgb(38,72,151)]"
                />
                <span>
                  I agree to the{" "}
                  <span className="font-semibold text-[rgb(38,72,151)]">Terms &amp; Conditions</span> and{" "}
                  <span className="font-semibold text-[rgb(38,72,151)]">Privacy Policy</span>.
                </span>
              </label>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-[rgb(38,72,151)] hover:bg-[rgb(30,60,125)] text-primary-foreground font-semibold mt-2"
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="mt-4 text-xs sm:text-sm text-center text-muted-foreground">
              Already registered?{" "}
              <Link
                to="/login"
                className="font-semibold text-[rgb(38,72,151)] hover:text-[rgb(30,60,125)]"
              >
                Login to your account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;

