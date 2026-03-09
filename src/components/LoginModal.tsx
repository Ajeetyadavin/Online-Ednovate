import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Smartphone, Mail, ArrowLeft, Shield, CheckCircle2, KeyRound, Eye, EyeOff, Lock, User } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSignup: boolean;
  onToggleMode: () => void;
}

type View = "login" | "otp" | "otp-verify" | "forgot-choose" | "forgot-email" | "forgot-phone" | "forgot-otp-verify" | "forgot-success";

const LoginModal = ({ open, onOpenChange, isSignup, onToggleMode }: LoginModalProps) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [view, setView] = useState<View>("login");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleReset = () => {
    setView("login");
    setPhone("");
    setEmail("");
    setShowPassword(false);
  };

  const OtpBoxes = () => (
    <div className="flex gap-2.5 justify-center">
      {[...Array(6)].map((_, i) => (
        <input
          key={i}
          type="text"
          maxLength={1}
          className="w-10 h-12 text-center text-lg font-bold rounded-lg border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground"
          onInput={(e) => {
            const t = e.target as HTMLInputElement;
            if (t.value && t.nextElementSibling) (t.nextElementSibling as HTMLInputElement).focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !(e.target as HTMLInputElement).value) {
              const prev = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
              if (prev) prev.focus();
            }
          }}
        />
      ))}
    </div>
  );

  const BackButton = ({ onClick, label = "Back" }: { onClick: () => void; label?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {label}
    </button>
  );

  const InputWithIcon = ({ icon: Icon, ...props }: { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input {...props} className="h-11 text-sm rounded-lg pl-10 border-border bg-background" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset(); }}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-2xl border border-border shadow-xl bg-card gap-0">
        {/* Compact Header */}
        <div className="bg-[rgb(38,72,151)] px-6 py-5 text-center">
          <div className="w-11 h-11 rounded-xl bg-primary-foreground/15 flex items-center justify-center mx-auto mb-2.5">
            {view === "login" ? (
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            ) : view.startsWith("forgot") ? (
              view === "forgot-success" ? <CheckCircle2 className="w-5 h-5 text-primary-foreground" /> : <KeyRound className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Smartphone className="w-5 h-5 text-primary-foreground" />
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-primary-foreground">
            {view === "login" ? (isSignup ? "Create Account" : "Welcome Back") :
             view === "otp" ? "Login with OTP" :
             view === "otp-verify" ? "Verify OTP" :
             view === "forgot-choose" ? "Reset Password" :
             view === "forgot-email" ? "Reset via Email" :
             view === "forgot-phone" ? "Reset via Mobile" :
             view === "forgot-otp-verify" ? "Verify & Reset" :
             "Email Sent!"}
          </DialogTitle>
          <p className="text-xs text-primary-foreground/65 mt-1">
            {view === "login" ? (isSignup ? "Start your learning journey" : "Login to continue learning") :
             view === "otp" ? "We'll send a code to your phone" :
             view === "otp-verify" ? `Sent to +91 ${phone}` :
             view === "forgot-choose" ? "Choose how to reset" :
             view === "forgot-email" ? "We'll send a reset link" :
             view === "forgot-phone" ? "Verify via OTP" :
             view === "forgot-otp-verify" ? `Sent to +91 ${phone}` :
             `Sent to ${email}`}
          </p>
        </div>

        {/* LOGIN */}
        {view === "login" && (
          <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); login("Student"); onOpenChange(false); navigate("/dashboard"); }}>
            {isSignup && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Full Name</Label>
                <InputWithIcon icon={User} placeholder="Enter your full name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Email or Mobile</Label>
              <InputWithIcon icon={Mail} placeholder="Enter email or mobile" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">Password</Label>
                {!isSignup && (
                  <button type="button" onClick={() => setView("forgot-choose")} className="text-[11px] text-accent hover:underline font-medium">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="Enter password" className="h-11 text-sm rounded-lg pl-10 pr-10 border-border bg-background" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg">
              {isSignup ? "Create Account" : "Login"}
            </Button>

            {!isSignup && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-3 text-[10px] text-muted-foreground uppercase tracking-widest">or</span></div>
                </div>
                <Button type="button" variant="outline" onClick={() => setView("otp")} className="w-full h-11 rounded-lg text-sm font-medium border-border hover:bg-muted">
                  <Smartphone className="w-4 h-4 mr-2 text-accent" />
                  Login with OTP
                </Button>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
              <button type="button" onClick={onToggleMode} className="text-accent font-semibold hover:underline">
                {isSignup ? "Login" : "Sign Up"}
              </button>
            </p>
          </form>
        )}

        {/* OTP - ENTER PHONE */}
        {view === "otp" && (
          <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (phone.length >= 10) setView("otp-verify"); }}>
            <BackButton onClick={() => setView("login")} label="Back to login" />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Mobile Number</Label>
              <div className="flex gap-2">
                <div className="h-11 px-3 rounded-lg bg-muted flex items-center text-xs font-semibold text-muted-foreground border border-border">+91</div>
                <Input type="tel" placeholder="10-digit mobile number" className="h-11 text-sm rounded-lg flex-1 border-border" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <Button type="submit" disabled={phone.length < 10} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg disabled:opacity-50">
              <Shield className="w-4 h-4 mr-2" /> Send OTP
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">By continuing, you agree to our Terms & Privacy Policy</p>
          </form>
        )}

        {/* OTP - VERIFY */}
        {view === "otp-verify" && (
          <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); login("Student"); onOpenChange(false); navigate("/dashboard"); }}>
            <BackButton onClick={() => setView("otp")} label="Change number" />
            <div className="space-y-3">
              <Label className="text-xs font-medium text-foreground">Enter 6-digit OTP</Label>
              <OtpBoxes />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg">Verify & Login</Button>
            <p className="text-center text-xs">
              <button type="button" className="text-accent font-medium hover:underline">Resend OTP</button>
              <span className="text-muted-foreground ml-1">(00:30)</span>
            </p>
          </form>
        )}

        {/* FORGOT - CHOOSE */}
        {view === "forgot-choose" && (
          <div className="p-5 space-y-3">
            <BackButton onClick={() => setView("login")} label="Back to login" />
            {[
              { id: "forgot-email" as View, icon: Mail, title: "Reset via Email", desc: "Get a reset link in your inbox" },
              { id: "forgot-phone" as View, icon: Smartphone, title: "Reset via OTP", desc: "Verify with mobile OTP" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setView(opt.id)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors shrink-0">
                  <opt.icon className="w-4.5 h-4.5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* FORGOT - EMAIL */}
        {view === "forgot-email" && (
          <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (email.includes("@")) setView("forgot-success"); }}>
            <BackButton onClick={() => setView("forgot-choose")} />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Email Address</Label>
              <InputWithIcon icon={Mail} type="email" placeholder="Enter your registered email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={!email.includes("@")} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg disabled:opacity-50">
              Send Reset Link
            </Button>
          </form>
        )}

        {/* FORGOT - PHONE */}
        {view === "forgot-phone" && (
          <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (phone.length >= 10) setView("forgot-otp-verify"); }}>
            <BackButton onClick={() => setView("forgot-choose")} />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Mobile Number</Label>
              <div className="flex gap-2">
                <div className="h-11 px-3 rounded-lg bg-muted flex items-center text-xs font-semibold text-muted-foreground border border-border">+91</div>
                <Input type="tel" placeholder="10-digit number" className="h-11 text-sm rounded-lg flex-1 border-border" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <Button type="submit" disabled={phone.length < 10} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg disabled:opacity-50">
              Send OTP
            </Button>
          </form>
        )}

        {/* FORGOT - OTP VERIFY + NEW PASSWORD */}
        {view === "forgot-otp-verify" && (
          <form className="p-5 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <BackButton onClick={() => setView("forgot-phone")} label="Change number" />
            <div className="space-y-3">
              <Label className="text-xs font-medium text-foreground">Enter 6-digit OTP</Label>
              <OtpBoxes />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">New Password</Label>
              <InputWithIcon icon={Lock} type="password" placeholder="Enter new password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Confirm Password</Label>
              <InputWithIcon icon={Lock} type="password" placeholder="Confirm new password" />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg">Reset Password</Button>
            <p className="text-center text-xs">
              <button type="button" className="text-accent font-medium hover:underline">Resend OTP</button>
              <span className="text-muted-foreground ml-1">(00:30)</span>
            </p>
          </form>
        )}

        {/* FORGOT - SUCCESS */}
        {view === "forgot-success" && (
          <div className="p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-accent" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Check your inbox and click the reset link. Also check spam folder.</p>
            <Button onClick={() => setView("forgot-choose")} variant="outline" className="w-full h-10 rounded-lg text-sm">Try another method</Button>
            <button type="button" onClick={() => setView("login")} className="text-xs text-accent font-medium hover:underline">← Back to Login</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
