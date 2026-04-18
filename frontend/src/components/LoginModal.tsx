import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Country, State } from "country-state-city";

import { useAuth } from "@/context/AuthContext";
import { fetchProfileApi, SESSION_TOKEN_KEY, type AuthUserProfile } from "@/services/authApi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSignup: boolean;
  onToggleMode: () => void;
  redirectPath?: string;
}

type SignupStep = 1 | 2 | 3;

interface SignupFormState {
  firstName: string;
  lastName: string;
  gender: string;
  countryCode: string;
  mobile: string;
  email: string;
  password: string;
  confirmPassword: string;
  country: string;
  state: string;
  city: string;
  pin: string;
  fullAddress: string;
  captchaAnswer: string;
  termsAccepted: boolean;
}

const GENDER_OPTIONS = ["Male", "Female", "Other"];

const INITIAL_SIGNUP_FORM: SignupFormState = {
  firstName: "",
  lastName: "",
  gender: "",
  countryCode: "+91",
  mobile: "",
  email: "",
  password: "",
  confirmPassword: "",
  country: "IN",
  state: "",
  city: "",
  pin: "",
  fullAddress: "",
  captchaAnswer: "",
  termsAccepted: false,
};

const normalizeMobile = (value: string) => value.replace(/\D/g, "").slice(-10);
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const formatTime = (seconds: number) => `0:${String(seconds).padStart(2, "0")}`;
const hasActiveSessionConflict = (value: unknown): value is { requiresConfirmation: true } => {
  return Boolean(value) && typeof value === "object" && (value as { requiresConfirmation?: boolean }).requiresConfirmation === true;
};

const createCaptchaChallenge = () => {
  const left = Math.floor(Math.random() * 8) + 1;
  const right = Math.floor(Math.random() * 8) + 1;
  return {
    question: `${left} + ${right} = ?`,
    answer: String(left + right),
  };
};

const fetchIndianCitiesByPin = async (pin: string, selectedStateName: string): Promise<string[]> => {
  if (!/^\d{6}$/.test(pin)) return [];
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    if (!response.ok) return [];
    const payload = await response.json();
    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first || first.Status !== "Success" || !Array.isArray(first.PostOffice)) return [];

    const normalizedState = String(selectedStateName || "").trim().toLowerCase();
    const filteredOffices = normalizedState
      ? first.PostOffice.filter((office: { State?: string }) => String(office?.State || "").trim().toLowerCase() === normalizedState)
      : first.PostOffice;

    return Array.from(
      new Set(
        filteredOffices
          .map((office: { Name?: string }) => String(office?.Name || "").trim())
          .filter(Boolean),
      ),
    );
  } catch {
    return [];
  }
};

const fieldClassName =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20";

