import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { toast } from "sonner";
import {
  SESSION_TOKEN_KEY,
  type ActiveSessionConfirmationData,
  fetchProfileApi,
  loginWithEmailApi,
  logoutStudentApi,
  resetPasswordByMobileApi,
  sendLoginOtpApi,
  signupApi,
  verifyStoredOtpApi,
  verifyLoginOtpApi,
  type AuthActionResult,
  type AuthUserProfile,
  type SignupPayload,
} from "@/services/authApi";

interface AuthContextType {
  isLoggedIn: boolean;
  userName: string;
  user: AuthUserProfile | null;
  isProfileLoading: boolean;
  login: (name?: string) => void;
  loginAsUser: (user: AuthUserProfile) => void;
  logout: () => void;
  sendOtp: (mobileNo: string) => Promise<AuthActionResult>;
  verifyOtpCode: (mobileNo: string, otp: string) => Promise<AuthActionResult>;
  resetPassword: (mobileNo: string, password: string, otp: string) => Promise<AuthActionResult>;
  verifyOtpAndLogin: (mobileNo: string, otp: string) => Promise<AuthActionResult>;
  loginWithEmail: (
    email: string,
    password: string,
    options?: { forceLogin?: boolean },
  ) => Promise<AuthActionResult<AuthUserProfile | ActiveSessionConfirmationData>>;
  signup: (payload: SignupPayload) => Promise<AuthActionResult>;
  refreshProfile: () => Promise<AuthActionResult>;
  updateProfile: (updates: Partial<Pick<AuthUserProfile, "name" | "email" | "mobile">>) => AuthActionResult;
}

const STORAGE_KEYS = {
  loggedIn: "ednovate_logged_in",
  userName: "ednovate_user_name",
  user: "ednovate_auth_user",
};
const FORCED_LOGOUT_NOTICE_KEY = "ednovate_forced_logout_notice";

const parseStoredUser = (): AuthUserProfile | null => {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUserProfile>;
    if (!parsed.studentId) {
      return null;
    }

    return {
      studentId: String(parsed.studentId),
      name: parsed.name || "Student",
      email: parsed.email || "",
      mobile: parsed.mobile || "",
      address: parsed.address || "",
      gender: parsed.gender || "",
      country: parsed.country || "",
      state: parsed.state || "",
      city: parsed.city || "",
      pin: parsed.pin || "",
      course: parsed.course || "",
      level: parsed.level || "",
      attemptYear: parsed.attemptYear || "",
    };
  } catch {
    return null;
  }
};

