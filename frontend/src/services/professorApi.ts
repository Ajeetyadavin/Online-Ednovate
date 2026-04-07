export interface ProfessorUser {
  id: string;
  name: string;
  email?: string;
  courseIds: string[];
  revenueSharePercent?: number;
  isLoginEnabled?: boolean;
}

export interface ProfessorMonthlyItem {
  month: string;
  sales_count: number;
  students_count: number;
  gross_amount: number;
  faculty_share: number;
}

export interface ProfessorCourseItem {
  course_id: string;
  course_title: string;
  sales_count: number;
  gross_amount: number;
  faculty_share: number;
}

export interface ProfessorSaleItem {
  id: number;
  orderId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  orderDate: string;
  amount: number;
  currency: string;
  facultyShareAmount: number;
}

export interface ProfessorPayoutItem {
  id: number;
  amount: number;
  currency: string;
  status: string;
  reference_id?: string;
  payout_date: string;
  note?: string;
  created_at?: string;
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
};

const withAuth = (token: string, init?: HeadersInit) => ({
  ...(init || {}),
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

export const professorApi = {
  async login(payload: { email: string; password: string; forceLogin?: boolean }) {
    return parseResponse<{ token: string; user: ProfessorUser }>(
      await fetch("/api/faculty/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async logout(token: string) {
    return parseResponse<{ ok: boolean }>(
      await fetch("/api/faculty/logout", {
        method: "POST",
        headers: withAuth(token),
      }),
    );
  },

  async sessionStatus(token: string) {
    return parseResponse<{ ok: boolean; user: ProfessorUser }>(
      await fetch("/api/faculty/session-status", {
        headers: withAuth(token, {}),
      }),
    );
  },

  async monthly(token: string, params?: { from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return parseResponse<{ items: ProfessorMonthlyItem[] }>(
      await fetch(`/api/faculty/dashboard/monthly${suffix}`, {
        headers: withAuth(token, {}),
      }),
    );
  },

  async courses(token: string, params?: { from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return parseResponse<{ items: ProfessorCourseItem[] }>(
      await fetch(`/api/faculty/dashboard/courses${suffix}`, {
        headers: withAuth(token, {}),
      }),
    );
  },

  async sales(token: string, params?: { from?: string; to?: string; search?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.search) q.set("search", params.search);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return parseResponse<{ items: ProfessorSaleItem[]; total: number; page: number; limit: number }>(
      await fetch(`/api/faculty/dashboard/sales${suffix}`, {
        headers: withAuth(token, {}),
      }),
    );
  },

  async payouts(token: string) {
    return parseResponse<{ pendingAmount: number; paidAmount: number; currency: string; payouts: ProfessorPayoutItem[] }>(
      await fetch("/api/faculty/dashboard/payouts", {
        headers: withAuth(token, {}),
      }),
    );
  },
};
