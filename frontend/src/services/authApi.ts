export interface AuthUserProfile {
  studentId: string;
  name: string;
  email: string;
  mobile: string;
  address?: string;
  gender?: string;
  country?: string;
  state?: string;
  city?: string;
  pin?: string;
  course?: string;
  level?: string;
  attemptYear?: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  mobile: string;
  password: string;
  gender?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  pin?: string;
  course?: string;
  level?: string;
  attemptYear?: string;
}

export interface AuthActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
}

export interface ActiveSessionConfirmationData {
  requiresConfirmation: true;
  reason?: string;
  activeSession?: {
    ipAddress?: string | null;
    loginAt?: string | null;
  };
}

type LoginWithEmailOptions = {
  forceLogin?: boolean;
};

interface StoredAuthUser extends AuthUserProfile {
  password: string;
}

const USERS_STORAGE_KEY = "ednovate_auth_users";
export const SESSION_TOKEN_KEY = "ednovate_session_token";

const parseJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const getUsers = (): StoredAuthUser[] => parseJson<StoredAuthUser[]>(USERS_STORAGE_KEY, []);

const saveUsers = (users: StoredAuthUser[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const generateStudentId = () => `EDN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeMobile = (mobile: string) => mobile.replace(/\D/g, "").slice(-10);
const sanitizeText = (value: string | undefined) => value?.trim() || "";

const toStudentId = (rawUser: Record<string, unknown> | null | undefined) => {
  if (!rawUser) return "";
  return String(
    (rawUser.studentId as string | number | undefined) ||
      (rawUser.student_id as string | number | undefined) ||
      (rawUser.id as string | number | undefined) ||
      "",
  );
};

const toAuthUserProfile = (rawUser: Record<string, unknown>): AuthUserProfile => ({
  studentId: toStudentId(rawUser),
  name: String((rawUser.name as string | undefined) || ""),
  email: String((rawUser.email as string | undefined) || ""),
  mobile: String((rawUser.mobile as string | undefined) || ""),
  address: String((rawUser.address as string | undefined) || ""),
  gender: String((rawUser.gender as string | undefined) || ""),
  country: String((rawUser.country as string | undefined) || ""),
  state: String((rawUser.state as string | undefined) || ""),
  city: String((rawUser.city as string | undefined) || ""),
  pin: String(
    (rawUser.pin as string | number | undefined) ||
      (rawUser.pincode as string | number | undefined) ||
      (rawUser.postalCode as string | number | undefined) ||
      (rawUser.postal_code as string | number | undefined) ||
      "",
  ),
  course: String((rawUser.course as string | undefined) || ""),
  level: String((rawUser.level as string | undefined) || (rawUser.education_level as string | undefined) || ""),
  attemptYear: String((rawUser.attemptYear as string | undefined) || (rawUser.attempt_year as string | undefined) || ""),
});

const extractStudentProfileCandidate = (payload: unknown): AuthUserProfile | null => {
  if (!payload || typeof payload !== "object") return null;

  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = current as Record<string, unknown>;
    const candidates = [node.user, node.student, node.profile, node];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const user = toAuthUserProfile(candidate as Record<string, unknown>);
      if (user.studentId) {
        return user;
      }
    }

    Object.values(node).forEach((value) => {
      if (value && typeof value === "object") queue.push(value);
    });
  }

  return null;
};

const parseStudentSessionPayload = (payload: unknown): { token: string; user: AuthUserProfile } | null => {
  if (!payload || typeof payload !== "object") return null;

  const findDeepSession = (input: unknown): { token: string; rawUser: Record<string, unknown> } | null => {
    const queue: unknown[] = [input];
    const visited = new Set<unknown>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== "object") continue;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = current as Record<string, unknown>;
      const token = String(node.token || node.accessToken || node.sessionToken || "").trim();
      const directUser = node.user || node.student || node.profile;
      if (token && directUser && typeof directUser === "object") {
        return { token, rawUser: directUser as Record<string, unknown> };
      }

      const hasIdentity = Boolean(node.studentId || node.student_id || node.id || node.email || node.mobile);
      if (token && hasIdentity) {
        return { token, rawUser: node };
      }

      Object.values(node).forEach((value) => {
        if (value && typeof value === "object") queue.push(value);
      });
    }

    return null;
  };

  const parsed = payload as {
    token?: unknown;
    accessToken?: unknown;
    sessionToken?: unknown;
    user?: Record<string, unknown>;
    student?: Record<string, unknown>;
    profile?: Record<string, unknown>;
    data?: {
      token?: unknown;
      accessToken?: unknown;
      sessionToken?: unknown;
      user?: Record<string, unknown>;
      student?: Record<string, unknown>;
      profile?: Record<string, unknown>;
    };
  };

  const token = String(
    parsed.token ||
      parsed.accessToken ||
      parsed.sessionToken ||
      parsed.data?.token ||
      parsed.data?.accessToken ||
      parsed.data?.sessionToken ||
      "",
  );

  const fallbackRootUser = (() => {
    const candidate = parsed as Record<string, unknown>;
    const hasIdentity = Boolean(candidate.studentId || candidate.student_id || candidate.id || candidate.email || candidate.mobile);
    return hasIdentity ? candidate : null;
  })();

  const rawUser = parsed.user || parsed.student || parsed.profile || parsed.data?.user || parsed.data?.student || parsed.data?.profile || fallbackRootUser;
  if (!token || !rawUser) return null;

  const normalizedRawUser = (() => {
    const candidate = rawUser as Record<string, unknown>;
    const hasIdentity = Boolean(candidate.studentId || candidate.student_id || candidate.id || candidate.email || candidate.mobile);
    if (hasIdentity) return candidate;
    const nested = candidate.user || candidate.student || candidate.profile;
    if (nested && typeof nested === "object") {
      return nested as Record<string, unknown>;
    }
    return candidate;
  })();

  const user = toAuthUserProfile(normalizedRawUser);
  if (!user.studentId) {
    const deep = findDeepSession(payload);
    if (!deep) return null;
    const deepUser = toAuthUserProfile(deep.rawUser);
    if (!deepUser.studentId) return null;
    return { token: deep.token, user: deepUser };
  }

  return { token, user };
};

const getToken = () => localStorage.getItem(SESSION_TOKEN_KEY) || "";

const authHeaders = (includeJson = true): Record<string, string> => {
  const token = getToken();
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseResponseMessage = async (
  response: Response,
  fallback: string,
  options?: { allowNotModified?: boolean },
) => {
  const payload = response.status === 304 ? {} : await response.json().catch(() => ({}));
  const payloadMessage = (payload as { message?: unknown })?.message;
  const ok = response.ok || (options?.allowNotModified === true && response.status === 304);
  return {
    ok,
    payload,
    message:
      typeof payloadMessage === "string" && payloadMessage.trim().length > 0
        ? payloadMessage
        : ok
          ? ""
          : fallback,
  };
};

const fetchStudentProfileResponse = async (token: string) => {
  const sendRequest = (cacheBust: boolean) =>
    fetch(cacheBust ? `/api/auth/student/profile?_=${Date.now()}` : "/api/auth/student/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

  const initialResponse = await sendRequest(false);
  if (initialResponse.status !== 304) {
    return initialResponse;
  }

  return sendRequest(true);
};

export const signupApi = async (payload: SignupPayload): Promise<AuthActionResult> => {
  try {
    const response = await fetch("/api/auth/student/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        email: normalizeEmail(payload.email || ""),
        mobile: normalizeMobile(payload.mobile || ""),
        password: payload.password,
        city: sanitizeText(payload.city),
        state: sanitizeText(payload.state),
        country: sanitizeText(payload.country),
        pin: sanitizeText(payload.pin),
        address: sanitizeText(payload.address),
        level: sanitizeText(payload.level),
      }),
    });
    const parsed = await parseResponseMessage(response, "Signup failed.");
    return { ok: parsed.ok, message: parsed.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Signup failed." };
  }
};

export const loginWithEmailApi = async (
  emailOrMobile: string,
  password: string,
  options?: LoginWithEmailOptions,
): Promise<AuthActionResult<AuthUserProfile | ActiveSessionConfirmationData>> => {
  try {
    const response = await fetch("/api/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: emailOrMobile, password, forceLogin: options?.forceLogin === true }),
    });
    const parsed = await parseResponseMessage(response, "Login failed.");
    const requiresConfirmation = (parsed.payload as { requiresConfirmation?: boolean })?.requiresConfirmation === true;
    if (requiresConfirmation) {
      return {
        ok: false,
        message: parsed.message,
        data: {
          requiresConfirmation: true,
          reason: String((parsed.payload as { reason?: string })?.reason || "active_session_exists"),
          activeSession: {
            ipAddress: (parsed.payload as { activeSession?: { ipAddress?: string | null } })?.activeSession?.ipAddress || null,
            loginAt: (parsed.payload as { activeSession?: { loginAt?: string | null } })?.activeSession?.loginAt || null,
          },
        },
      };
    }

    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    const session = parseStudentSessionPayload(parsed.payload);
    if (!session) {
      const extractTokenDeep = (input: unknown): string => {
        const queue: unknown[] = [input];
        const visited = new Set<unknown>();

        while (queue.length > 0) {
          const current = queue.shift();
          if (!current || typeof current !== "object") continue;
          if (visited.has(current)) continue;
          visited.add(current);

          const node = current as Record<string, unknown>;
          const token = String(node.token || node.accessToken || node.sessionToken || "").trim();
          if (token) return token;

          Object.values(node).forEach((value) => {
            if (value && typeof value === "object") queue.push(value);
          });
        }

        return "";
      };

      const fallbackToken = extractTokenDeep(parsed.payload);
      if (!fallbackToken) {
        return { ok: false, message: parsed.message || "Login failed. Please try again." };
      }

      localStorage.setItem(SESSION_TOKEN_KEY, fallbackToken);

      const payloadUser = extractStudentProfileCandidate(parsed.payload);
      if (payloadUser?.studentId) {
        return {
          ok: true,
          message: parsed.message || "Login successful.",
          data: payloadUser,
        };
      }

      const profileResponse = await fetchStudentProfileResponse(fallbackToken);
      const profileParsed = await parseResponseMessage(profileResponse, "Profile not found.", {
        allowNotModified: true,
      });
      if (!profileParsed.ok) {
        return { ok: false, message: profileParsed.message || parsed.message || "Login failed. Please try again." };
      }

      const profilePayload = profileParsed.payload as {
        user?: Record<string, unknown>;
        student?: Record<string, unknown>;
        profile?: Record<string, unknown>;
      };
      const profileUserRaw = profilePayload.user || profilePayload.student || profilePayload.profile;
      const profileUser = profileUserRaw ? toAuthUserProfile(profileUserRaw) : null;
      if (!profileUser?.studentId) {
        return { ok: false, message: parsed.message || "Login failed. Please try again." };
      }

      return {
        ok: true,
        message: parsed.message || "Login successful.",
        data: profileUser,
      };
    }

    localStorage.setItem(SESSION_TOKEN_KEY, session.token);
    return {
      ok: true,
      message: parsed.message || "Login successful.",
      data: session.user,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Login failed." };
  }
};

export const sendLoginOtpApi = async (
  mobileNo: string,
  purpose: "login" | "signup" | "reset" | "auth" = "auth",
): Promise<AuthActionResult> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Please enter a valid mobile number." };
  }

  try {
    const response = await fetch("/api/auth/student/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, purpose }),
    });
    const parsed = await parseResponseMessage(response, "Failed to send OTP.");
    return { ok: parsed.ok, message: parsed.message || (parsed.ok ? "OTP sent successfully." : "Failed to send OTP.") };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to send OTP." };
  }
};

export const verifyLoginOtpApi = async (
  mobileNo: string,
  otp: string,
): Promise<AuthActionResult<{ studentId: string }>> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Invalid mobile number." };
  }

  const enteredOtp = String(otp || "").trim();
  if (!enteredOtp) {
    return { ok: false, message: "Invalid OTP." };
  }

  try {
      const response = await fetch("/api/auth/student/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp: enteredOtp, login: true, purpose: "login" }),
    });
    const parsed = await parseResponseMessage(response, "Invalid OTP.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    const session = parseStudentSessionPayload(parsed.payload);
    if (!session) {
      return { ok: false, message: "Invalid OTP login response." };
    }

    localStorage.setItem(SESSION_TOKEN_KEY, session.token);

    return {
      ok: true,
      message: parsed.message || "OTP verified successfully.",
      data: { studentId: session.user.studentId },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invalid OTP." };
  }
};

export const verifyStoredOtpApi = async (
  mobileNo: string,
  otp: string,
): Promise<AuthActionResult> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Invalid mobile number." };
  }

  const enteredOtp = String(otp || "").trim();
  if (!enteredOtp) {
    return { ok: false, message: "Invalid OTP." };
  }

  try {
      const response = await fetch("/api/auth/student/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp: enteredOtp, login: false, purpose: "signup" }),
    });
    const parsed = await parseResponseMessage(response, "Invalid OTP.");
    return { ok: parsed.ok, message: parsed.message || (parsed.ok ? "OTP verified successfully." : "Invalid OTP.") };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invalid OTP." };
  }
};

export const resetPasswordByMobileApi = async (
  mobileNo: string,
  password: string,
  otp: string,
): Promise<AuthActionResult> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Invalid mobile number." };
  }

  const sanitizedOtp = String(otp || "").trim();
  if (!/^\d{4,8}$/.test(sanitizedOtp)) {
    return { ok: false, message: "Valid OTP is required." };
  }

  if (!password || password.trim().length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }

  try {
      const response = await fetch("/api/auth/student/reset-password-mobile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, password: password.trim(), otp: sanitizedOtp, purpose: "reset" }),
    });
    const parsed = await parseResponseMessage(response, "Password reset failed.");
    return {
      ok: parsed.ok,
      message:
        parsed.message ||
        (parsed.ok
          ? "Password reset successful. Please login with your new password."
          : "Password reset failed."),
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Password reset failed." };
  }
};

export const logoutStudentApi = async (): Promise<void> => {
  const token = getToken();
  if (!token) return;

  try {
    await fetch("/api/auth/student/logout", {
      method: "POST",
      headers: authHeaders(false),
      keepalive: true,
    });
  } catch {
    // Ignore logout transport errors; local cleanup still happens.
  }
};

export const fetchProfileApi = async (
  _studentId?: string,
): Promise<AuthActionResult<Partial<AuthUserProfile>>> => {
  try {
    const token = getToken();
    const response = token
      ? await fetchStudentProfileResponse(token)
      : await fetch("/api/auth/student/profile", {
          headers: authHeaders(false),
          cache: "no-store",
        });
    const parsed = await parseResponseMessage(response, "Profile not found.", {
      allowNotModified: true,
    });
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    const user = (parsed.payload as { user?: Partial<AuthUserProfile> })?.user;
    return {
      ok: true,
      message: "Profile loaded.",
      data: user || {},
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Profile not found." };
  }
};

export interface StudentCourseAccessSelf {
  id: number;
  studentId: string;
  courseId: string;
  courseTitle: string;
  purchaseDate?: string;
  durationDays: number;
  expiresAt?: string;
  totalViews: number;
  usedViews: number;
  remainingViews: number;
  isUnlimitedViews?: boolean;
  courseDurationSeconds?: number;
  allowedWatchSeconds?: number;
  usedWatchSeconds?: number;
  remainingWatchSeconds?: number;
  isEnabled: boolean;
  preferredVideoQuality?: "auto" | "high" | "medium" | "low";
  createdAt?: string;
}

export interface StudentLessonCompleteResult {
  consumedView: boolean;
  access: StudentCourseAccessSelf;
  accessActive: boolean;
}

export interface StudentWatchProgressResult {
  consumedSeconds: number;
  access: StudentCourseAccessSelf;
  accessActive: boolean;
}

export interface StudentLessonNoteResult {
  noteText: string;
  updatedAt?: string | null;
}

export interface StudentDashboardData {
  student: AuthUserProfile;
  courseAccess: StudentCourseAccessSelf[];
  loginLogs: Array<{ id: number; createdAt: string; source?: string; ipAddress?: string; userAgent?: string }>;
  notifications: Array<{ id: number; channel: string; subject?: string; message: string; status: string; createdAt: string }>;
  videoActivity: Array<{ id: number; courseId?: string; chapterTitle?: string; lessonTitle?: string; progressPercent: number; viewedSeconds: number; lastViewedAt: string }>;
  orders: Array<{
    id: string;
    date: string;
    status: string;
    dispatchStatus?: string;
    trackingId?: string;
    dispatchNote?: string;
    paymentMethod?: string;
    total: number;
    items: Array<{
      id?: number;
      courseId?: string;
      title: string;
      price: number;
      itemType?: string;
      modeLabel?: string;
      bookLabel?: string;
      isEbook?: boolean;
      dispatchStatus?: string;
      trackingId?: string;
    }>;
  }>;
}

export interface StudentTestAttemptReport {
  id: string;
  paperId: string;
  paperTitle: string;
  submittedAt: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  scorePercent: number;
  timeTakenSeconds: number;
  questions?: Array<{
    questionNo: number;
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    status: "correct" | "wrong" | "not_attempted";
  }>;
}

export interface StudentOrderLine {
  id: number;
  orderId: string;
  studentId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  shippingPincode?: string;
  courseId: string;
  courseTitle: string;
  parentPackageId?: string;
  parentPackageTitle?: string;
  packageCourseIds?: string[];
  orderDate?: string;
  paymentMethod?: string;
  amount: number;
  currency: string;
  status: string;
  itemType: string;
  modeLabel?: string;
  bookLabel?: string;
  isEbook: boolean;
  dispatchStatus: string;
  trackingId?: string;
  dispatchNote?: string;
  dispatchedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentOrderGroup {
  id: string;
  date: string;
  status: string;
  dispatchStatus?: string;
  trackingId?: string;
  dispatchNote?: string;
  paymentMethod?: string;
  total: number;
  items: Array<{
    id?: number;
    courseId?: string;
    title: string;
    price: number;
    itemType?: string;
    modeLabel?: string;
    bookLabel?: string;
    isEbook?: boolean;
    dispatchStatus?: string;
    trackingId?: string;
  }>;
}

export const getStudentDashboardApi = async (): Promise<AuthActionResult<StudentDashboardData>> => {
  try {
    const response = await fetch("/api/auth/student/dashboard", { headers: authHeaders(false) });
    const parsed = await parseResponseMessage(response, "Failed to load dashboard.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }
    return {
      ok: true,
      message: "Dashboard loaded.",
      data: parsed.payload as StudentDashboardData,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load dashboard." };
  }
};

export const getStudentTestAttemptsApi = async (): Promise<AuthActionResult<StudentTestAttemptReport[]>> => {
  try {
    const response = await fetch("/api/auth/student/test-attempts", { headers: authHeaders(false) });
    const parsed = await parseResponseMessage(response, "Failed to load test attempts.");
    if (!parsed.ok) return { ok: false, message: parsed.message };
    const payload = parsed.payload as { items?: StudentTestAttemptReport[] };
    return { ok: true, message: "Test attempts loaded.", data: Array.isArray(payload.items) ? payload.items : [] };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load test attempts." };
  }
};

export const saveStudentTestAttemptApi = async (report: StudentTestAttemptReport): Promise<AuthActionResult<{ id: string }>> => {
  try {
    const response = await fetch("/api/auth/student/test-attempts", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ report }),
    });
    const parsed = await parseResponseMessage(response, "Failed to save test attempt.");
    if (!parsed.ok) return { ok: false, message: parsed.message };
    return { ok: true, message: "Test attempt saved.", data: parsed.payload as { id: string } };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to save test attempt." };
  }
};

export const updateStudentProfileApi = async (
  updates: Partial<Pick<AuthUserProfile, "name" | "email" | "mobile" | "address" | "country" | "state" | "city" | "pin">>,
): Promise<AuthActionResult<AuthUserProfile>> => {
  try {
    const response = await fetch("/api/auth/student/profile", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    const parsed = await parseResponseMessage(response, "Failed to update profile.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }
    return {
      ok: true,
      message: "Profile updated successfully.",
      data: (parsed.payload as { user: AuthUserProfile }).user,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to update profile." };
  }
};

export const changeStudentPasswordApi = async (
  currentPassword: string,
  newPassword: string,
): Promise<AuthActionResult> => {
  try {
    const response = await fetch("/api/auth/student/change-password", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const parsed = await parseResponseMessage(response, "Failed to change password.");
    return { ok: parsed.ok, message: parsed.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to change password." };
  }
};

export const getStudentCourseAccessApi = async (): Promise<AuthActionResult<StudentCourseAccessSelf[]>> => {
  try {
    const response = await fetch("/api/auth/student/course-access", { headers: authHeaders(false) });
    const parsed = await parseResponseMessage(response, "Failed to load course access.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }
    const items = (parsed.payload as { items?: StudentCourseAccessSelf[] })?.items || [];
    return { ok: true, message: "Loaded", data: items };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load course access." };
  }
};

export const updateStudentCourseVideoQualityApi = async (payload: {
  courseId: string;
  preferredVideoQuality: "auto" | "high" | "medium" | "low";
}): Promise<AuthActionResult<StudentCourseAccessSelf>> => {
  try {
    const response = await fetch(
      `/api/auth/student/course-access/${encodeURIComponent(payload.courseId)}/video-quality`,
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ preferredVideoQuality: payload.preferredVideoQuality }),
      },
    );
    const parsed = await parseResponseMessage(response, "Failed to update video quality setting.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    const item = (parsed.payload as { item?: StudentCourseAccessSelf })?.item;
    return {
      ok: true,
      message: "Saved",
      data: item,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to update video quality setting." };
  }
};

export const recordStudentVideoActivityApi = async (payload: {
  courseId: string;
  chapterTitle?: string;
  lessonTitle?: string;
  progressPercent?: number;
  viewedSeconds?: number;
}): Promise<AuthActionResult> => {
  try {
    const response = await fetch("/api/auth/student/video-activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseMessage(response, "Failed to log activity.");
    return { ok: parsed.ok, message: parsed.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to log activity." };
  }
};

export const syncStudentWatchProgressApi = async (payload: {
  courseId: string;
  chapterTitle?: string;
  lessonTitle?: string;
  progressPercent?: number;
  watchedSeconds: number;
}): Promise<AuthActionResult<StudentWatchProgressResult>> => {
  try {
    const response = await fetch("/api/auth/student/watch-progress", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseMessage(response, "Failed to sync watch progress.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    return {
      ok: true,
      message: parsed.message,
      data: parsed.payload as StudentWatchProgressResult,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to sync watch progress." };
  }
};

export const createStudentPurchaseApi = async (payload: {
  orderId?: string;
  paymentMethod?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  shippingPincode?: string;
  subtotal?: number;
  couponDiscount?: number;
  taxAmount?: number;
  total?: number;
  items: Array<{
    courseId: string;
    courseTitle: string;
    parentPackageId?: string;
    parentPackageTitle?: string;
    packageCourseIds?: string[];
    durationDays?: number;
    expiresAt?: string;
    totalViews?: number;
    isUnlimitedViews?: boolean;
    usedViews?: number;
    isEnabled?: boolean;
    baseAmount?: number;
    taxAmount?: number;
    amount?: number;
    modeLabel?: string;
    bookLabel?: string;
    itemType?: string;
    isEbook?: boolean;
    grantAccess?: boolean;
    createOrderLine?: boolean;
  }>;
  purchaseDate?: string;
}): Promise<AuthActionResult> => {
  try {
    const response = await fetch("/api/auth/student/purchase", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseMessage(response, "Failed to save purchase.");
    return { ok: parsed.ok, message: parsed.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to save purchase." };
  }
};

export const getStudentOrdersApi = async (courseId?: string): Promise<AuthActionResult<{ lines: StudentOrderLine[]; grouped: StudentOrderGroup[] }>> => {
  try {
    const query = new URLSearchParams();
    if (courseId) query.set("courseId", courseId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await fetch(`/api/auth/student/orders${suffix}`, { headers: authHeaders(false) });
    const parsed = await parseResponseMessage(response, "Failed to load order history.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }
    const payload = parsed.payload as { lines?: StudentOrderLine[]; grouped?: StudentOrderGroup[] };
    return {
      ok: true,
      message: "Order history loaded.",
      data: {
        lines: Array.isArray(payload.lines) ? payload.lines : [],
        grouped: Array.isArray(payload.grouped) ? payload.grouped : [],
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load order history." };
  }
};

export const completeStudentLessonApi = async (payload: {
  courseId: string;
  lessonId: string;
  chapterTitle?: string;
  lessonTitle: string;
  viewedSeconds?: number;
}): Promise<AuthActionResult<StudentLessonCompleteResult>> => {
  try {
    const response = await fetch("/api/auth/student/lesson-complete", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseMessage(response, "Failed to complete lesson.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    return {
      ok: true,
      message: parsed.message,
      data: parsed.payload as StudentLessonCompleteResult,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to complete lesson." };
  }
};

export const getStudentLessonNoteApi = async (
  courseId: string,
  lessonId: string,
): Promise<AuthActionResult<StudentLessonNoteResult>> => {
  try {
    const query = new URLSearchParams({ courseId, lessonId });
    const response = await fetch(`/api/auth/student/lesson-note?${query.toString()}`, {
      headers: authHeaders(false),
    });
    const parsed = await parseResponseMessage(response, "Failed to load lesson note.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    return {
      ok: true,
      message: "Loaded",
      data: parsed.payload as StudentLessonNoteResult,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load lesson note." };
  }
};

export const saveStudentLessonNoteApi = async (payload: {
  courseId: string;
  lessonId: string;
  chapterTitle?: string;
  lessonTitle?: string;
  noteText: string;
}): Promise<AuthActionResult<StudentLessonNoteResult>> => {
  try {
    const response = await fetch("/api/auth/student/lesson-note", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseMessage(response, "Failed to save lesson note.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    return {
      ok: true,
      message: parsed.message,
      data: parsed.payload as StudentLessonNoteResult,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to save lesson note." };
  }
};

export interface StudentSupportCourse {
  courseId: string;
  courseTitle: string;
  expiresAt?: string;
}

export interface StudentSupportTicket {
  id: number;
  ticketCode: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  subject: string;
  issueCategory: string;
  priority: "low" | "medium" | "high";
  lessonTitle?: string;
  issueDetails: string;
  screenshotUrl?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  messageCount?: number;
  latestMessageAt?: string;
  lastReplyAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSupportMessage {
  id: number;
  ticketId: number;
  senderRole: "student" | "admin";
  senderId?: string;
  senderName?: string;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
}

export const getStudentSupportCoursesApi = async (): Promise<AuthActionResult<StudentSupportCourse[]>> => {
  try {
    const response = await fetch("/api/auth/student/support/courses", { headers: authHeaders(false) });
    const parsed = await parseResponseMessage(response, "Failed to load purchased courses.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    const items = (parsed.payload as { items?: StudentSupportCourse[] })?.items || [];
    return { ok: true, message: "Loaded", data: items };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load purchased courses." };
  }
};

export const uploadStudentSupportScreenshotApi = async (payload: {
  fileName: string;
  base64Data: string;
}): Promise<AuthActionResult<{ url: string }>> => {
  try {
    const response = await fetch("/api/auth/student/support/screenshot", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseMessage(response, "Failed to upload screenshot.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    return {
      ok: true,
      message: "Uploaded",
      data: parsed.payload as { url: string },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to upload screenshot." };
  }
};

export const createStudentSupportTicketApi = async (payload: {
  courseId: string;
  subject: string;
  issueCategory: string;
  priority: "low" | "medium" | "high";
  lessonTitle?: string;
  issueDetails: string;
  screenshotUrl?: string;
}): Promise<AuthActionResult<StudentSupportTicket>> => {
  try {
    const response = await fetch("/api/auth/student/support/tickets", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseMessage(response, "Failed to create support ticket.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    const ticket = (parsed.payload as { ticket?: StudentSupportTicket })?.ticket;
    return { ok: true, message: "Created", data: ticket };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to create support ticket." };
  }
};

export const getStudentSupportTicketsApi = async (): Promise<AuthActionResult<StudentSupportTicket[]>> => {
  try {
    const response = await fetch("/api/auth/student/support/tickets", { headers: authHeaders(false) });
    const parsed = await parseResponseMessage(response, "Failed to load support tickets.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    const items = (parsed.payload as { items?: StudentSupportTicket[] })?.items || [];
    return { ok: true, message: "Loaded", data: items };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load support tickets." };
  }
};

export const getStudentSupportTicketDetailsApi = async (
  ticketId: number,
): Promise<AuthActionResult<{ ticket: StudentSupportTicket; messages: StudentSupportMessage[] }>> => {
  try {
    const response = await fetch(`/api/auth/student/support/tickets/${encodeURIComponent(String(ticketId))}`, {
      headers: authHeaders(false),
    });
    const parsed = await parseResponseMessage(response, "Failed to load ticket details.");
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    return {
      ok: true,
      message: "Loaded",
      data: parsed.payload as { ticket: StudentSupportTicket; messages: StudentSupportMessage[] },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to load ticket details." };
  }
};

export const replyStudentSupportTicketApi = async (
  ticketId: number,
  message: string,
): Promise<AuthActionResult> => {
  try {
    const response = await fetch(`/api/auth/student/support/tickets/${encodeURIComponent(String(ticketId))}/reply`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    });
    const parsed = await parseResponseMessage(response, "Failed to send reply.");
    return { ok: parsed.ok, message: parsed.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to send reply." };
  }
};
