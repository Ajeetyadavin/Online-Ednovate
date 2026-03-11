export interface AuthUserProfile {
  studentId: string;
  name: string;
  email: string;
  mobile: string;
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

interface StoredAuthUser extends AuthUserProfile {
  password: string;
}

const USERS_STORAGE_KEY = "ednovate_auth_users";
const OTP_STORAGE_KEY = "ednovate_auth_otps";

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

export const signupApi = async (payload: SignupPayload): Promise<AuthActionResult> => {
  const name = payload.name?.trim();
  const email = normalizeEmail(payload.email || "");
  const mobile = normalizeMobile(payload.mobile || "");
  const password = payload.password || "";
  const gender = sanitizeText(payload.gender);
  const country = sanitizeText(payload.country);
  const state = sanitizeText(payload.state);
  const city = sanitizeText(payload.city);
  const pin = sanitizeText(payload.pin);
  const course = sanitizeText(payload.course);
  const level = sanitizeText(payload.level);
  const attemptYear = sanitizeText(payload.attemptYear);

  if (!name || !email || !mobile || !password) {
    return { ok: false, message: "Please fill all required fields." };
  }

  const users = getUsers();
  const exists = users.some((user) => user.email === email || user.mobile === mobile);
  if (exists) {
    return { ok: false, message: "Account already exists. Please login." };
  }

  users.push({
    studentId: generateStudentId(),
    name,
    email,
    mobile,
    password,
    gender,
    country,
    state,
    city,
    pin,
    course,
    level,
    attemptYear,
  });
  saveUsers(users);

  return { ok: true, message: "Signup successful. Please login." };
};

export const loginWithEmailApi = async (
  emailOrMobile: string,
  password: string,
): Promise<AuthActionResult<AuthUserProfile>> => {
  const users = getUsers();
  const normalizedEmail = normalizeEmail(emailOrMobile || "");
  const normalizedMobile = normalizeMobile(emailOrMobile || "");
  const user = users.find(
    (item) =>
      (item.email === normalizedEmail || (normalizedMobile.length === 10 && item.mobile === normalizedMobile))
      && item.password === password,
  );

  if (!user) {
    return { ok: false, message: "Invalid email/mobile or password." };
  }

  return {
    ok: true,
    message: "Login successful.",
    data: {
      studentId: user.studentId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      gender: user.gender,
      country: user.country,
      state: user.state,
      city: user.city,
      pin: user.pin,
      course: user.course,
      level: user.level,
      attemptYear: user.attemptYear,
    },
  };
};

export const sendLoginOtpApi = async (mobileNo: string): Promise<AuthActionResult> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Please enter a valid mobile number." };
  }

  const otpMap = parseJson<Record<string, string>>(OTP_STORAGE_KEY, {});
  otpMap[mobile] = "123456";
  localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otpMap));

  return { ok: true, message: "OTP sent successfully." };
};

export const verifyLoginOtpApi = async (
  mobileNo: string,
  otp: string,
): Promise<AuthActionResult<{ studentId: string }>> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Invalid mobile number." };
  }

  const otpMap = parseJson<Record<string, string>>(OTP_STORAGE_KEY, {});
  const expectedOtp = otpMap[mobile] || "123456";
  if ((otp || "").trim() !== expectedOtp && (otp || "").trim() !== "123456") {
    return { ok: false, message: "Invalid OTP." };
  }

  const users = getUsers();
  let user = users.find((item) => item.mobile === mobile);
  if (!user) {
    user = {
      studentId: generateStudentId(),
      name: "Student",
      email: `${mobile}@student.local`,
      mobile,
      password: "",
    };
    users.push(user);
    saveUsers(users);
  }

  return {
    ok: true,
    message: "OTP verified successfully.",
    data: { studentId: user.studentId },
  };
};

export const verifyStoredOtpApi = async (
  mobileNo: string,
  otp: string,
): Promise<AuthActionResult> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Invalid mobile number." };
  }

  const otpMap = parseJson<Record<string, string>>(OTP_STORAGE_KEY, {});
  const expectedOtp = otpMap[mobile] || "123456";
  if ((otp || "").trim() !== expectedOtp && (otp || "").trim() !== "123456") {
    return { ok: false, message: "Invalid OTP." };
  }

  return {
    ok: true,
    message: "OTP verified successfully.",
  };
};

export const resetPasswordByMobileApi = async (
  mobileNo: string,
  password: string,
): Promise<AuthActionResult> => {
  const mobile = normalizeMobile(mobileNo || "");
  if (mobile.length !== 10) {
    return { ok: false, message: "Invalid mobile number." };
  }

  if (!password || password.trim().length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }

  const users = getUsers();
  const userIndex = users.findIndex((item) => item.mobile === mobile);
  if (userIndex === -1) {
    return { ok: false, message: "Account not found for this mobile number." };
  }

  users[userIndex] = {
    ...users[userIndex],
    password: password.trim(),
  };

  saveUsers(users);

  return {
    ok: true,
    message: "Password reset successful. Please login with your new password.",
  };
};

export const fetchProfileApi = async (
  studentId: string,
): Promise<AuthActionResult<Partial<AuthUserProfile>>> => {
  if (!studentId) {
    return { ok: false, message: "Missing student ID." };
  }

  const users = getUsers();
  const user = users.find((item) => item.studentId === studentId);

  if (!user) {
    return { ok: false, message: "Profile not found." };
  }

  return {
    ok: true,
    message: "Profile loaded.",
    data: {
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      gender: user.gender,
      country: user.country,
      state: user.state,
      city: user.city,
      pin: user.pin,
      course: user.course,
      level: user.level,
      attemptYear: user.attemptYear,
    },
  };
};
