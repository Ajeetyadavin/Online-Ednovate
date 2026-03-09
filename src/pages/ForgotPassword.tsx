import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Smartphone, Shield, CheckCircle2, Lock, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

type Method = "choose" | "email" | "phone";

const ForgotPassword = () => {
  const [method, setMethod] = useState<Method>("choose");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes("@")) setSent(true);
  };

  const handlePhoneOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length >= 10) setOtpSent(true);
  };

  const InputWithIcon = ({ icon: Icon, ...props }: { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input {...props} className="h-11 text-sm rounded-lg pl-10 border-border bg-background" />
    </div>
  );

  const OtpBoxes = () => (
    <div className="flex gap-2.5 justify-center">
      {[...Array(6)].map((_, i) => (
        <input
          key={i}
          type="text"
          maxLength={1}
          className="w-11 h-13 text-center text-lg font-bold rounded-lg border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground"
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

  const getTitle = () => {
    if (sent) return "Email Sent!";
    if (otpSent) return "Verify & Reset";
    return "Reset Password";
  };

  const getDesc = () => {
    if (sent) return `Reset link sent to ${email}`;
    if (otpSent) return `OTP sent to +91 ${phone}`;
    if (method === "email") return "We'll send a reset link to your email";
    if (method === "phone") return "Verify with OTP and set new password";
    return "Choose how you'd like to reset your password";
  };

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to home */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="bg-card rounded-xl shadow-lg overflow-hidden border border-border">
          {/* Header */}
          <div className="bg-[rgb(38,72,151)] px-6 py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center mx-auto mb-3">
              {sent ? <CheckCircle2 className="w-6 h-6 text-primary-foreground" /> : <KeyRound className="w-6 h-6 text-primary-foreground" />}
            </div>
            <h1 className="text-xl font-bold text-primary-foreground">{getTitle()}</h1>
            <p className="text-xs text-primary-foreground/65 mt-1.5">{getDesc()}</p>
          </div>

          <div className="p-6">
            {/* Success State */}
            {sent && (
              <div className="text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Open your email and click the reset link. Check your spam folder if you don't see it.
                </p>
                <Button
                  onClick={() => { setSent(false); setEmail(""); setMethod("choose"); }}
                  variant="outline"
                  className="w-full h-11 rounded-lg"
                >
                  Try another method
                </Button>
                <Link to="/" className="block text-xs text-accent font-medium hover:underline">
                  ← Back to Home
                </Link>
              </div>
            )}

            {/* OTP Verify State */}
            {otpSent && !sent && (
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setMethod("choose"); }}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change method
                </button>

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

                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg">
                  Reset Password
                </Button>

                <p className="text-center text-xs">
                  <button type="button" className="text-accent font-medium hover:underline">Resend OTP</button>
                  <span className="text-muted-foreground ml-1">(00:30)</span>
                </p>
              </form>
            )}

            {/* Choose Method */}
            {method === "choose" && !sent && !otpSent && (
              <div className="space-y-3">
                {[
                  { id: "email" as Method, icon: Mail, title: "Reset via Email", desc: "Get a reset link in your inbox" },
                  { id: "phone" as Method, icon: Smartphone, title: "Reset via OTP", desc: "Verify with mobile OTP" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setMethod(opt.id)}
                    className="w-full flex items-center gap-3.5 p-4 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group text-left"
                  >
                    <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors shrink-0">
                      <opt.icon className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Email Form */}
            {method === "email" && !sent && !otpSent && (
              <form className="space-y-4" onSubmit={handleEmailSubmit}>
                <button
                  type="button"
                  onClick={() => setMethod("choose")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Email Address</Label>
                  <InputWithIcon icon={Mail} type="email" placeholder="Enter your registered email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" disabled={!email.includes("@")} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg disabled:opacity-50">
                  Send Reset Link
                </Button>
              </form>
            )}

            {/* Phone Form */}
            {method === "phone" && !sent && !otpSent && (
              <form className="space-y-4" onSubmit={handlePhoneOtp}>
                <button
                  type="button"
                  onClick={() => setMethod("choose")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Mobile Number</Label>
                  <div className="flex gap-2">
                    <div className="h-11 px-3 rounded-lg bg-muted flex items-center text-xs font-semibold text-muted-foreground border border-border">+91</div>
                    <Input type="tel" placeholder="10-digit number" className="h-11 text-sm rounded-lg flex-1 border-border" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
                  </div>
                </div>
                <Button type="submit" disabled={phone.length < 10} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm h-11 rounded-lg disabled:opacity-50">
                  <Smartphone className="w-4 h-4 mr-2" /> Send OTP
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