const LoginModal = ({
  open,
  onOpenChange,
  isSignup,
  onToggleMode,
  redirectPath = "/dashboard",
}: LoginModalProps) => {
  const navigate = useNavigate();
  const { loginWithEmail, loginAsUser, sendOtp, signup, verifyOtpAndLogin, verifyOtpCode, resetPassword } = useAuth();

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [loginOtpMobile, setLoginOtpMobile] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginOtpSeconds, setLoginOtpSeconds] = useState(55);
  const [isLoginOtpSending, setIsLoginOtpSending] = useState(false);
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [isLoginOtpVerifying, setIsLoginOtpVerifying] = useState(false);

  const [signupForm, setSignupForm] = useState<SignupFormState>(INITIAL_SIGNUP_FORM);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSeconds, setOtpSeconds] = useState(55);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotMobile, setForgotMobile] = useState("");
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotSeconds, setForgotSeconds] = useState(55);
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  const stepTitle = useMemo(() => {
    if (signupStep === 1) {
      return "Personal Details";
    }
    if (signupStep === 2) {
      return "Location Details";
    }
    return "OTP Verification";
  }, [signupStep]);

  const [captchaChallenge, setCaptchaChallenge] = useState(() => createCaptchaChallenge());

  const countryOptions = useMemo(() => Country.getAllCountries(), []);
  const availableStates = useMemo(() => {
    if (!signupForm.country) return [];
    return State.getStatesOfCountry(signupForm.country);
  }, [signupForm.country]);

  const selectedCountryName = useMemo(
    () => countryOptions.find((country) => country.isoCode === signupForm.country)?.name || "",
    [countryOptions, signupForm.country],
  );

  const selectedStateName = useMemo(
    () => availableStates.find((state) => state.isoCode === signupForm.state)?.name || "",
    [availableStates, signupForm.state],
  );

  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [isCityLookupLoading, setIsCityLookupLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadCities = async () => {
      if (signupForm.country !== "IN") {
        setCityOptions([]);
        setIsCityLookupLoading(false);
        return;
      }

      if (!/^\d{6}$/.test(signupForm.pin)) {
        setCityOptions([]);
        setIsCityLookupLoading(false);
        return;
      }

      setIsCityLookupLoading(true);
      const cities = await fetchIndianCitiesByPin(signupForm.pin, selectedStateName);
      if (isCancelled) return;

      setCityOptions(cities);
      setIsCityLookupLoading(false);

      if (cities.length > 0) {
        setSignupForm((previous) => ({
          ...previous,
          city: cities.includes(previous.city) ? previous.city : cities[0],
        }));
      }
    };

    void loadCities();

    return () => {
      isCancelled = true;
    };
  }, [signupForm.country, signupForm.pin, selectedStateName]);

  const resetFormState = () => {
    setLoginIdentifier("");
    setLoginPassword("");
    setShowLoginPassword(false);
    setIsLoginSubmitting(false);
    setLoginMethod("password");
    setLoginOtpMobile("");
    setLoginOtpCode("");
    setLoginOtpSeconds(55);
    setIsLoginOtpSending(false);
    setLoginOtpSent(false);
    setIsLoginOtpVerifying(false);

    setSignupForm({ ...INITIAL_SIGNUP_FORM });
    setSignupStep(1);
    setShowSignupPassword(false);
    setShowConfirmPassword(false);
    setOtpCode("");
    setOtpSeconds(55);
    setIsOtpSending(false);
    setIsSignupSubmitting(false);
    setCaptchaChallenge(createCaptchaChallenge());

    setShowForgotPassword(false);
    setForgotMobile("");
    setForgotOtpSent(false);
    setForgotOtpCode("");
    setForgotSeconds(55);
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
    setIsForgotSubmitting(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    resetFormState();
  }, [open]);

  useEffect(() => {
    if (!open || !isSignup) {
      return;
    }
    setSignupStep(1);
    setOtpCode("");
    setOtpSeconds(55);
  }, [isSignup, open]);

  useEffect(() => {
    if (!open || !isSignup || signupStep !== 3 || otpSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpSeconds((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isSignup, open, otpSeconds, signupStep]);

  useEffect(() => {
    if (!open || !showForgotPassword || !forgotOtpSent || forgotSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setForgotSeconds((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, showForgotPassword, forgotOtpSent, forgotSeconds]);

  useEffect(() => {
    if (!open || isSignup || !loginOtpSent || loginOtpSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setLoginOtpSeconds((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, isSignup, loginOtpSent, loginOtpSeconds]);

  const updateSignupField = <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => {
    setSignupForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleModalOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetFormState();
    }
  };

  const handleModeSwitch = () => {
    resetFormState();
    onToggleMode();
  };

  const hydrateLoginFromSession = async (): Promise<boolean> => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY) || "";
    if (!token) return false;
    const profileResult = await fetchProfileApi();
    if (!profileResult.ok || !profileResult.data) return false;
    const profile = profileResult.data as Partial<AuthUserProfile> & {
      id?: string | number;
      student_id?: string | number;
      userId?: string | number;
      user_id?: string | number;
    };
    const studentId = String(
      profile.studentId || profile.student_id || profile.userId || profile.user_id || profile.id || ""
    ).trim();
    if (!studentId) return false;
    flushSync(() => {
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
    });
    return true;
  };

  const completeLogin = () => {
    onOpenChange(false);
    resetFormState();
    navigate(redirectPath);
  };

  const validateStepOne = () => {
    if (!signupForm.firstName.trim()) {
      toast.error("Please enter first name.");
      return false;
    }
    if (!signupForm.lastName.trim()) {
      toast.error("Please enter last name.");
      return false;
    }
    if (!signupForm.gender) {
      toast.error("Please select gender.");
      return false;
    }
    if (signupForm.mobile.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return false;
    }
    if (!isValidEmail(signupForm.email)) {
      toast.error("Please enter a valid email address.");
      return false;
    }
    if (signupForm.password.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return false;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      toast.error("Password and confirm password do not match.");
      return false;
    }

    return true;
  };

  const validateStepTwo = () => {
    if (!signupForm.country) {
      toast.error("Please choose country.");
      return false;
    }
    if (!signupForm.state) {
      toast.error("Please choose state.");
      return false;
    }
    if (signupForm.country === "IN") {
      if (!/^\d{6}$/.test(signupForm.pin)) {
        toast.error("Please enter a valid 6-digit pin code.");
        return false;
      }
      if (!signupForm.city.trim()) {
        toast.error("Selected pin code does not match the selected state.");
        return false;
      }
    } else if (!signupForm.city.trim()) {
      toast.error("Please enter city.");
      return false;
    }
    if (signupForm.captchaAnswer.trim() !== captchaChallenge.answer) {
      toast.error("Captcha answer is incorrect.");
      setCaptchaChallenge(createCaptchaChallenge());
      updateSignupField("captchaAnswer", "");
      return false;
    }
    if (!signupForm.termsAccepted) {
      toast.error("Please accept terms and privacy policy.");
      return false;
    }

    return true;
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      toast.error("Please enter login details.");
      return;
    }

    setIsLoginSubmitting(true);
    try {
      const response = await loginWithEmail(loginIdentifier, loginPassword);
      if (!response.ok) {
        if (hasActiveSessionConflict(response.data)) {
          const shouldContinue = window.confirm(response.message || "This account is already active on another device. Continue login?");
          if (!shouldContinue) {
            toast.message("Login cancelled.");
            return;
          }

          const forcedResponse = await loginWithEmail(loginIdentifier, loginPassword, { forceLogin: true });
          if (!forcedResponse.ok) {
            const recovered = await hydrateLoginFromSession();
            if (recovered) {
              toast.success(forcedResponse.message || "Login successful.");
              completeLogin();
              return;
            }
            toast.error(forcedResponse.message || "Login failed.");
            return;
          }

          flushSync(() => {});
          toast.success(forcedResponse.message || "Login successful.");
          completeLogin();
          return;
        }
        const recovered = await hydrateLoginFromSession();
        if (recovered) {
          toast.success(response.message || "Login successful.");
          completeLogin();
          return;
        }
        toast.error(response.message || "Login failed.");
        return;
      }

      flushSync(() => {});
      toast.success(response.message || "Login successful.");
      completeLogin();
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleSendLoginOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const mobile = normalizeMobile(loginOtpMobile);
    if (mobile.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setIsLoginOtpSending(true);
    try {
      const response = await sendOtp(mobile, "login");
      if (!response.ok) {
        toast.error(response.message || "Failed to send OTP.");
        return;
      }
      toast.success(response.message || "OTP sent to your mobile.");
      setLoginOtpCode("");
      setLoginOtpSeconds(55);
      setLoginOtpSent(true);
    } finally {
      setIsLoginOtpSending(false);
    }
  };

  const handleVerifyLoginOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loginOtpCode.trim().length !== 6) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }
    setIsLoginOtpVerifying(true);
    try {
      const response = await verifyOtpAndLogin(normalizeMobile(loginOtpMobile), loginOtpCode);
      if (!response.ok) {
        toast.error(response.message || "OTP verification failed.");
        return;
      }
      toast.success("Login successful.");
      completeLogin();
    } finally {
      setIsLoginOtpVerifying(false);
    }
  };

  const handleResendLoginOtp = async () => {
    if (loginOtpSeconds > 0 || isLoginOtpSending) return;
    setIsLoginOtpSending(true);
    try {
      const response = await sendOtp(normalizeMobile(loginOtpMobile), "login");
      if (!response.ok) {
        toast.error(response.message || "Could not resend OTP.");
        return;
      }
      toast.success("OTP resent successfully.");
      setLoginOtpSeconds(55);
    } finally {
      setIsLoginOtpSending(false);
    }
  };

  const handleStepOneSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateStepOne()) {
      return;
    }
    setSignupStep(2);
  };

  const handleStepTwoSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateStepTwo()) {
      return;
    }

    setIsOtpSending(true);
    try {
      const response = await sendOtp(signupForm.mobile, "signup");
      if (!response.ok) {
        toast.error(response.message || "Failed to send OTP.");
        return;
      }

      toast.success(response.message || "OTP sent successfully.");
      setOtpCode("");
      setOtpSeconds(55);
      setSignupStep(3);
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpSeconds > 0) {
      return;
    }

    setIsOtpSending(true);
    try {
      const response = await sendOtp(signupForm.mobile, "signup");
      if (!response.ok) {
        toast.error(response.message || "Could not resend OTP.");
        return;
      }

      toast.success("OTP resent successfully.");
      setOtpSeconds(55);
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleSignupSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (otpCode.trim().length !== 6) {
      toast.error("Please enter 6-digit OTP.");
      return;
    }

    setIsSignupSubmitting(true);
    try {
      const otpResult = await verifyOtpCode(signupForm.mobile, otpCode);
      if (!otpResult.ok) {
        toast.error(otpResult.message || "OTP verification failed.");
        return;
      }

      const fullName = `${signupForm.firstName.trim()} ${signupForm.lastName.trim()}`.trim();
      const signupResult = await signup({
        name: fullName,
        email: signupForm.email,
        mobile: signupForm.mobile,
        password: signupForm.password,
        gender: signupForm.gender,
        country: selectedCountryName,
        state: selectedStateName,
        city: signupForm.city,
        address: signupForm.fullAddress,
        pin: signupForm.pin,
      });

      if (!signupResult.ok) {
        toast.error(signupResult.message || "Signup failed.");
        return;
      }

      const loginResult = await loginWithEmail(signupForm.email, signupForm.password);
      if (!loginResult.ok) {
        if (hasActiveSessionConflict(loginResult.data)) {
          const shouldContinue = window.confirm(loginResult.message || "This account is already active on another device. Continue login?");
          if (shouldContinue) {
            const forcedLoginResult = await loginWithEmail(signupForm.email, signupForm.password, { forceLogin: true });
            if (forcedLoginResult.ok) {
              toast.success("Signup successful.");
              completeLogin();
              if (isSignup) {
                onToggleMode();
              }
              return;
            }
          }
        }
        toast.success(signupResult.message || "Signup complete. Please login.");
        setSignupStep(1);
        onToggleMode();
        return;
      }

      toast.success("Signup successful.");
      completeLogin();
      if (isSignup) {
        onToggleMode();
      }
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const handleSendForgotOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const mobile = normalizeMobile(forgotMobile);
    if (mobile.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsForgotSubmitting(true);
    try {
      const response = await sendOtp(mobile, "reset");
      if (!response.ok) {
        toast.error(response.message || "Failed to send OTP.");
        return;
      }
      toast.success(response.message || "OTP sent to your mobile.");
      setForgotOtpSent(true);
      setForgotOtpCode("");
      setForgotSeconds(55);
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResendForgotOtp = async () => {
    if (forgotSeconds > 0 || isForgotSubmitting) return;
    const mobile = normalizeMobile(forgotMobile);
    if (mobile.length !== 10) return;

    setIsForgotSubmitting(true);
    try {
      const response = await sendOtp(mobile, "reset");
      if (!response.ok) {
        toast.error(response.message || "Could not resend OTP.");
        return;
      }
      toast.success("OTP resent successfully.");
      setForgotSeconds(55);
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleForgotReset = async (event: React.FormEvent) => {
    event.preventDefault();
    const mobile = normalizeMobile(forgotMobile);
    if (mobile.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (forgotOtpCode.trim().length !== 6) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }
    if (forgotNewPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error("Password and confirm password do not match.");
      return;
    }

    setIsForgotSubmitting(true);
    try {
      const resetResult = await resetPassword(mobile, forgotNewPassword, forgotOtpCode);
      if (!resetResult.ok) {
        toast.error(resetResult.message || "Password reset failed.");
        return;
      }

      toast.success(resetResult.message || "Password reset successful. Please login.");
      setShowForgotPassword(false);
      setForgotOtpSent(false);
      setForgotOtpCode("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setForgotSeconds(55);
      setLoginMethod("password");
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleModalOpenChange}>
      <DialogContent className="w-[96vw] max-w-[480px] overflow-hidden rounded-3xl border-0 p-0 shadow-[0_32px_64px_-8px_rgba(0,0,0,0.28)]">
        <div className="flex max-h-[92vh] flex-col">

          {/* ── HEADER ── */}
          <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-[rgb(38,72,151)] via-[rgb(38,72,151)] to-[rgb(17,37,92)] ${isSignup && !showForgotPassword ? "px-5 pb-3 pt-4" : "px-7 pb-6 pt-7"}`}>
            {/* decorative blobs */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10" />

            {/* logo */}
            <img src="/ednovate-logo.png" alt="Ednovate" className={`relative z-10 w-auto rounded-lg bg-white shadow ${isSignup && !showForgotPassword ? "h-9 px-2.5 py-1.5" : "h-11 px-3 py-2"}`} />

            {/* title + subtitle */}
            <div className={`relative z-10 ${isSignup && !showForgotPassword ? "mt-2" : "mt-5"}`}>
              <DialogTitle className={`${isSignup && !showForgotPassword ? "text-[1.65rem]" : "text-3xl"} font-extrabold leading-tight tracking-tight text-white`}>
                {showForgotPassword ? "Reset Password" : isSignup ? "Create Account" : "Welcome Back"}
              </DialogTitle>
              <p className={`font-medium text-[rgb(211,224,255)] ${isSignup && !showForgotPassword ? "mt-1 text-[13px]" : "mt-1.5 text-sm"}`}>
                {showForgotPassword
                  ? "Verify OTP and set a new password."
                  : isSignup
                  ? signupStep === 3
                    ? "Almost there! Verify your mobile number."
                    : "Join thousands of learners on Ednovate."
                  : loginMethod === "password"
                    ? "Sign in to continue your learning journey."
                    : loginOtpSent
                      ? `OTP sent to ******${loginOtpMobile.slice(-4)}. Enter below.`
                      : "Enter your mobile to receive a one-time password."}
              </p>
            </div>

            {/* signup step bar */}
            {isSignup && !showForgotPassword && (
              <div className="relative z-10 mt-2.5 flex items-center gap-0">
                {([{ id: 1 as SignupStep, label: "Profile" }, { id: 2 as SignupStep, label: "Location" }, { id: 3 as SignupStep, label: "Verify" }]).map((step, index) => {
                  const isComplete = signupStep > step.id;
                  const isActive   = signupStep === step.id;
                  return (
                    <div key={step.id} className={`flex items-center ${index < 2 ? "flex-1" : ""}`}>
                      <div className="flex flex-col items-center gap-1">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                          isComplete ? "bg-[rgb(231,70,35)] text-white shadow"
                            : isActive  ? "bg-white text-[rgb(38,72,151)] shadow"
                            : "bg-white/15 text-white/60"
                        }`}>
                          {isComplete ? <Check className="h-4 w-4" /> : step.id}
                        </div>
                        <span className={`text-[9px] font-semibold ${ isActive ? "text-white" : "text-white/50" }`}>{step.label}</span>
                      </div>
                      {index < 2 && (
                        <div className={`mx-2.5 mb-4 h-px flex-1 transition-all ${ signupStep > step.id ? "bg-white" : "bg-white/25" }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SCROLLABLE FORM BODY ── */}
          <div className={`flex-1 bg-white ${isSignup && !showForgotPassword ? "overflow-hidden px-5 py-3" : "overflow-y-auto px-7 py-5"}`}>

            {/* LOGIN */}
            {!isSignup && !showForgotPassword && (
              <div>
                <div className="mb-6 flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => { setLoginMethod("password"); setLoginOtpSent(false); setLoginOtpCode(""); }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      loginMethod === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <KeyRound className="h-4 w-4" />
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginMethod("otp"); setLoginOtpSent(false); setLoginOtpCode(""); }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      loginMethod === "otp" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    OTP Login
                  </button>
                </div>

                {loginMethod === "password" && (
                  <form className="space-y-4" onSubmit={handleLoginSubmit}>
                    <div className="space-y-1.5">
                      <Label htmlFor="loginIdentifier" className="text-sm font-semibold text-slate-700">
                        Email or Mobile No
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="loginIdentifier"
                          className={`${fieldClassName} pl-9`}
                          placeholder="email@example.com or 10-digit mobile"
                          value={loginIdentifier}
                          onChange={(event) => setLoginIdentifier(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="loginPassword" className="text-sm font-semibold text-slate-700">
                          Password
                        </Label>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(true); }}
                          className="text-xs font-semibold text-teal-600 hover:text-teal-500"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="loginPassword"
                          type={showLoginPassword ? "text" : "password"}
                          className={`${fieldClassName} pl-9 pr-10`}
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(event) => setLoginPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((previous) => !previous)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={isLoginSubmitting} className="h-11 w-full rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md">
                      {isLoginSubmitting ? "Signing in\u2026" : "Sign In"}
                    </Button>
                  </form>
                )}

                {loginMethod === "otp" && !loginOtpSent && (
                  <form className="space-y-4" onSubmit={handleSendLoginOtp}>
                    <div className="space-y-1.5">
                      <Label htmlFor="loginOtpMobile" className="text-sm font-semibold text-slate-700">
                        Mobile Number
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="loginOtpMobile"
                          className={`${fieldClassName} pl-9`}
                          placeholder="Enter 10-digit mobile number"
                          value={loginOtpMobile}
                          onChange={(event) => setLoginOtpMobile(normalizeMobile(event.target.value))}
                        />
                      </div>
                      <p className="text-xs text-slate-500">We'll send a 6-digit OTP to this number.</p>
                    </div>
                    <Button type="submit" disabled={isLoginOtpSending} className="h-11 w-full rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md">
                      {isLoginOtpSending ? "Sending OTP\u2026" : "Send OTP"}
                    </Button>
                  </form>
                )}

                {loginMethod === "otp" && loginOtpSent && (
                  <form className="space-y-4" onSubmit={handleVerifyLoginOtp}>
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-emerald-800">OTP sent to ******{loginOtpMobile.slice(-4)}</p>
                        <p className="text-xs text-emerald-600">Valid for 10 minutes.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setLoginOtpSent(false); setLoginOtpCode(""); }}
                        className="shrink-0 text-xs font-bold text-emerald-700 underline hover:text-emerald-600"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="loginOtpCode" className="text-sm font-semibold text-slate-700">
                        Enter 6-Digit OTP
                      </Label>
                      <Input
                        id="loginOtpCode"
                        className={`${fieldClassName} text-center text-xl font-bold tracking-[0.2em]`}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={loginOtpCode}
                        onChange={(event) => setLoginOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </div>
                    <Button type="submit" disabled={isLoginOtpVerifying} className="h-11 w-full rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md">
                      {isLoginOtpVerifying ? "Verifying\u2026" : "Verify & Sign In"}
                    </Button>
                    <p className="text-center text-sm text-slate-500">
                      {loginOtpSeconds > 0
                        ? <>Resend in <span className="font-semibold text-slate-700">{formatTime(loginOtpSeconds)}</span></>
                        : <button type="button" onClick={handleResendLoginOtp} disabled={isLoginOtpSending} className="font-semibold text-emerald-600 hover:text-emerald-500 disabled:opacity-50">{isLoginOtpSending ? "Resending\u2026" : "Resend OTP"}</button>
                      }
                    </p>
                  </form>
                )}
              </div>
            )}

            {/* FORGOT PASSWORD */}
            {showForgotPassword && (
              <div>
                {!forgotOtpSent ? (
                  <form className="space-y-4" onSubmit={handleSendForgotOtp}>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          className={`${fieldClassName} pl-9`}
                          placeholder="Enter 10-digit mobile number"
                          value={forgotMobile}
                          onChange={(event) => setForgotMobile(normalizeMobile(event.target.value))}
                        />
                      </div>
                      <p className="text-xs text-slate-500">We'll send a 6-digit OTP to reset your password.</p>
                    </div>
                    <Button
                      type="submit"
                      disabled={isForgotSubmitting}
                      className="h-11 w-full rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md"
                    >
                      {isForgotSubmitting ? "Sending OTP…" : "Send OTP"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(false); }}
                      className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Back to Sign in
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleForgotReset}>
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-emerald-800">
                          OTP sent to ******{normalizeMobile(forgotMobile).slice(-4)}
                        </p>
                        <p className="text-xs text-emerald-600">Enter OTP and set a new password.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setForgotOtpSent(false); setForgotOtpCode(""); setForgotSeconds(55); }}
                        className="shrink-0 text-xs font-bold text-emerald-700 underline hover:text-emerald-600"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700">Enter 6-Digit OTP</Label>
                      <Input
                        className={`${fieldClassName} text-center text-xl font-bold tracking-[0.2em]`}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={forgotOtpCode}
                        onChange={(event) => setForgotOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700">New Password</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type={showForgotNewPassword ? "text" : "password"}
                          className={`${fieldClassName} pl-9 pr-10`}
                          placeholder="Min 6 chars"
                          value={forgotNewPassword}
                          onChange={(event) => setForgotNewPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotNewPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showForgotNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700">Confirm Password</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type={showForgotConfirmPassword ? "text" : "password"}
                          className={`${fieldClassName} pl-9 pr-10`}
                          placeholder="Re-enter"
                          value={forgotConfirmPassword}
                          onChange={(event) => setForgotConfirmPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotConfirmPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showForgotConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isForgotSubmitting}
                      className="h-11 w-full rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md"
                    >
                      {isForgotSubmitting ? "Resetting…" : "Reset Password"}
                    </Button>

                    <p className="text-center text-sm text-slate-500">
                      {forgotSeconds > 0
                        ? <>Resend in <span className="font-semibold text-slate-700">{formatTime(forgotSeconds)}</span></>
                        : (
                          <button
                            type="button"
                            onClick={handleResendForgotOtp}
                            disabled={isForgotSubmitting}
                            className="font-semibold text-emerald-600 hover:text-emerald-500 disabled:opacity-50"
                          >
                            {isForgotSubmitting ? "Resending…" : "Resend OTP"}
                          </button>
                        )}
                    </p>
                  </form>
                )}
              </div>
            )}

            {/* SIGNUP STEP 1 */}
            {isSignup && !showForgotPassword && signupStep === 1 && (
              <form className="space-y-3" onSubmit={handleStepOneSubmit}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">First Name*</Label>
                    <Input className={fieldClassName} placeholder="First name" value={signupForm.firstName} onChange={(event) => updateSignupField("firstName", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Last Name*</Label>
                    <Input className={fieldClassName} placeholder="Last name" value={signupForm.lastName} onChange={(event) => updateSignupField("lastName", event.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Gender*</Label>
                  <select className={`${fieldClassName} appearance-none`} value={signupForm.gender} onChange={(event) => updateSignupField("gender", event.target.value)}>
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mobile No*</Label>
                  <div className="grid grid-cols-[90px_1fr] gap-2">
                    <select className={`${fieldClassName} appearance-none`} value={signupForm.countryCode} onChange={(event) => updateSignupField("countryCode", event.target.value)}>
                      <option value="+91">+91</option>
                      <option value="+971">+971</option>
                      <option value="+1">+1</option>
                    </select>
                    <Input className={fieldClassName} placeholder="10-digit mobile" value={signupForm.mobile} onChange={(event) => updateSignupField("mobile", normalizeMobile(event.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Email Address*</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input type="email" className={`${fieldClassName} pl-9`} placeholder="your@email.com" value={signupForm.email} onChange={(event) => updateSignupField("email", event.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Password*</Label>
                    <div className="relative">
                      <Input type={showSignupPassword ? "text" : "password"} className={`${fieldClassName} pr-10`} placeholder="Min 6 chars" value={signupForm.password} onChange={(event) => updateSignupField("password", event.target.value)} />
                      <button type="button" onClick={() => setShowSignupPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Confirm*</Label>
                    <div className="relative">
                      <Input type={showConfirmPassword ? "text" : "password"} className={`${fieldClassName} pr-10`} placeholder="Re-enter" value={signupForm.confirmPassword} onChange={(event) => updateSignupField("confirmPassword", event.target.value)} />
                      <button type="button" onClick={() => setShowConfirmPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="h-10 w-full rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md">
                  Continue
                </Button>
              </form>
            )}

            {/* SIGNUP STEP 2 */}
            {isSignup && !showForgotPassword && signupStep === 2 && (
              <form className="space-y-3" onSubmit={handleStepTwoSubmit}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Country*</Label>
                    <select className={`${fieldClassName} appearance-none`} value={signupForm.country} onChange={(event) => { setSignupForm((previous) => ({ ...previous, country: event.target.value, state: "", pin: "", city: "" })); setCityOptions([]); }}>
                      <option value="">Select</option>
                      {countryOptions.map((option) => <option key={option.isoCode} value={option.isoCode}>{option.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">State*</Label>
                    <select className={`${fieldClassName} appearance-none`} value={signupForm.state} onChange={(event) => { updateSignupField("state", event.target.value); updateSignupField("pin", ""); updateSignupField("city", ""); setCityOptions([]); }} disabled={!signupForm.country}>
                      <option value="">Select</option>
                      {availableStates.map((option) => <option key={option.isoCode} value={option.isoCode}>{option.name}</option>)}
                    </select>
                  </div>
                </div>
                {signupForm.country === "IN" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Pin Code*</Label>
                      <Input className={fieldClassName} placeholder="6-digit pin" value={signupForm.pin} onChange={(event) => updateSignupField("pin", event.target.value.replace(/\D/g, "").slice(0, 6))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">City*</Label>
                      <select className={`${fieldClassName} appearance-none`} value={signupForm.city} onChange={(event) => updateSignupField("city", event.target.value)} disabled={isCityLookupLoading || cityOptions.length === 0}>
                        <option value="">{isCityLookupLoading ? "Loading..." : cityOptions.length ? "Select city" : "Enter pin code first"}</option>
                        {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">City*</Label>
                      <Input className={fieldClassName} placeholder="Your city" value={signupForm.city} onChange={(event) => updateSignupField("city", event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Postal Code</Label>
                      <Input className={fieldClassName} placeholder="Postal code" value={signupForm.pin} onChange={(event) => updateSignupField("pin", event.target.value.replace(/\D/g, "").slice(0, 10))} />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Full Address</Label>
                  <textarea
                    className="min-h-[78px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus-visible:border-[rgb(38,72,151)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(38,72,151)]/20"
                    placeholder="House/Flat, Area, Landmark"
                    value={signupForm.fullAddress}
                    onChange={(event) => updateSignupField("fullAddress", event.target.value)}
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Captcha: Solve to continue</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 min-w-[90px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">{captchaChallenge.question}</span>
                    <Input
                      className="h-9"
                      placeholder="Answer"
                      value={signupForm.captchaAnswer}
                      onChange={(event) => updateSignupField("captchaAnswer", event.target.value.replace(/\D/g, "").slice(0, 2))}
                    />
                    <Button type="button" variant="outline" className="h-9 px-3" onClick={() => { setCaptchaChallenge(createCaptchaChallenge()); updateSignupField("captchaAnswer", ""); }}>
                      Refresh
                    </Button>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={signupForm.termsAccepted} onChange={(event) => updateSignupField("termsAccepted", event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                  <span className="text-xs text-slate-500">
                    I agree to the{" "}<span className="font-semibold text-emerald-600">Terms & Conditions</span>{" "}and{" "}<span className="font-semibold text-emerald-600">Privacy Policy</span>.
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button type="button" variant="outline" onClick={() => setSignupStep(1)} className="h-10 rounded-xl border-slate-200">
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" disabled={isOtpSending} className="h-10 rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md">
                    {isOtpSending ? "Sending\u2026" : "Continue"}
                  </Button>
                </div>
              </form>
            )}

            {/* SIGNUP STEP 3 – OTP */}
            {isSignup && !showForgotPassword && signupStep === 3 && (
              <form className="space-y-4" onSubmit={handleSignupSubmit}>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Verification code sent</p>
                    <p className="text-xs text-emerald-600">{signupForm.countryCode} {signupForm.mobile}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Enter 6-Digit OTP</Label>
                  <Input
                    className={`${fieldClassName} text-center text-xl font-bold tracking-[0.2em]`}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <p className="pt-1 text-center text-2xl font-bold text-slate-600">{formatTime(otpSeconds)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline" onClick={() => setSignupStep(2)} className="h-10 rounded-xl border-slate-200">
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" disabled={isSignupSubmitting} className="h-10 rounded-xl bg-[rgb(231,70,35)] hover:bg-[rgb(209,60,30)] font-bold text-white shadow-md">
                    {isSignupSubmitting ? "Creating\u2026" : "Create Account"}
                  </Button>
                </div>
                <p className="text-center text-sm">
                  <button type="button" onClick={handleResendOtp} disabled={otpSeconds > 0 || isOtpSending} className="font-semibold text-emerald-600 disabled:cursor-not-allowed disabled:text-slate-400">
                    {isOtpSending ? "Resending\u2026" : "Resend OTP"}
                  </button>
                </p>
              </form>
            )}

          </div>

          {/* ── FOOTER ── */}
          <div className={`shrink-0 border-t border-slate-100 bg-white text-center ${isSignup && !showForgotPassword ? "px-5 py-3" : "px-7 py-4"}`}>
            <p className={`${isSignup && !showForgotPassword ? "text-xs" : "text-sm"} font-medium text-slate-600`}>
              {showForgotPassword ? (
                <>Remembered your password?{" "}<button type="button" onClick={() => setShowForgotPassword(false)} className="font-bold text-teal-600 hover:text-teal-500">Sign In</button></>
              ) : isSignup ? (
                <>Already have an account?{" "}<button type="button" onClick={handleModeSwitch} className="font-bold text-teal-600 hover:text-teal-500">Sign In</button></>
              ) : (
                <>New to Ednovate?{" "}<button type="button" onClick={handleModeSwitch} className="font-bold text-teal-600 hover:text-teal-500">Create Account</button></>
              )}
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;