const errorResult = (message: string): AuthActionResult => ({ ok: false, message });

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  userName: "",
  user: null,
  isProfileLoading: false,
  login: () => {},
  loginAsUser: () => {},
  logout: () => {},
  sendOtp: async () => errorResult("Auth provider is not ready."),
  verifyOtpCode: async () => errorResult("Auth provider is not ready."),
  resetPassword: async () => errorResult("Auth provider is not ready."),
  verifyOtpAndLogin: async () => errorResult("Auth provider is not ready."),
  loginWithEmail: async () => errorResult("Auth provider is not ready."),
  signup: async () => errorResult("Auth provider is not ready."),
  refreshProfile: async () => errorResult("Auth provider is not ready."),
  updateProfile: () => errorResult("Auth provider is not ready."),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const initialUser = parseStoredUser();
  const [user, setUser] = useState<AuthUserProfile | null>(initialUser);
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem(STORAGE_KEYS.loggedIn) === "true" || Boolean(initialUser),
  );
  const [userName, setUserName] = useState(
    () => initialUser?.name || localStorage.getItem(STORAGE_KEYS.userName) || "Student",
  );
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const sessionAlertShownRef = useRef(false);

  const applyUser = useCallback((nextUser: AuthUserProfile) => {
    const safeName = nextUser.name || "Student";
    const normalizedUser: AuthUserProfile = {
      studentId: String(nextUser.studentId),
      name: safeName,
      email: nextUser.email || "",
      mobile: nextUser.mobile || "",
      address: nextUser.address || "",
      gender: nextUser.gender || "",
      country: nextUser.country || "",
      state: nextUser.state || "",
      city: nextUser.city || "",
      pin: nextUser.pin || "",
      course: nextUser.course || "",
      level: nextUser.level || "",
      attemptYear: nextUser.attemptYear || "",
    };

    setUser(normalizedUser);
    setUserName(safeName);
    setIsLoggedIn(true);
    localStorage.setItem(STORAGE_KEYS.loggedIn, "true");
    localStorage.setItem(STORAGE_KEYS.userName, safeName);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalizedUser));
  }, []);

  const login = (name?: string) => {
    applyUser({
      studentId: user?.studentId || "",
      name: name || user?.name || "Student",
      email: user?.email || "",
      mobile: user?.mobile || "",
      address: user?.address || "",
      gender: user?.gender || "",
      country: user?.country || "",
      state: user?.state || "",
      city: user?.city || "",
      pin: user?.pin || "",
      course: user?.course || "",
      level: user?.level || "",
      attemptYear: user?.attemptYear || "",
    });
  };

  const loginAsUser = (nextUser: AuthUserProfile) => {
    applyUser(nextUser);
  };

  const logout = () => {
    void logoutStudentApi();
    setIsLoggedIn(false);
    setUserName("");
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.loggedIn);
    localStorage.removeItem(STORAGE_KEYS.userName);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    sessionAlertShownRef.current = false;
  };

  useEffect(() => {
    if (!isLoggedIn || !user?.studentId) return;

    let mounted = true;

    const checkSession = async () => {
      const token = localStorage.getItem(SESSION_TOKEN_KEY) || "";
      if (!token) return;

      try {
        const response = await fetch("/api/auth/student/session-status", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) return;

        const payload = await response.json().catch(() => ({} as { message?: string }));
        if (!mounted) return;

        const message = String(payload?.message || "Student login detected from another place. You have been logged out.");
        if (!sessionAlertShownRef.current) {
          sessionAlertShownRef.current = true;
          localStorage.setItem(
            FORCED_LOGOUT_NOTICE_KEY,
            JSON.stringify({
              message,
              at: new Date().toISOString(),
              audience: "student",
            }),
          );
          toast.error(message);
        }
        logout();
      } catch {
        // Ignore temporary network errors; next poll retries.
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
  }, [isLoggedIn, user?.studentId]);

  const refreshProfile = useCallback(async (): Promise<AuthActionResult> => {
    if (!user?.studentId) {
      return errorResult("No logged in user found.");
    }

    setIsProfileLoading(true);
    try {
      const profileResult = await fetchProfileApi(user.studentId);
      if (!profileResult.ok) {
        return { ok: false, message: profileResult.message };
      }

      const profile = profileResult.data || {};
      applyUser({
        studentId: user.studentId,
        name: profile.name || user.name || "Student",
        email: profile.email || user.email || "",
        mobile: profile.mobile || user.mobile || "",
        gender: profile.gender || user.gender || "",
        country: profile.country || user.country || "",
        state: profile.state || user.state || "",
        city: profile.city || user.city || "",
        pin: profile.pin || user.pin || "",
        course: profile.course || user.course || "",
        level: profile.level || user.level || "",
        attemptYear: profile.attemptYear || user.attemptYear || "",
      });

      return { ok: true, message: profileResult.message };
    } finally {
      setIsProfileLoading(false);
    }
  }, [applyUser, user?.studentId, user?.name, user?.email, user?.mobile]);

  const sendOtp = async (mobileNo: string): Promise<AuthActionResult> => {
    return sendLoginOtpApi(mobileNo);
  };

  const verifyOtpCode = async (mobileNo: string, otp: string): Promise<AuthActionResult> => {
    return verifyStoredOtpApi(mobileNo, otp);
  };

  const resetPassword = async (mobileNo: string, password: string, otp: string): Promise<AuthActionResult> => {
    return resetPasswordByMobileApi(mobileNo, password, otp);
  };

  const verifyOtpAndLogin = async (mobileNo: string, otp: string): Promise<AuthActionResult> => {
    const verifyResult = await verifyLoginOtpApi(mobileNo, otp);
    if (!verifyResult.ok || !verifyResult.data?.studentId) {
      return { ok: verifyResult.ok, message: verifyResult.message };
    }

    const baseUser: AuthUserProfile = {
      studentId: verifyResult.data.studentId,
      name: "Student",
      email: "",
      mobile: mobileNo,
      gender: "",
      country: "",
      state: "",
      city: "",
      pin: "",
      course: "",
      level: "",
      attemptYear: "",
    };

    setIsProfileLoading(true);
    try {
      const profileResult = await fetchProfileApi(baseUser.studentId);
      if (profileResult.ok) {
        const profile = profileResult.data || {};
        applyUser({
          studentId: baseUser.studentId,
          name: profile.name || baseUser.name,
          email: profile.email || baseUser.email,
          mobile: profile.mobile || baseUser.mobile,
          gender: profile.gender || baseUser.gender,
          country: profile.country || baseUser.country,
          state: profile.state || baseUser.state,
          city: profile.city || baseUser.city,
          pin: profile.pin || baseUser.pin,
          course: profile.course || baseUser.course,
          level: profile.level || baseUser.level,
          attemptYear: profile.attemptYear || baseUser.attemptYear,
        });
      } else {
        applyUser(baseUser);
      }
    } finally {
      setIsProfileLoading(false);
    }

    return { ok: true, message: verifyResult.message };
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    options?: { forceLogin?: boolean },
  ): Promise<AuthActionResult<AuthUserProfile | ActiveSessionConfirmationData>> => {
    const loginResult = await loginWithEmailApi(email, password, options);
    if (!loginResult.ok || !loginResult.data) {
      return loginResult;
    }

    const maybeConfirmation = loginResult.data as ActiveSessionConfirmationData;
    if (maybeConfirmation.requiresConfirmation === true) {
      return {
        ok: false,
        message: loginResult.message || "This account is already active on another device.",
        data: maybeConfirmation,
      };
    }

    const profileCandidate = loginResult.data as Partial<AuthUserProfile> & {
      id?: string | number;
      student_id?: string | number;
      userId?: string | number;
      user_id?: string | number;
    };

    const resolvedStudentId = String(
      profileCandidate.studentId ||
      profileCandidate.student_id ||
      profileCandidate.userId ||
      profileCandidate.user_id ||
      profileCandidate.id ||
      "",
    ).trim();

    if (!resolvedStudentId) {
      const profileResult = await fetchProfileApi();
      if (profileResult.ok) {
        const hydratedProfile = (profileResult.data || {}) as Partial<AuthUserProfile> & {
          id?: string | number;
          student_id?: string | number;
          userId?: string | number;
          user_id?: string | number;
        };
        const hydratedStudentId = String(
          hydratedProfile.studentId ||
            hydratedProfile.student_id ||
            hydratedProfile.userId ||
            hydratedProfile.user_id ||
            hydratedProfile.id ||
            "",
        ).trim();

        if (hydratedStudentId) {
          const hydratedUser: AuthUserProfile = {
            studentId: hydratedStudentId,
            name: hydratedProfile.name || profileCandidate.name || "Student",
            email: hydratedProfile.email || profileCandidate.email || email,
            mobile: hydratedProfile.mobile || profileCandidate.mobile || "",
            address: hydratedProfile.address || profileCandidate.address || "",
            gender: hydratedProfile.gender || profileCandidate.gender || "",
            country: hydratedProfile.country || profileCandidate.country || "",
            state: hydratedProfile.state || profileCandidate.state || "",
            city: hydratedProfile.city || profileCandidate.city || "",
            pin: hydratedProfile.pin || profileCandidate.pin || "",
            course: hydratedProfile.course || profileCandidate.course || "",
            level: hydratedProfile.level || profileCandidate.level || "",
            attemptYear: hydratedProfile.attemptYear || profileCandidate.attemptYear || "",
          };

          applyUser(hydratedUser);
          return { ok: true, message: loginResult.message || "Login successful.", data: hydratedUser };
        }
      }

      return {
        ok: false,
        message: profileResult.ok
          ? loginResult.message || "Login failed. Please try again."
          : profileResult.message || loginResult.message || "Login failed. Please try again.",
      };
    }

    const baseUser: AuthUserProfile = {
      studentId: resolvedStudentId,
      name: profileCandidate.name || "Student",
      email: profileCandidate.email || email,
      mobile: profileCandidate.mobile || "",
      address: profileCandidate.address || "",
      gender: profileCandidate.gender || "",
      country: profileCandidate.country || "",
      state: profileCandidate.state || "",
      city: profileCandidate.city || "",
      pin: profileCandidate.pin || "",
      course: profileCandidate.course || "",
      level: profileCandidate.level || "",
      attemptYear: profileCandidate.attemptYear || "",
    };

    setIsProfileLoading(true);
    try {
      const profileResult = await fetchProfileApi(baseUser.studentId);
      if (profileResult.ok) {
        const profile = (profileResult.data || {}) as Partial<AuthUserProfile> & {
          id?: string | number;
          student_id?: string | number;
          userId?: string | number;
          user_id?: string | number;
        };
        const resolvedStudentId = String(
          profile.studentId ||
            profile.student_id ||
            profile.userId ||
            profile.user_id ||
            profile.id ||
            baseUser.studentId ||
            "",
        );
        applyUser({
          studentId: resolvedStudentId,
          name: profile.name || baseUser.name,
          email: profile.email || baseUser.email,
          mobile: profile.mobile || baseUser.mobile,
          address: profile.address || baseUser.address,
          gender: profile.gender || baseUser.gender,
          country: profile.country || baseUser.country,
          state: profile.state || baseUser.state,
          city: profile.city || baseUser.city,
          pin: profile.pin || baseUser.pin,
          course: profile.course || baseUser.course,
          level: profile.level || baseUser.level,
          attemptYear: profile.attemptYear || baseUser.attemptYear,
        });
      } else {
        applyUser(baseUser);
      }
    } finally {
      setIsProfileLoading(false);
    }

    return { ok: true, message: loginResult.message };
  };

  const signup = async (payload: SignupPayload): Promise<AuthActionResult> => {
    return signupApi(payload);
  };

  const updateProfile = (
    updates: Partial<Pick<AuthUserProfile, "name" | "email" | "mobile">>,
  ): AuthActionResult => {
    if (!user) {
      return errorResult("No logged in user found.");
    }

    const nextName = updates.name?.trim() || user.name || "Student";
    const nextEmail = updates.email?.trim() ?? user.email;
    const nextMobile = updates.mobile?.trim() ?? user.mobile;

    applyUser({
      studentId: user.studentId,
      name: nextName,
      email: nextEmail,
      mobile: nextMobile,
    });

    return {
      ok: true,
      message: "Profile updated successfully.",
    };
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        userName,
        user,
        isProfileLoading,
        login,
        loginAsUser,
        logout,
        sendOtp,
        verifyOtpCode,
        resetPassword,
        verifyOtpAndLogin,
        loginWithEmail,
        signup,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
