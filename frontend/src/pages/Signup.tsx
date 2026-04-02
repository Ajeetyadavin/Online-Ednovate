import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, KeyRound, Phone, User2, Eye, EyeOff, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Country, State } from "country-state-city";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

const Signup = () => {
  const navigate = useNavigate();
  const { signup, loginWithEmail } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [stateCode, setStateCode] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [city, setCity] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [isCityLookupLoading, setIsCityLookupLoading] = useState(false);
  const [fullAddress, setFullAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaChallenge, setCaptchaChallenge] = useState(() => {
    const left = Math.floor(Math.random() * 8) + 1;
    const right = Math.floor(Math.random() * 8) + 1;
    return { question: `${left} + ${right} = ?`, answer: String(left + right) };
  });

  const countryOptions = useMemo(() => Country.getAllCountries(), []);
  const stateOptions = useMemo(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode);
  }, [countryCode]);
  const selectedCountryName = useMemo(
    () => countryOptions.find((country) => country.isoCode === countryCode)?.name || "",
    [countryOptions, countryCode],
  );
  const selectedStateName = useMemo(
    () => stateOptions.find((state) => state.isoCode === stateCode)?.name || "",
    [stateOptions, stateCode],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadCities = async () => {
      if (countryCode !== "IN") {
        setCityOptions([]);
        setIsCityLookupLoading(false);
        return;
      }
      if (!/^\d{6}$/.test(pinCode)) {
        setCityOptions([]);
        setIsCityLookupLoading(false);
        return;
      }

      setIsCityLookupLoading(true);
      const cities = await fetchIndianCitiesByPin(pinCode, selectedStateName);
      if (isCancelled) return;

      setCityOptions(cities);
      setIsCityLookupLoading(false);

      if (cities.length > 0) {
        setCity((previous) => (cities.includes(previous) ? previous : cities[0]));
      }
    };

    void loadCities();

    return () => {
      isCancelled = true;
    };
  }, [countryCode, pinCode, selectedStateName]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !mobile.trim() || !password.trim() || !confirmPassword.trim()) {
      toast.error("Please fill all required fields.");
      return;
    }

    if (!countryCode || !stateCode) {
      toast.error("Please select country and state.");
      return;
    }

    if (countryCode === "IN") {
      if (!/^\d{6}$/.test(pinCode)) {
        toast.error("Please enter a valid 6-digit pin code.");
        return;
      }
      if (!city.trim()) {
        toast.error("Selected pin code does not match the selected state.");
        return;
      }
    } else if (!city.trim()) {
      toast.error("Please enter city.");
      return;
    }

    if (captchaAnswer.trim() !== captchaChallenge.answer) {
      toast.error("Captcha answer is incorrect.");
      const left = Math.floor(Math.random() * 8) + 1;
      const right = Math.floor(Math.random() * 8) + 1;
      setCaptchaChallenge({ question: `${left} + ${right} = ?`, answer: String(left + right) });
      setCaptchaAnswer("");
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
        country: selectedCountryName,
        state: selectedStateName,
        city,
        pin: pinCode,
        address: fullAddress,
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
                  <label className="text-sm font-medium text-foreground">Country</label>
                  <select
                    value={countryCode}
                    onChange={(event) => {
                      setCountryCode(event.target.value);
                      setStateCode("");
                      setPinCode("");
                      setCity("");
                      setCityOptions([]);
                    }}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select country</option>
                    {countryOptions.map((country) => (
                      <option key={country.isoCode} value={country.isoCode}>{country.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">State</label>
                  <select
                    value={stateCode}
                    onChange={(event) => {
                      setStateCode(event.target.value);
                      setPinCode("");
                      setCity("");
                      setCityOptions([]);
                    }}
                    disabled={!countryCode}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-60"
                  >
                    <option value="">Select state</option>
                    {stateOptions.map((state) => (
                      <option key={state.isoCode} value={state.isoCode}>{state.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {countryCode === "IN" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Pin Code</label>
                    <Input
                      type="text"
                      placeholder="6-digit pin code"
                      value={pinCode}
                      onChange={(event) => setPinCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">City</label>
                    <select
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      disabled={isCityLookupLoading || cityOptions.length === 0}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-60"
                    >
                      <option value="">{isCityLookupLoading ? "Loading..." : cityOptions.length ? "Select city" : "Enter pin code first"}</option>
                      {cityOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">City</label>
                    <Input
                      type="text"
                      placeholder="Enter city"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Postal Code</label>
                    <Input
                      type="text"
                      placeholder="Postal code"
                      value={pinCode}
                      onChange={(event) => setPinCode(event.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Address</label>
                <textarea
                  placeholder="House/Flat, Area, Landmark"
                  value={fullAddress}
                  onChange={(event) => setFullAddress(event.target.value)}
                  className="min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
                />
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

              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Captcha Verification</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 min-w-[90px] items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-bold">
                    {captchaChallenge.question}
                  </span>
                  <Input
                    type="text"
                    placeholder="Answer"
                    value={captchaAnswer}
                    onChange={(event) => setCaptchaAnswer(event.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3"
                    onClick={() => {
                      const left = Math.floor(Math.random() * 8) + 1;
                      const right = Math.floor(Math.random() * 8) + 1;
                      setCaptchaChallenge({ question: `${left} + ${right} = ?`, answer: String(left + right) });
                      setCaptchaAnswer("");
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

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

