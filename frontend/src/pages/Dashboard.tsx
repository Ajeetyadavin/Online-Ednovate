import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BookOpen, User, ShoppingBag, PlayCircle, Clock, IndianRupee,
  Calendar, LogOut, Edit2, Save, TrendingUp, Bell, Download,
  ChevronRight, Star, Target, LayoutDashboard, Award, Zap, Mail, Lock,
  GraduationCap, Clock3, CheckCircle, FolderOpen, FileText, ListChecks, Flag, BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import LoginModal from "@/components/LoginModal";
import { Country, State } from "country-state-city";
import { getCourseAccessIssue, getCourseAccessIssueLabel, getCourseAccessIssueMessage, isCourseAccessActive } from "@/lib/studentAccess";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";
import { changeStudentPasswordApi, getStudentDashboardApi, getStudentTestAttemptsApi, updateStudentCourseVideoQualityApi, updateStudentProfileApi } from "@/services/authApi";
import type { StudentCourseAccessSelf } from "@/services/authApi";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type VideoQualityPref = "auto" | "high" | "medium" | "low";

type MockQuestion = {
  id: string;
  type: string;
  difficulty: string;
  question_text: string;
  options: unknown;
  correct_answer?: unknown;
  explanation?: string;
};

type AttemptReport = {
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
};

const TEST_ATTEMPT_REPORTS_KEY = "ednovate_test_attempt_reports";

const userStorageKey = (base: string, identity?: string) => `${base}_${String(identity || "guest").trim().toLowerCase() || "guest"}`;

const quickActions = [
  { label: "Browse Courses", icon: BookOpen, color: "bg-orange-100 text-[#E74623]", href: "/packages" },
  { label: "Technical Support", icon: Bell, color: "bg-blue-100 text-[#1e3a8a]", href: "/dashboard/technical-support" },
  { label: "Notifications", icon: Bell, color: "bg-amber-100 text-amber-600", href: "#", action: "notifications" },
];

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

const Dashboard = () => {
  const navigate = useNavigate();
  const { purchasedCourses, purchasedTestPapers, orders } = useCart();
  const { isLoggedIn, logout, user, refreshProfile } = useAuth();
  const { courses, getCurriculumForCourse } = usePlatformData();
  const { settings } = useSiteSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    state: "",
    city: "",
    pin: "",
    joinedDate: "",
    avatar: "",
  });
  const [countryCode, setCountryCode] = useState("IN");
  const [stateCode, setStateCode] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [isCityLookupLoading, setIsCityLookupLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; subject?: string; message: string; createdAt: string }>>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCourseAboutRef, setSelectedCourseAboutRef] = useState<string | null>(null);
  const [selectedTestPaperRef, setSelectedTestPaperRef] = useState<string | null>(null);
  const [mockTestPaperRef, setMockTestPaperRef] = useState<string | null>(null);
  const [mockQuestions, setMockQuestions] = useState<MockQuestion[]>([]);
  const [isMockLoading, setIsMockLoading] = useState(false);
  const [mockActiveIndex, setMockActiveIndex] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<Record<string, string>>({});
  const [mockMarked, setMockMarked] = useState<Record<string, boolean>>({});
  const [mockRemainingSeconds, setMockRemainingSeconds] = useState(0);
  const [attemptReports, setAttemptReports] = useState<AttemptReport[]>([]);
  const [courseQualityPrefs, setCourseQualityPrefs] = useState<Record<string, VideoQualityPref>>({});
  const [courseAccessById, setCourseAccessById] = useState<Record<string, StudentCourseAccessSelf>>({});
  const [qualitySavingCourseId, setQualitySavingCourseId] = useState<string>("");
  const [startInstallPromptOpen, setStartInstallPromptOpen] = useState(false);
  const [startInstallCourseTitle, setStartInstallCourseTitle] = useState("");
  const userIdentity = user?.studentId || user?.email || user?.mobile || "guest";

  const PLAY_STORE_URL = "https://play.google.com/store";
  const APP_STORE_URL = "https://www.apple.com/app-store/";
  const countryOptions = useMemo(() => Country.getAllCountries(), []);
  const stateOptions = useMemo(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode);
  }, [countryCode]);
  const selectedCountryName = useMemo(
    () => countryOptions.find((country) => country.isoCode === countryCode)?.name || profile.country,
    [countryOptions, countryCode, profile.country],
  );
  const selectedStateName = useMemo(
    () => stateOptions.find((state) => state.isoCode === stateCode)?.name || profile.state,
    [stateOptions, stateCode, profile.state],
  );

  useEffect(() => {
    if (!user) return;
    setProfile((prev) => ({
      ...prev,
      name: user.name || "Student",
      email: user.email || "",
      phone: user.mobile || "",
      address: user.address || "",
      country: user.country || "",
      state: user.state || "",
      city: user.city || "",
      pin: user.pin || "",
      joinedDate: "",
    }));
    const matchedCountry = countryOptions.find(
      (country) => country.name.trim().toLowerCase() === String(user.country || "").trim().toLowerCase(),
    );
    const nextCountryCode = matchedCountry?.isoCode || "IN";
    setCountryCode(nextCountryCode);
    const matchedState = State.getStatesOfCountry(nextCountryCode).find(
      (state) => state.name.trim().toLowerCase() === String(user.state || "").trim().toLowerCase(),
    );
    setStateCode(matchedState?.isoCode || "");
  }, [user?.studentId, user?.name, user?.email, user?.mobile, user?.address, user?.country, user?.state, user?.city, user?.pin, countryOptions]);

  useEffect(() => {
    if (!profile.state || !stateOptions.length) return;
    const matchedState = stateOptions.find(
      (state) => state.name.trim().toLowerCase() === String(profile.state || "").trim().toLowerCase(),
    );
    if (matchedState?.isoCode && matchedState.isoCode !== stateCode) {
      setStateCode(matchedState.isoCode);
    }
  }, [profile.state, stateOptions, stateCode]);

  useEffect(() => {
    let isCancelled = false;

    const loadCities = async () => {
      if (countryCode !== "IN") {
        setCityOptions([]);
        setIsCityLookupLoading(false);
        return;
      }
      if (!/^\d{6}$/.test(profile.pin)) {
        setCityOptions([]);
        setIsCityLookupLoading(false);
        return;
      }

      setIsCityLookupLoading(true);
      const cities = await fetchIndianCitiesByPin(profile.pin, selectedStateName);
      if (isCancelled) return;

      setCityOptions(cities);
      setIsCityLookupLoading(false);

      if (cities.length > 0) {
        setProfile((previous) => ({
          ...previous,
          city: cities.includes(previous.city) ? previous.city : cities[0],
        }));
      }
    };

    void loadCities();

    return () => {
      isCancelled = true;
    };
  }, [countryCode, profile.pin, selectedStateName]);

  useEffect(() => {
    if (!isLoggedIn) return;

    let active = true;
    const loadNotifications = async () => {
      setIsNotificationsLoading(true);
      try {
        const result = await getStudentDashboardApi();
        if (!active || !result.ok || !result.data) return;

        const next = Array.isArray(result.data.notifications)
          ? result.data.notifications.map((item) => ({
              id: Number(item.id || 0),
              subject: String(item.subject || ""),
              message: String(item.message || ""),
              createdAt: String(item.createdAt || ""),
            }))
          : [];
        setNotifications(next);

        const prefMap = Object.fromEntries(
          (result.data.courseAccess || []).map((item) => [
            item.courseId,
            (item.preferredVideoQuality || "auto") as VideoQualityPref,
          ]),
        );
        setCourseQualityPrefs(prefMap);
        const accessMap = Object.fromEntries(
          (result.data.courseAccess || [])
            .filter((item) => item?.courseId)
            .map((item) => [item.courseId, item as StudentCourseAccessSelf]),
        );
        setCourseAccessById(accessMap);
      } finally {
        if (active) setIsNotificationsLoading(false);
      }
    };

    void loadNotifications();
    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    let active = true;
    const loadAttempts = async () => {
      const result = await getStudentTestAttemptsApi();
      if (!active) return;
      if (result.ok && Array.isArray(result.data)) {
        setAttemptReports(result.data);
        return;
      }
      try {
        const userKey = userStorageKey(TEST_ATTEMPT_REPORTS_KEY, userIdentity);
        const parsed = JSON.parse(localStorage.getItem(userKey) || "[]");
        setAttemptReports(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAttemptReports([]);
      }
    };
    if (isLoggedIn) void loadAttempts();
    return () => {
      active = false;
    };
  }, [isLoggedIn, userIdentity]);

  useEffect(() => {
    if (!mockTestPaperRef || mockRemainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setMockRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mockTestPaperRef, mockRemainingSeconds]);

  const dashboardCourses = useMemo(() => purchasedCourses, [purchasedCourses]);
  const dashboardTestPapers = useMemo(() => purchasedTestPapers, [purchasedTestPapers]);

  const totalHours = dashboardCourses.reduce((sum, c) => sum + (c.hours || 0), 0);
  const completedCount = dashboardCourses.filter(c => c.progress === 100).length;
  const avgProgress = dashboardCourses.length > 0
    ? Math.round(dashboardCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / dashboardCourses.length)
    : 0;

  const courseTitleById = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  const selectedCourseAbout = useMemo(
    () => dashboardCourses.find((course, index) => ((course as { purchaseRefId?: string }).purchaseRefId || `${course.id}:${index}`) === selectedCourseAboutRef) || null,
    [dashboardCourses, selectedCourseAboutRef],
  );

  const selectedCourseAccess = selectedCourseAbout ? courseAccessById[selectedCourseAbout.id] : null;

  const selectedCourseOrder = useMemo(() => {
    if (!selectedCourseAbout) return null;
    return orders.find((order) =>
      order.items.some((item) => {
        const itemType = String(item.itemType || "course").toLowerCase();
        return item.courseId === selectedCourseAbout.id && (itemType === "course" || itemType === "package");
      }),
    ) || null;
  }, [orders, selectedCourseAbout]);

  const selectedCourseChapters = useMemo(() => {
    if (!selectedCourseAbout) return [];
    return getCurriculumForCourse(selectedCourseAbout.id, selectedCourseAbout.title)
      .map((chapter) => {
        const lessons = Array.isArray(chapter.lessons) ? chapter.lessons : [];
        return {
          id: chapter.id,
          title: String(chapter.title || "Chapter").trim(),
          videoCount: lessons.filter((lesson) => lesson.type === "video").length,
        };
      });
  }, [getCurriculumForCourse, selectedCourseAbout]);

  const selectedCourseVideoCount = selectedCourseChapters.reduce((sum, chapter) => sum + chapter.videoCount, 0);
  const selectedCourseChapterCount = selectedCourseChapters.length;

  const selectedTestPaper = useMemo(
    () => dashboardTestPapers.find((paper, index) => (paper.purchaseRefId || `${paper.id}:${index}`) === selectedTestPaperRef) || null,
    [dashboardTestPapers, selectedTestPaperRef],
  );

  const mockTestPaper = useMemo(
    () => dashboardTestPapers.find((paper, index) => (paper.purchaseRefId || `${paper.id}:${index}`) === mockTestPaperRef) || null,
    [dashboardTestPapers, mockTestPaperRef],
  );

  const selectedTestPaperOrder = useMemo(() => {
    if (!selectedTestPaper) return null;
    return orders.find((order) =>
      order.items.some((item) => {
        const itemType = String(item.itemType || "").toLowerCase();
        return item.courseId === selectedTestPaper.id && (itemType === "test_series" || itemType === "test-series");
      }),
    ) || null;
  }, [orders, selectedTestPaper]);

  const mockActiveQuestion = mockQuestions[mockActiveIndex] || null;
  const mockAnsweredCount = mockQuestions.filter((question) => Boolean(mockAnswers[question.id])).length;
  const mockMarkedCount = mockQuestions.filter((question) => Boolean(mockMarked[question.id])).length;
  const mockTimeLabel = `${String(Math.floor(mockRemainingSeconds / 60)).padStart(2, "0")}:${String(mockRemainingSeconds % 60).padStart(2, "0")}`;

  const formatPurchaseDateTime = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
    const minutes = Math.floor(safeSeconds / 60);
    const remaining = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  };

  const cleanPdfText = (value: unknown) => String(value || "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();

  const downloadAttemptReportPdf = (report: AttemptReport) => {
    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    const companyName = String(settings.header?.brandTitle || "Ednovate").trim() || "Ednovate";
    const studentName = profile.name || user?.name || "Student";

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 92, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(companyName, margin, 34);
    doc.setFontSize(22);
    doc.text("Test Attempt Report", margin, 64);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageWidth - margin, 34, { align: "right" });

    doc.setTextColor(15, 23, 42);
    autoTable(doc, {
      startY: 112,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [231, 70, 35], textColor: 255 },
      body: [
        ["Student", studentName, "Submitted", new Date(report.submittedAt).toLocaleString("en-IN")],
        ["Test", report.paperTitle, "Time Taken", formatDuration(report.timeTakenSeconds)],
        ["Score", `${report.scorePercent}%`, "Attempted", `${report.attempted}/${report.totalQuestions}`],
        ["Correct", String(report.correct), "Wrong", String(report.wrong)],
      ],
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 220;
    autoTable(doc, {
      startY: finalY + 18,
      head: [["Q.No", "Question", "Your Answer", "Correct Answer", "Status"]],
      body: (report.questions || []).map((item) => [
        item.questionNo,
        cleanPdfText(item.questionText),
        cleanPdfText(item.userAnswer) || "Not Attempted",
        cleanPdfText(item.correctAnswer) || "-",
        item.status === "not_attempted" ? "Not Attempted" : item.isCorrect ? "Correct" : "Wrong",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 190 },
        2: { cellWidth: 105 },
        3: { cellWidth: 105 },
        4: { cellWidth: 70 },
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("Computer generated report", margin, pageHeight - 16);
        doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 16, { align: "right" });
      },
    });

    const safeTitle = report.paperTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "attempt-report";
    doc.save(`${safeTitle}-${report.id}.pdf`);
  };

  const normalizeMockOptions = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    if (value && typeof value === "object") {
      return Object.values(value as Record<string, unknown>).map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return normalizeMockOptions(parsed);
      } catch {
        return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const openMockAttempt = async (ref: string, paperId: string, totalTime: number) => {
    setMockTestPaperRef(ref);
    setMockQuestions([]);
    setMockActiveIndex(0);
    setMockAnswers({});
    setMockMarked({});
    setMockRemainingSeconds(Math.max(1, Number(totalTime || 60)) * 60);
    setIsMockLoading(true);
    try {
      const response = await fetch(`/api/test-papers/${encodeURIComponent(paperId)}/questions`);
      const payload = await response.json().catch(() => ({}));
      const items = Array.isArray(payload.items) ? payload.items : [];
      setMockQuestions(items.map((item: any) => ({
        id: String(item.id || ""),
        type: String(item.type || "mcq"),
        difficulty: String(item.difficulty || "medium"),
        question_text: String(item.question_text || ""),
        options: item.options,
        correct_answer: item.correct_answer,
        explanation: item.explanation,
      })).filter((item: MockQuestion) => item.id && item.question_text));
    } catch {
      setMockQuestions([]);
    } finally {
      setIsMockLoading(false);
    }
  };

  const closeMockAttempt = () => {
    setMockTestPaperRef(null);
    setMockQuestions([]);
    setMockActiveIndex(0);
    setMockAnswers({});
    setMockMarked({});
    setMockRemainingSeconds(0);
  };

  const downloadTestPaperInvoice = () => {
    if (!selectedTestPaper) return;
    const order = selectedTestPaperOrder;
    const invoiceNo = order?.id || selectedTestPaper.purchaseRefId || `INV-${selectedTestPaper.id}`;
    const invoiceDateValue = selectedTestPaper.purchasedAt || selectedTestPaper.purchasedOn;
    const invoiceDate = invoiceDateValue && Number.isFinite(new Date(invoiceDateValue).getTime())
      ? new Date(invoiceDateValue).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN");
    const orderItem = order?.items.find((item) => item.courseId === selectedTestPaper.id);
    const totalAmount = Math.max(0, Number(orderItem?.price || selectedTestPaper.price || 0));
    const taxAmount = Math.max(0, Number(order?.taxAmount || 0));
    const taxableAmount = Math.max(0, totalAmount - taxAmount);
    const logoUrl = `${window.location.origin}${resolveUploadAssetUrl(settings.logo, "/ednovate-logo.png")}`;
    const companyName = String(settings.header?.brandTitle || "Ednovate").trim() || "Ednovate";
    const companyAddress = "4th floor, Ajanta Square Building, near Borivali court, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092";
    const billingAddress = [
      profile.address,
      profile.city,
      profile.state,
      profile.country,
      profile.pin,
    ].map((item) => String(item || "").trim()).filter(Boolean).join(", ") || "Address unavailable";
    const studentName = profile.name || user?.name || "Student";
    const details = [
      "Type: Test Series",
      selectedTestPaper.paperCode ? `Paper Code: ${selectedTestPaper.paperCode}` : "",
      selectedTestPaper.nature ? `Nature: ${selectedTestPaper.nature}` : "",
      `Duration: ${selectedTestPaper.totalTime} Minutes`,
      `Attempts: ${selectedTestPaper.attemptsAllowed || 1}`,
    ].filter(Boolean).join(" | ");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice-${invoiceNo}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { margin: 0; padding: 0; }
  </style>
</head>
<body style="font-family:Arial,sans-serif;background:#e5e7eb;padding:24px;color:#111827;">
  <div style="width:210mm;min-height:297mm;box-sizing:border-box;margin:0 auto;background:#ffffff;border:1px solid #9ca3af;box-shadow:0 4px 14px rgba(15,23,42,.08);padding:12mm;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div>
        <img src="${logoUrl}" alt="${companyName}" style="height:46px;object-fit:contain;display:block;margin-bottom:8px;" />
        <div style="font-size:18px;font-weight:800;color:#1f3c88;letter-spacing:.06em;">${companyName}</div>
        <div style="font-size:12px;color:#4b5563;margin-top:4px;max-width:340px;line-height:1.4;">${companyAddress}</div>
      </div>
      <div style="text-align:right;min-width:250px;">
        <div style="font-size:34px;font-weight:800;color:#4f7dbd;letter-spacing:.04em;line-height:1;">TAX INVOICE</div>
        <table style="margin-top:14px;width:100%;border-collapse:collapse;font-size:12px;">
          <tr>
            <th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">INVOICE #</th>
            <th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">DATE</th>
          </tr>
          <tr>
            <td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceNo}</td>
            <td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceDate}</td>
          </tr>
        </table>
      </div>
    </div>

    <div style="margin-top:22px;display:inline-block;min-width:340px;">
      <div style="border:1px solid #9ca3af;background:#d1d5db;padding:4px 10px;font-size:12px;font-weight:700;">BILL TO</div>
      <div style="padding:8px 2px 0 2px;font-size:13px;line-height:1.45;">
        <div style="font-weight:700;">${studentName}</div>
        <div>${profile.email || user?.email || "-"}</div>
        <div>${profile.phone || user?.mobile || "-"}</div>
        <div>${billingAddress}</div>
        <div style="margin-top:4px;"><strong>Payment:</strong> ${order?.paymentMethod || "Online"}</div>
      </div>
    </div>

    <div style="margin-top:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #9ca3af;">
        <thead>
          <tr style="background:#d1d5db;text-align:left;">
            <th style="padding:9px 10px;border-right:1px solid #9ca3af;">DESCRIPTION</th>
            <th style="padding:9px 10px;text-align:right;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px;border-right:1px solid #9ca3af;border-bottom:1px solid #e5e7eb;vertical-align:top;">
              <div style="font-weight:700;">${selectedTestPaper.title}</div>
              <div style="color:#4b5563;font-size:12px;margin-top:4px;">${details}</div>
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;vertical-align:top;">
              ₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
          <tr>
            <td style="height:140px;border-right:1px solid #9ca3af;"></td>
            <td></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:10px;border-right:1px solid #9ca3af;font-style:italic;font-size:14px;color:#1f3c88;">Thank you for your business!</td>
            <td style="padding:10px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <span style="color:#4b5563;">Base Price</span>
                <strong>₹${taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <span style="color:#4b5563;">+ GST</span>
                <strong>₹${taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div style="border-top:1px solid #9ca3af;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:800;color:#111827;">Grand Total</span>
                <span style="font-weight:800;font-size:22px;">₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div style="margin-top:24px;text-align:center;font-size:12px;color:#4b5563;line-height:1.45;">
      This is a computer-generated invoice. Signature is not required.
    </div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoiceNo}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const downloadCourseAboutInvoice = () => {
    if (!selectedCourseAbout) return;
    const order = selectedCourseOrder;
    const orderItem = order?.items.find((item) => item.courseId === selectedCourseAbout.id);
    const invoiceNo = order?.id || (selectedCourseAbout as { purchaseRefId?: string }).purchaseRefId || `INV-${selectedCourseAbout.id}`;
    const invoiceDateValue = order?.date || selectedCourseAccess?.purchaseDate || selectedCourseAbout.purchasedOn;
    const invoiceDate = invoiceDateValue && Number.isFinite(new Date(invoiceDateValue).getTime())
      ? new Date(invoiceDateValue).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN");
    const totalAmount = Math.max(0, Number(orderItem?.price || selectedCourseAbout.price || 0));
    const taxAmount = Math.max(0, Number(order?.taxAmount || 0));
    const taxableAmount = Math.max(0, totalAmount - taxAmount);
    const logoUrl = `${window.location.origin}${resolveUploadAssetUrl(settings.logo, "/ednovate-logo.png")}`;
    const companyName = String(settings.header?.brandTitle || "Ednovate").trim() || "Ednovate";
    const companyAddress = "4th floor, Ajanta Square Building, near Borivali court, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092";
    const billingAddress = [
      profile.address,
      profile.city,
      profile.state,
      profile.country,
      profile.pin,
    ].map((item) => String(item || "").trim()).filter(Boolean).join(", ") || "Address unavailable";
    const details = [
      selectedCourseAbout.isCombo ? "Type: Combo Package" : "Type: Course",
      selectedCourseAbout.language ? `Language: ${selectedCourseAbout.language}` : "",
      selectedCourseAbout.hours ? `Duration: ${selectedCourseAbout.hours} Hours` : "",
      selectedCourseAbout.lectures ? `Lectures: ${selectedCourseAbout.lectures}` : "",
    ].filter(Boolean).join(" | ");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice-${invoiceNo}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { margin: 0; padding: 0; }
  </style>
</head>
<body style="font-family:Arial,sans-serif;background:#e5e7eb;padding:24px;color:#111827;">
  <div style="width:210mm;min-height:297mm;box-sizing:border-box;margin:0 auto;background:#ffffff;border:1px solid #9ca3af;box-shadow:0 4px 14px rgba(15,23,42,.08);padding:12mm;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div>
        <img src="${logoUrl}" alt="${companyName}" style="height:46px;object-fit:contain;display:block;margin-bottom:8px;" />
        <div style="font-size:18px;font-weight:800;color:#1f3c88;letter-spacing:.06em;">${companyName}</div>
        <div style="font-size:12px;color:#4b5563;margin-top:4px;max-width:340px;line-height:1.4;">${companyAddress}</div>
      </div>
      <div style="text-align:right;min-width:250px;">
        <div style="font-size:34px;font-weight:800;color:#4f7dbd;letter-spacing:.04em;line-height:1;">TAX INVOICE</div>
        <table style="margin-top:14px;width:100%;border-collapse:collapse;font-size:12px;">
          <tr><th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">INVOICE #</th><th style="border:1px solid #9ca3af;background:#d1d5db;padding:6px 8px;text-align:center;">DATE</th></tr>
          <tr><td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceNo}</td><td style="border:1px solid #9ca3af;padding:6px 8px;text-align:center;font-weight:700;">${invoiceDate}</td></tr>
        </table>
      </div>
    </div>
    <div style="margin-top:22px;display:inline-block;min-width:340px;">
      <div style="border:1px solid #9ca3af;background:#d1d5db;padding:4px 10px;font-size:12px;font-weight:700;">BILL TO</div>
      <div style="padding:8px 2px 0 2px;font-size:13px;line-height:1.45;">
        <div style="font-weight:700;">${profile.name || user?.name || "Student"}</div>
        <div>${profile.email || user?.email || "-"}</div>
        <div>${profile.phone || user?.mobile || "-"}</div>
        <div>${billingAddress}</div>
        <div style="margin-top:4px;"><strong>Payment:</strong> ${order?.paymentMethod || "Online"}</div>
      </div>
    </div>
    <div style="margin-top:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #9ca3af;">
        <thead><tr style="background:#d1d5db;text-align:left;"><th style="padding:9px 10px;border-right:1px solid #9ca3af;">DESCRIPTION</th><th style="padding:9px 10px;text-align:right;">AMOUNT</th></tr></thead>
        <tbody>
          <tr>
            <td style="padding:10px;border-right:1px solid #9ca3af;border-bottom:1px solid #e5e7eb;vertical-align:top;"><div style="font-weight:700;">${selectedCourseAbout.title}</div><div style="color:#4b5563;font-size:12px;margin-top:4px;">${details || "Course purchase"}</div></td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;vertical-align:top;">₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          <tr><td style="height:140px;border-right:1px solid #9ca3af;"></td><td></td></tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:10px;border-right:1px solid #9ca3af;font-style:italic;font-size:14px;color:#1f3c88;">Thank you for your business!</td>
            <td style="padding:10px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="color:#4b5563;">Base Price</span><strong>₹${taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="color:#4b5563;">+ GST</span><strong>₹${taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div style="border-top:1px solid #9ca3af;padding-top:8px;display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:800;color:#111827;">Grand Total</span><span style="font-weight:800;font-size:22px;">₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:12px;color:#4b5563;line-height:1.45;">This is a computer-generated invoice. Signature is not required.</div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoiceNo}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleQuickAction = (action: { href: string; action?: string }) => {
    if (action.action === "notifications") {
      setNotificationsOpen(true);
      return;
    }
    navigate(action.href);
  };

  const handleSaveProfile = async () => {
    if (!countryCode || !stateCode) {
      alert("Please select country and state.");
      return;
    }
    if (countryCode === "IN") {
      if (!/^\d{6}$/.test(profile.pin)) {
        alert("Please enter a valid 6-digit pin code.");
        return;
      }
      if (!profile.city.trim()) {
        alert("Selected pin code does not match the selected state.");
        return;
      }
    } else if (!profile.city.trim()) {
      alert("Please enter city.");
      return;
    }

    setIsProfileSaving(true);
    try {
      const result = await updateStudentProfileApi({
        name: profile.name,
        email: profile.email,
        mobile: profile.phone,
        address: profile.address,
        country: selectedCountryName,
        state: selectedStateName,
        city: profile.city,
        pin: profile.pin,
      });
      if (!result.ok) {
        alert(result.message || "Failed to update profile");
        return;
      }
      await refreshProfile();
      setIsEditing(false);
      alert("Profile updated successfully");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      alert("Please enter current and new password");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New password and confirm password do not match");
      return;
    }
    setIsPasswordSaving(true);
    try {
      const result = await changeStudentPasswordApi(passwordForm.currentPassword, passwordForm.newPassword);
      if (!result.ok) {
        alert(result.message || "Failed to change password");
        return;
      }
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("Password changed successfully");
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleCourseQualityChange = async (courseId: string, nextValue: VideoQualityPref) => {
    setCourseQualityPrefs((prev) => ({ ...prev, [courseId]: nextValue }));
    setQualitySavingCourseId(courseId);

    const result = await updateStudentCourseVideoQualityApi({
      courseId,
      preferredVideoQuality: nextValue,
    });

    setQualitySavingCourseId("");

    if (!result.ok) {
      alert(result.message || "Failed to save quality preference");
      void getStudentDashboardApi().then((fresh) => {
        if (!fresh.ok || !fresh.data) return;
        const prefMap = Object.fromEntries(
          (fresh.data.courseAccess || []).map((item) => [
            item.courseId,
            (item.preferredVideoQuality || "auto") as VideoQualityPref,
          ]),
        );
        setCourseQualityPrefs(prefMap);
      });
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Login Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Please login or sign up to view your dashboard.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSignupMode(false);
                setLoginOpen(true);
              }}
            >
              Login
            </Button>
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => {
                setSignupMode(true);
                setLoginOpen(true);
              }}
            >
              Sign Up
            </Button>
          </div>
          <Button variant="ghost" className="mt-3" onClick={() => navigate("/")}>
            Back to Home
          </Button>
          <LoginModal
            open={loginOpen}
            onOpenChange={setLoginOpen}
            isSignup={signupMode}
            onToggleMode={() => setSignupMode((prev) => !prev)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-8">
      <div className="bg-[#1e3a8a] border-b border-[#1e3a8a]">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-7">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 md:w-16 md:h-16 border-2 md:border-3 border-white/30 shadow-xl shrink-0">
              <AvatarImage src={profile.avatar} />
              <AvatarFallback className="bg-white text-[#1e3a8a] text-lg md:text-2xl font-bold">
                {profile.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-white truncate">{profile.name}</h1>
              <p className="text-blue-200 text-xs md:text-sm flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Member since {profile.joinedDate || "N/A"}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-white text-[#1e3a8a] hover:bg-blue-50 font-semibold text-xs px-3 h-8 shrink-0"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: "Enrolled", value: dashboardCourses.length, icon: FolderOpen },
              { label: "Completed", value: completedCount, icon: CheckCircle },
              { label: "Hours", value: totalHours, icon: Clock3 },
              { label: "Progress", value: `${avgProgress}%`, icon: TrendingUp },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-lg p-2 md:p-3 text-center">
                <s.icon className="w-4 h-4 md:w-5 md:h-5 mx-auto text-white/80 mb-1" />
                <p className="text-base md:text-xl font-bold text-white">{s.value}</p>
                <p className="text-[9px] md:text-[11px] text-blue-200 truncate">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-10 mb-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto sm:max-w-xl">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action)}
              className="bg-card rounded-xl p-3 sm:p-4 shadow-md border border-border hover:shadow-lg hover:border-orange-200 transition-all text-center group"
            >
              <div className={`w-11 h-11 rounded-xl ${action.color} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-md`}>
                <action.icon className="w-5 h-5" />
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-foreground/80 leading-tight">{action.label}</p>
              {action.action === "notifications" && notifications.length > 0 ? (
                <span className="mt-1.5 inline-flex rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  {notifications.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <Tabs defaultValue="courses" className="space-y-5">
          <TabsList className="bg-card shadow-md rounded-2xl h-12 p-1.5 w-full sm:w-auto border border-slate-200/60 overflow-x-auto justify-start">
            <TabsTrigger value="courses" className="shrink-0 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#E74623] data-[state=active]:text-white data-[state=active]:shadow-md px-4 sm:px-6">
              <BookOpen className="w-4 h-4 mr-1.5 hidden sm:block" /> My Courses
            </TabsTrigger>
            <TabsTrigger value="test-series" className="shrink-0 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#E74623] data-[state=active]:text-white data-[state=active]:shadow-md px-4 sm:px-6">
              <FileText className="w-4 h-4 mr-1.5 hidden sm:block" /> Test Series
            </TabsTrigger>
            <TabsTrigger value="orders" className="shrink-0 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#E74623] data-[state=active]:text-white data-[state=active]:shadow-md px-4 sm:px-6">
              <ShoppingBag className="w-4 h-4 mr-1.5 hidden sm:block" /> Orders
            </TabsTrigger>
            <TabsTrigger value="profile" className="shrink-0 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#E74623] data-[state=active]:text-white data-[state=active]:shadow-md px-4 sm:px-6">
              <User className="w-4 h-4 mr-1.5 hidden sm:block" /> Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="space-y-4">
            {dashboardCourses.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
                    <BookOpen className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No courses yet</h3>
                  <p className="text-sm text-slate-500 mb-5 max-w-xs">Start your learning journey by exploring our courses</p>
                  <Button className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl h-11 px-6 shadow-lg" onClick={() => navigate("/packages")}>
                    <Target className="w-4 h-4 mr-2" /> Explore Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboardCourses.map((course, index) => (
                  (() => {
                    const accessEntry = courseAccessById[course.id];
                    const accessIssue = accessEntry ? getCourseAccessIssue(accessEntry) : null;
                    const accessIssueLabel = accessEntry ? getCourseAccessIssueLabel(accessEntry) : "Access Active";
                    const accessIssueMessage = accessEntry ? getCourseAccessIssueMessage(accessEntry) : "Access active.";
                    const isAccessAllowed = accessEntry ? isCourseAccessActive(accessEntry) : true;
                    return (
                  <Card key={`${course.id}:${(course as { purchaseRefId?: string }).purchaseRefId || index}`} className="overflow-hidden hover:shadow-xl transition-all duration-300 group border-slate-200/60">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={resolveUploadAssetUrl(course.thumbnail || course.image || "", "/placeholder.svg")}
                        alt={course.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {course.progress === 100 && (
                        <div className="absolute inset-0 bg-emerald-500/90 flex items-center justify-center">
                          <Award className="w-12 h-12 text-white" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 flex gap-2">
                        {course.isCombo && (
                          <span className="bg-[#E74623] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                            BUNDLE
                          </span>
                        )}
                        {accessIssue && (
                          <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md ${accessIssue === "disabled" ? "bg-slate-700" : accessIssue === "watchtime_over" ? "bg-amber-500" : "bg-red-600"}`}>
                            {accessIssueLabel.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        <select
                          aria-label="Video quality preference"
                          className="h-7 rounded-md border border-white/30 bg-black/60 px-2 text-[10px] font-semibold text-white backdrop-blur-sm focus:outline-none"
                          value={(courseQualityPrefs[course.id] || "auto") as VideoQualityPref}
                          onChange={(event) => void handleCourseQualityChange(course.id, event.target.value as VideoQualityPref)}
                          disabled={qualitySavingCourseId === course.id}
                        >
                          <option value="auto">Auto</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="flex items-center justify-between text-[11px] text-white/90">
                          <span className="font-semibold bg-black/50 px-2 py-0.5 rounded">{course.progress}% complete</span>
                          <span className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded"><Clock className="w-3 h-3" /> {course.hours}h</span>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <Badge variant="secondary" className="text-[10px] mb-2 font-semibold bg-blue-100 text-blue-700">{course.category.replace("-", " ").toUpperCase()}</Badge>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-1">{course.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {course.professor}
                      </p>
                      {accessIssue && (
                        <div className={`mb-3 rounded-xl border px-3 py-2 text-[11px] font-semibold ${accessIssue === "disabled" ? "border-slate-200 bg-slate-50 text-slate-700" : accessIssue === "watchtime_over" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                          {accessIssueMessage}
                        </div>
                      )}
                      {course.isCombo && Array.isArray(course.packageCourseIds) && course.packageCourseIds.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1e3a8a] mb-1.5">Included Courses ({course.packageCourseIds.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {course.packageCourseIds.slice(0, 3).map((id) => {
                              const bundledTitle = courseTitleById.get(id) || purchasedCourses.find((p) => p.id === id)?.title || id;
                              return (
                                <span key={`${course.id}-${id}`} className="rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-medium text-blue-700 line-clamp-1">
                                  {bundledTitle}
                                </span>
                              );
                            })}
                            {course.packageCourseIds.length > 3 && (
                              <span className="text-[9px] text-blue-600 font-medium">+{course.packageCourseIds.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}
                      <Progress value={course.progress} className="h-1.5 bg-slate-100 rounded-full mb-3" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white text-xs h-9 rounded-xl font-semibold shadow-md group/btn disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => {
                            if ((course as { webPlayEnabled?: boolean }).webPlayEnabled !== true) {
                              setStartInstallCourseTitle(course.title || "this course");
                              setStartInstallPromptOpen(true);
                              return;
                            }
                            navigate(`/learn/${course.id}`);
                          }}
                          disabled={!isAccessAllowed}
                        >
                          <PlayCircle className="w-4 h-4 mr-1.5 group-hover/btn:scale-110 transition-transform" />
                          {!isAccessAllowed ? accessIssueLabel : course.progress === 100 ? "Review" : course.progress > 0 ? "Continue" : "Start"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-9 rounded-xl font-semibold border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={() => setSelectedCourseAboutRef((course as { purchaseRefId?: string }).purchaseRefId || `${course.id}:${index}`)}
                        >
                          About
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                    );
                  })()
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="test-series" className="space-y-4">
            {dashboardTestPapers.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-orange-50 flex items-center justify-center mb-4 shadow-inner">
                    <FileText className="w-10 h-10 text-[#E74623]" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No test series yet</h3>
                  <p className="text-sm text-slate-500 mb-5 max-w-xs">Purchased test papers will appear here for quick practice.</p>
                  <Button className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl h-11 px-6 shadow-lg" onClick={() => navigate("/test-series")}>
                    <Target className="w-4 h-4 mr-2" /> Explore Test Series
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboardTestPapers.map((paper, index) => (
                  (() => {
                    const usedAttempts = attemptReports.filter((report) => report.paperId === paper.id).length;
                    const allowedAttempts = Math.max(1, Number(paper.attemptsAllowed || 1));
                    const isAttemptLocked = usedAttempts >= allowedAttempts;
                    return (
                  <Card key={`${paper.id}:${paper.purchaseRefId || index}`} className="overflow-hidden border-slate-200/60 transition-all duration-300 hover:shadow-xl">
                    <div className="relative aspect-video overflow-hidden bg-slate-100">
                      <img
                        src={resolveUploadAssetUrl(paper.thumbnailUrl || "", "/placeholder.svg")}
                        alt={paper.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute left-2 top-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#1e3a8a] px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-md">
                          {paper.nature || "Objective"}
                        </span>
                        {paper.paperCode && (
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-md">
                            {paper.paperCode}
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow">{paper.title}</p>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2">
                        <div className="text-center">
                          <Clock className="mx-auto mb-1 h-4 w-4 text-[#E74623]" />
                          <p className="text-[10px] font-bold text-slate-500">Time</p>
                          <p className="text-xs font-black text-slate-800">{paper.totalTime}m</p>
                        </div>
                        <div className="text-center">
                          <CheckCircle className="mx-auto mb-1 h-4 w-4 text-emerald-500" />
                          <p className="text-[10px] font-bold text-slate-500">Passing</p>
                          <p className="text-xs font-black text-slate-800">{paper.passingPercent}%</p>
                        </div>
                        <div className="text-center">
                          <ListChecks className="mx-auto mb-1 h-4 w-4 text-[#1e3a8a]" />
                          <p className="text-[10px] font-bold text-slate-500">Attempts</p>
                          <p className="text-xs font-black text-slate-800">{usedAttempts}/{allowedAttempts}</p>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500">
                        {paper.description || "Practice this test series with exam-style timing and clear attempt rules."}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-white p-2">
                        <Button
                          size="sm"
                          className={`h-10 rounded-xl px-3 text-xs font-bold shadow-md ${isAttemptLocked ? "bg-slate-300 text-slate-600 hover:bg-slate-300" : "bg-[#E74623] text-white hover:bg-[#d13a1a]"}`}
                          onClick={() => navigate(`/dashboard/test-attempt/${paper.id}`)}
                          disabled={isAttemptLocked}
                        >
                          {isAttemptLocked ? "Attempt End" : "Start Attempt"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 rounded-xl border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          onClick={() => setSelectedTestPaperRef(paper.purchaseRefId || `${paper.id}:${index}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                    );
                  })()
                ))}
              </div>
            )}
            {attemptReports.length > 0 && (
              <Card className="border-slate-200/70 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-black text-slate-800">
                    <BarChart3 className="h-5 w-5 text-[#1e3a8a]" /> Attempt Reports
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {attemptReports.slice(0, 6).map((report) => (
                    <div key={report.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-black text-slate-800">{report.paperTitle}</p>
                        <Badge className={report.scorePercent >= 40 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                          {report.scorePercent}%
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{new Date(report.submittedAt).toLocaleString("en-IN")}</p>
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                        <div className="rounded-lg bg-white p-1.5"><p className="font-black text-slate-900">{report.attempted}/{report.totalQuestions}</p><p className="font-bold text-slate-400">Attempt</p></div>
                        <div className="rounded-lg bg-white p-1.5"><p className="font-black text-emerald-600">{report.correct}</p><p className="font-bold text-slate-400">Correct</p></div>
                        <div className="rounded-lg bg-white p-1.5"><p className="font-black text-red-600">{report.wrong}</p><p className="font-bold text-slate-400">Wrong</p></div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 h-9 w-full rounded-xl border-[#1e3a8a]/20 text-xs font-bold text-[#1e3a8a] hover:bg-blue-50"
                        onClick={() => downloadAttemptReportPdf(report)}
                      >
                        <Download className="mr-1.5 h-4 w-4" /> Download Report
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-3">
            {orders.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
                    <ShoppingBag className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No orders yet</h3>
                  <p className="text-sm text-slate-500 mb-5">Your purchase history will appear here</p>
                  <Button className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl h-11 px-6 shadow-lg" onClick={() => navigate("/packages")}>
                    Browse Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              orders.map(order => (
                <Card
                  key={order.id}
                  className="hover:shadow-xl transition-all duration-300 border-slate-200/60 overflow-hidden cursor-pointer group"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className={`w-full sm:w-1.5 h-1.5 sm:h-auto ${order.status === "Completed" ? "bg-gradient-to-b from-emerald-400 to-emerald-500" : "bg-gradient-to-b from-amber-400 to-orange-500"}`} />
                      <div className="p-5 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <p className="text-sm font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">{order.id}</p>
                              <Badge className={`text-[10px] font-semibold ${order.status === "Completed" ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200" : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border-amber-200"} border`}>
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-2 mb-3">
                              <Calendar className="w-3.5 h-3.5" /> {order.date}
                            </p>
                            <div className="space-y-1.5">
                              {order.items.map((item, i) => (
                                <p key={i} className="text-sm text-slate-600 flex items-center gap-2">
                                  <BookOpen className="w-3.5 h-3.5 text-[#E74623] shrink-0" />
                                  <span className="line-clamp-1 font-medium">{item.title}</span>
                                </p>
                              ))}
                            </div>
                            <p className="mt-3 text-xs text-[#E74623] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              <ChevronRight className="w-3 h-3" /> Click to view full order details
                            </p>
                          </div>
                          <div className="text-right sm:min-w-[100px]">
                            <p className="text-xl font-bold text-slate-800 flex items-center justify-end">
                              <IndianRupee className="w-4 h-4 mr-0.5 text-[#E74623]" />{order.total.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="profile" className="pb-8">
            <Card className="border-slate-200 shadow-lg rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#E74623] shadow-md">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-800">Profile Settings</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Manage your account details</p>
                  </div>
                </div>
                {isEditing ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl shadow-md"
                    onClick={handleSaveProfile}
                    disabled={isProfileSaving}
                  >
                    <Save className="w-4 h-4 mr-1.5" /> {isProfileSaving ? "Saving..." : "Save"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-1.5" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-orange-50 border border-slate-100">
                  <Avatar className="w-16 h-16 border-3 border-white shadow-md">
                    <AvatarImage src={profile.avatar} />
                    <AvatarFallback className="bg-[#E74623] text-white text-xl font-bold">
                      {profile.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-bold text-slate-800">{profile.name}</p>
                    <p className="text-sm text-slate-500">{profile.email}</p>
                    {isEditing && (
                      <Button variant="link" size="sm" className="text-xs text-[#E74623] h-auto p-0 mt-1 font-semibold">
                        Change Photo
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {[
                    { label: "Full Name", key: "name" as const, editable: true, icon: User },
                    { label: "Email Address", key: "email" as const, editable: true, icon: Mail },
                    { label: "Phone Number", key: "phone" as const, editable: true, icon: User },
                    { label: "Address", key: "address" as const, editable: true, icon: User },
                    { label: "Member Since", key: "joinedDate" as const, editable: false, icon: Calendar },
                  ].map(field => (
                    <div key={field.key} className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <field.icon className="w-3.5 h-3.5" /> {field.label}
                      </Label>
                      <Input
                        value={profile[field.key]}
                        disabled={!isEditing || !field.editable}
                        onChange={e => setProfile(p => ({ ...p, [field.key]: e.target.value }))}
                        className={`h-12 text-sm rounded-xl ${!field.editable ? "bg-slate-50" : isEditing ? "border-[#E74623]/30 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100" : "border-slate-200"}`}
                      />
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Country
                    </Label>
                    <select
                      value={countryCode}
                      disabled={!isEditing}
                      onChange={(event) => {
                        const nextCountryCode = event.target.value;
                        setCountryCode(nextCountryCode);
                        setStateCode("");
                        setCityOptions([]);
                        setProfile((previous) => ({
                          ...previous,
                          country: countryOptions.find((country) => country.isoCode === nextCountryCode)?.name || "",
                          state: "",
                          city: "",
                          pin: "",
                        }));
                      }}
                      className={`h-12 w-full rounded-xl border px-3 text-sm ${isEditing ? "border-[#E74623]/30 focus:border-[#E74623]" : "border-slate-200 bg-slate-50"}`}
                    >
                      <option value="">Select country</option>
                      {countryOptions.map((country) => (
                        <option key={country.isoCode} value={country.isoCode}>{country.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> State
                    </Label>
                    <select
                      value={stateCode}
                      disabled={!isEditing || !countryCode}
                      onChange={(event) => {
                        const nextStateCode = event.target.value;
                        setStateCode(nextStateCode);
                        setCityOptions([]);
                        setProfile((previous) => ({
                          ...previous,
                          state: stateOptions.find((state) => state.isoCode === nextStateCode)?.name || "",
                          city: "",
                          pin: "",
                        }));
                      }}
                      className={`h-12 w-full rounded-xl border px-3 text-sm ${isEditing ? "border-[#E74623]/30 focus:border-[#E74623]" : "border-slate-200 bg-slate-50"}`}
                    >
                      <option value="">Select state</option>
                      {stateOptions.map((state) => (
                        <option key={state.isoCode} value={state.isoCode}>{state.name}</option>
                      ))}
                    </select>
                  </div>

                  {countryCode === "IN" ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Pin Code
                        </Label>
                        <Input
                          value={profile.pin}
                          disabled={!isEditing}
                          onChange={(event) => setProfile((previous) => ({ ...previous, pin: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                          placeholder="6-digit pin code"
                          className={`h-12 text-sm rounded-xl ${isEditing ? "border-[#E74623]/30 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100" : "border-slate-200 bg-slate-50"}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> City
                        </Label>
                        <select
                          value={profile.city}
                          disabled={!isEditing || isCityLookupLoading || cityOptions.length === 0}
                          onChange={(event) => setProfile((previous) => ({ ...previous, city: event.target.value }))}
                          className={`h-12 w-full rounded-xl border px-3 text-sm ${isEditing ? "border-[#E74623]/30 focus:border-[#E74623]" : "border-slate-200 bg-slate-50"}`}
                        >
                          <option value="">{isCityLookupLoading ? "Loading..." : cityOptions.length ? "Select city" : "Enter pin code first"}</option>
                          {profile.city && !cityOptions.includes(profile.city) && (
                            <option value={profile.city}>{profile.city}</option>
                          )}
                          {cityOptions.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> City
                        </Label>
                        <Input
                          value={profile.city}
                          disabled={!isEditing}
                          onChange={(event) => setProfile((previous) => ({ ...previous, city: event.target.value }))}
                          className={`h-12 text-sm rounded-xl ${isEditing ? "border-[#E74623]/30 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100" : "border-slate-200 bg-slate-50"}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Postal Code
                        </Label>
                        <Input
                          value={profile.pin}
                          disabled={!isEditing}
                          onChange={(event) => setProfile((previous) => ({ ...previous, pin: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                          className={`h-12 text-sm rounded-xl ${isEditing ? "border-[#E74623]/30 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100" : "border-slate-200 bg-slate-50"}`}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Change Password</h4>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">Current Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter current password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                        className="h-12 text-sm rounded-xl border-slate-200 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">New Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        className="h-12 text-sm rounded-xl border-slate-200 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">Confirm Password</Label>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        className="h-12 text-sm rounded-xl border-slate-200 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>
                  <Button
                    className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl h-11 px-6 shadow-lg"
                    onClick={handleChangePassword}
                    disabled={isPasswordSaving}
                  >
                    {isPasswordSaving ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
          </DialogHeader>
          {isNotificationsLoading ? (
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{item.subject || "Order Update"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : ""}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCourseAbout)} onOpenChange={(open) => { if (!open) setSelectedCourseAboutRef(null); }}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-2xl max-h-[calc(100dvh-0.75rem)] overflow-hidden rounded-2xl border border-slate-200 p-0 sm:w-full [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:rounded-full [&>button]:border [&>button]:border-white/70 [&>button]:bg-white [&>button]:p-1.5 [&>button]:text-[#1e3a8a] [&>button]:opacity-100 [&>button]:shadow-lg [&>button]:hover:bg-orange-50 [&>button]:hover:text-[#E74623]">
          {selectedCourseAbout ? (
            <div>
              <div className="relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#28499a] to-[#E74623] px-3 py-3 pr-12 text-white sm:px-5 sm:py-4 sm:pr-14">
                <div className="relative flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">My Course</p>
                    <h2 className="mt-1 max-w-xl truncate text-sm font-black leading-tight sm:text-xl">{selectedCourseAbout.title}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase">{selectedCourseAbout.category.replace("-", " ")}</span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#1e3a8a]">{selectedCourseAccess ? getCourseAccessIssueLabel(selectedCourseAccess) : "Access Active"}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mr-1 h-8 shrink-0 rounded-xl bg-white px-2.5 text-[11px] font-bold text-[#1e3a8a] hover:bg-white/90 sm:mr-2 sm:px-3"
                    onClick={downloadCourseAboutInvoice}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Invoice
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 p-2.5 sm:grid-cols-[0.92fr_1.08fr] sm:gap-3 sm:p-4">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[16/5] sm:aspect-[16/8]">
                    <img
                      src={resolveUploadAssetUrl(selectedCourseAbout.thumbnail || selectedCourseAbout.image || "", "/placeholder.svg")}
                      alt={selectedCourseAbout.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1.5 sm:p-2">
                    <div className="rounded-lg bg-white p-1.5 text-center shadow-sm sm:p-2">
                      <TrendingUp className="mx-auto h-3.5 w-3.5 text-[#E74623]" />
                      <p className="text-[9px] font-bold text-slate-500">Progress</p>
                      <p className="text-xs font-black text-slate-900">{selectedCourseAbout.progress || 0}%</p>
                    </div>
                    <div className="rounded-lg bg-white p-1.5 text-center shadow-sm sm:p-2">
                      <PlayCircle className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                      <p className="text-[9px] font-bold text-slate-500">Views</p>
                      <p className="text-xs font-black text-slate-900">
                        {selectedCourseAccess?.isUnlimitedViews ? "Unlimited" : `${selectedCourseAccess?.remainingViews ?? "-"} left`}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-1.5 text-center shadow-sm sm:p-2">
                      <Clock className="mx-auto h-3.5 w-3.5 text-[#1e3a8a]" />
                      <p className="text-[9px] font-bold text-slate-500">Hours</p>
                      <p className="text-xs font-black text-slate-900">{selectedCourseAbout.hours || 0}h</p>
                    </div>
                  </div>
                  <div className="px-2 pb-2">
                    <Progress value={selectedCourseAbout.progress || 0} className="h-1.5 rounded-full bg-white" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">About Course</p>
                      <span className="max-w-[62%] truncate text-right text-[10px] font-bold text-slate-500">{selectedCourseAbout.professor || "-"}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600 sm:text-xs sm:leading-5">
                      {selectedCourseAbout.aboutCourseText || `${selectedCourseAbout.title} is available in your account with structured lectures, progress tracking, and exam-focused preparation.`}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-6 sm:text-xs">
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5 sm:col-span-2">
                        <p className="font-bold text-slate-400">Faculty</p>
                        <p className="line-clamp-2 font-black leading-4 text-slate-800">{selectedCourseAbout.professor || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="font-bold text-slate-400">Language</p>
                        <p className="truncate font-black text-slate-800">{selectedCourseAbout.language || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="font-bold text-slate-400">Lectures</p>
                        <p className="font-black text-slate-800">{selectedCourseAbout.lectures || 0}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5 sm:col-span-2">
                        <p className="font-bold text-slate-400">Expires</p>
                        <p className="whitespace-nowrap font-black text-slate-800">{selectedCourseAccess?.expiresAt ? new Date(selectedCourseAccess.expiresAt).toLocaleDateString("en-IN") : "Unlimited"}</p>
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Chapters</p>
                        <span className="text-[10px] font-black text-[#1e3a8a]">
                          {selectedCourseChapterCount} chapter{selectedCourseChapterCount !== 1 ? "s" : ""} · {selectedCourseVideoCount} video{selectedCourseVideoCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-1 max-h-14 space-y-1 overflow-y-auto pr-1">
                        {selectedCourseChapters.length > 0 ? (
                          selectedCourseChapters.map((chapter, chapterIndex) => (
                            <div key={`${chapter.id}-${chapterIndex}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1 text-[10px] shadow-sm">
                              <span className="min-w-0 truncate font-bold text-slate-700">{chapter.title}</span>
                              <span className="shrink-0 rounded-full bg-[#1e3a8a]/10 px-2 py-0.5 font-black text-[#1e3a8a]">
                                {chapter.videoCount} video{chapter.videoCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500">No chapter added</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Purchase Information</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px] sm:text-xs">
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="text-slate-500">Purchased On</span>
                        <p className="truncate font-bold text-slate-900">{formatPurchaseDateTime(selectedCourseAccess?.purchaseDate || selectedCourseAbout.purchasedOn || selectedCourseOrder?.date)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="text-slate-500">Order ID</span>
                        <p className="truncate font-bold text-slate-900">{selectedCourseOrder?.id || (selectedCourseAbout as { purchaseRefId?: string }).purchaseRefId || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="text-slate-500">Payment</span>
                        <p className="truncate font-bold text-slate-900">{selectedCourseOrder?.paymentMethod || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="text-slate-500">Status</span>
                        <p><Badge className="h-5 bg-emerald-100 px-1.5 text-[9px] text-emerald-700 hover:bg-emerald-100">{selectedCourseOrder?.status || "Completed"}</Badge></p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-9 rounded-xl text-xs font-bold" onClick={downloadCourseAboutInvoice}>
                      <Download className="mr-2 h-4 w-4" /> Invoice
                    </Button>
                    <Button
                      className="h-9 rounded-xl bg-[#E74623] text-xs font-bold text-white hover:bg-[#d13a1a]"
                      disabled={selectedCourseAccess ? !isCourseAccessActive(selectedCourseAccess) : false}
                      onClick={() => {
                        if ((selectedCourseAbout as { webPlayEnabled?: boolean }).webPlayEnabled !== true) {
                          setStartInstallCourseTitle(selectedCourseAbout.title || "this course");
                          setStartInstallPromptOpen(true);
                          return;
                        }
                        navigate(`/learn/${selectedCourseAbout.id}`);
                      }}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={startInstallPromptOpen} onOpenChange={setStartInstallPromptOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Install App To Continue</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            WebPlay is OFF for {startInstallCourseTitle || "this course"}. Video will not play on website.
            Install the app to continue.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" className="rounded-xl" onClick={() => window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer")}>
              Play Store
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => window.open(APP_STORE_URL, "_blank", "noopener,noreferrer")}>
              App Store
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTestPaper)} onOpenChange={(open) => { if (!open) setSelectedTestPaperRef(null); }}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 p-0 sm:w-full">
          {selectedTestPaper ? (
            <div>
              <div className="relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#264897] to-[#E74623] px-4 py-4 text-white sm:px-7 sm:py-6">
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Purchased Test Series</p>
                    <h2 className="mt-1.5 max-w-xl text-base font-black leading-tight sm:text-2xl">{selectedTestPaper.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase">{selectedTestPaper.nature || "Objective"}</span>
                      {selectedTestPaper.paperCode && <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#1e3a8a]">{selectedTestPaper.paperCode}</span>}
                    </div>
                  </div>
                  <Button size="sm" className="h-8 shrink-0 rounded-xl bg-white px-3 text-[11px] font-bold text-[#1e3a8a] hover:bg-white/90 sm:h-10 sm:text-sm" onClick={downloadTestPaperInvoice}>
                    <Download className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Invoice
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 p-3 sm:grid-cols-[0.95fr_1.05fr] sm:gap-4 sm:p-7">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[16/7] sm:aspect-video">
                    <img
                      src={resolveUploadAssetUrl(selectedTestPaper.thumbnailUrl || "", "/placeholder.svg")}
                      alt={selectedTestPaper.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-2 sm:gap-2 sm:p-3">
                    <div className="rounded-xl bg-white p-2 text-center shadow-sm sm:p-3">
                      <Clock className="mx-auto h-3.5 w-3.5 text-[#E74623] sm:mb-1 sm:h-4 sm:w-4" />
                      <p className="text-[9px] font-bold text-slate-500 sm:text-[10px]">Duration</p>
                      <p className="text-xs font-black text-slate-900">{selectedTestPaper.totalTime}m</p>
                    </div>
                    <div className="rounded-xl bg-white p-2 text-center shadow-sm sm:p-3">
                      <CheckCircle className="mx-auto h-3.5 w-3.5 text-emerald-500 sm:mb-1 sm:h-4 sm:w-4" />
                      <p className="text-[9px] font-bold text-slate-500 sm:text-[10px]">Passing</p>
                      <p className="text-xs font-black text-slate-900">{selectedTestPaper.passingPercent}%</p>
                    </div>
                    <div className="rounded-xl bg-white p-2 text-center shadow-sm sm:p-3">
                      <ListChecks className="mx-auto h-3.5 w-3.5 text-[#1e3a8a] sm:mb-1 sm:h-4 sm:w-4" />
                      <p className="text-[9px] font-bold text-slate-500 sm:text-[10px]">Attempts</p>
                      <p className="text-xs font-black text-slate-900">{selectedTestPaper.attemptsAllowed || 1}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">Purchase Information</p>
                    <div className="mt-2 grid gap-1.5 text-xs sm:mt-3 sm:gap-3 sm:text-sm">
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 sm:rounded-xl sm:py-2">
                        <span className="text-slate-500">Purchased On</span>
                        <span className="text-right font-bold text-slate-900">{formatPurchaseDateTime(selectedTestPaper.purchasedAt || selectedTestPaper.purchasedOn)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 sm:rounded-xl sm:py-2">
                        <span className="text-slate-500">Order ID</span>
                        <span className="max-w-[58%] truncate text-right font-bold text-slate-900">{selectedTestPaperOrder?.id || selectedTestPaper.purchaseRefId || "-"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 sm:rounded-xl sm:py-2">
                        <span className="text-slate-500">Payment</span>
                        <span className="text-right font-bold text-slate-900">{selectedTestPaperOrder?.paymentMethod || "-"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 sm:rounded-xl sm:py-2">
                        <span className="text-slate-500">Status</span>
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{selectedTestPaperOrder?.status || "Completed"}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">About This Test</p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-600 sm:mt-2 sm:line-clamp-none sm:text-sm sm:leading-6">
                      {selectedTestPaper.description || "This test series is available in your account. Use it for timed practice and exam-style preparation."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-10 rounded-xl text-xs font-bold sm:h-11 sm:text-sm" onClick={downloadTestPaperInvoice}>
                      <Download className="mr-2 h-4 w-4" /> Invoice
                    </Button>
                    <Button className="h-10 rounded-xl bg-[#E74623] text-xs font-bold text-white hover:bg-[#d13a1a] sm:h-11 sm:text-sm" onClick={() => navigate(`/test-series/${selectedTestPaper.id}`)}>
                      Open Test
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mockTestPaperRef)} onOpenChange={(open) => { if (!open) closeMockAttempt(); }}>
        <DialogContent className="h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 p-0 sm:w-full [&>button]:right-3 [&>button]:top-3 [&>button]:z-30 [&>button]:rounded-full [&>button]:bg-white [&>button]:p-1.5 [&>button]:text-slate-900 [&>button]:opacity-100 [&>button]:shadow-lg">
          {mockTestPaper ? (
            <div className="flex h-full flex-col bg-slate-100">
              <div className="flex shrink-0 items-center justify-between gap-3 bg-[#111827] px-4 py-3 pr-12 text-white">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Mock Test</p>
                  <h2 className="truncate text-sm font-black sm:text-lg">{mockTestPaper.title}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-xl bg-white/10 px-3 py-1 text-center">
                    <p className="text-[9px] font-bold uppercase text-white/50">Time Left</p>
                    <p className={`font-mono text-sm font-black ${mockRemainingSeconds < 300 ? "text-red-300" : "text-white"}`}>{mockTimeLabel}</p>
                  </div>
                  <Button size="sm" className="h-9 rounded-xl bg-[#E74623] text-xs font-bold text-white hover:bg-[#d13a1a]" onClick={closeMockAttempt}>
                    Submit
                  </Button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 md:grid-cols-[1fr_250px] md:p-3">
                <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Question {mockQuestions.length ? mockActiveIndex + 1 : 0} of {mockQuestions.length}</p>
                      <div className="mt-1 flex gap-1.5">
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{mockActiveQuestion?.type || "mcq"}</Badge>
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{mockActiveQuestion?.difficulty || "medium"}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                      <span>{mockAnsweredCount} answered</span>
                      <span>{mockMarkedCount} marked</span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                    {isMockLoading ? (
                      <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Loading questions...</div>
                    ) : mockActiveQuestion ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="whitespace-pre-wrap text-sm font-bold leading-7 text-slate-900 sm:text-base">{mockActiveQuestion.question_text}</p>
                        </div>
                        <div className="space-y-2">
                          {normalizeMockOptions(mockActiveQuestion.options).length > 0 ? normalizeMockOptions(mockActiveQuestion.options).map((option, optionIndex) => {
                            const optionKey = String.fromCharCode(65 + optionIndex);
                            const selected = mockAnswers[mockActiveQuestion.id] === option;
                            return (
                              <button
                                key={`${mockActiveQuestion.id}-${optionIndex}`}
                                type="button"
                                onClick={() => setMockAnswers((prev) => ({ ...prev, [mockActiveQuestion.id]: option }))}
                                className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${selected ? "border-[#1e3a8a] bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"}`}
                              >
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${selected ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600"}`}>{optionKey}</span>
                                <span className="text-sm font-semibold leading-6 text-slate-700">{option}</span>
                              </button>
                            );
                          }) : (
                            <textarea
                              className="min-h-32 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-[#1e3a8a]"
                              placeholder="Type your answer..."
                              value={mockAnswers[mockActiveQuestion.id] || ""}
                              onChange={(event) => setMockAnswers((prev) => ({ ...prev, [mockActiveQuestion.id]: event.target.value }))}
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-center">
                        <div>
                          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                          <p className="text-sm font-bold text-slate-500">No questions assigned to this test paper.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 p-2 sm:p-3">
                    <Button variant="outline" className="h-10 rounded-xl text-xs font-bold" disabled={mockActiveIndex === 0} onClick={() => setMockActiveIndex((value) => Math.max(0, value - 1))}>
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-10 rounded-xl text-xs font-bold ${mockActiveQuestion && mockMarked[mockActiveQuestion.id] ? "border-amber-300 bg-amber-50 text-amber-700" : ""}`}
                      disabled={!mockActiveQuestion}
                      onClick={() => mockActiveQuestion && setMockMarked((prev) => ({ ...prev, [mockActiveQuestion.id]: !prev[mockActiveQuestion.id] }))}
                    >
                      <Flag className="mr-1.5 h-4 w-4" /> Mark Later
                    </Button>
                    <Button className="h-10 rounded-xl bg-[#1e3a8a] text-xs font-bold text-white hover:bg-[#1e3a8a]/90" disabled={mockActiveIndex >= mockQuestions.length - 1} onClick={() => setMockActiveIndex((value) => Math.min(mockQuestions.length - 1, value + 1))}>
                      Save & Next
                    </Button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-2">
                      <p className="text-base font-black text-emerald-700">{mockAnsweredCount}</p>
                      <p className="text-[9px] font-bold text-emerald-700">Answered</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2">
                      <p className="text-base font-black text-amber-700">{mockMarkedCount}</p>
                      <p className="text-[9px] font-bold text-amber-700">Marked</p>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-2">
                      <p className="text-base font-black text-slate-700">{Math.max(0, mockQuestions.length - mockAnsweredCount)}</p>
                      <p className="text-[9px] font-bold text-slate-600">Left</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Question Palette</p>
                  <div className="mt-2 grid max-h-48 grid-cols-8 gap-1.5 overflow-y-auto md:max-h-none md:grid-cols-5">
                    {mockQuestions.map((question, index) => {
                      const answered = Boolean(mockAnswers[question.id]);
                      const marked = Boolean(mockMarked[question.id]);
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => setMockActiveIndex(index)}
                          className={`h-8 rounded-lg text-xs font-black ${index === mockActiveIndex ? "ring-2 ring-[#1e3a8a]" : ""} ${marked ? "bg-amber-400 text-white" : answered ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <p><span className="font-semibold text-foreground">Order ID:</span> {selectedOrder.id}</p>
                <p><span className="font-semibold text-foreground">Date:</span> {selectedOrder.date}</p>
                <p><span className="font-semibold text-foreground">Payment:</span> {selectedOrder.paymentMethod || "-"}</p>
                <p><span className="font-semibold text-foreground">Status:</span> {selectedOrder.status}</p>
                <p><span className="font-semibold text-foreground">Dispatch:</span> {selectedOrder.dispatchStatus || "-"}</p>
                <p><span className="font-semibold text-foreground">Tracking:</span> {selectedOrder.trackingId || "-"}</p>
                <p className="md:col-span-2"><span className="font-semibold text-foreground">Note:</span> {selectedOrder.dispatchNote || "-"}</p>
              </div>

              <div className="space-y-3">
                {selectedOrder.items.map((item, index) => {
                  const itemType = String(item.itemType || "").toLowerCase();
                  const isPackage = itemType === "package";
                  const isTestSeries = itemType === "test_series" || itemType === "test-series";
                  const packageCourseIds = isPackage && item.courseId
                    ? (Array.isArray(courseById.get(item.courseId)?.packageCourseIds)
                        ? courseById.get(item.courseId)?.packageCourseIds
                        : [])
                    : [];
                  const includedTitles = Array.isArray(packageCourseIds)
                    ? packageCourseIds.map((id) => courseTitleById.get(id) || id)
                    : [];

                  return (
                    <div key={`${selectedOrder.id}-${index}-${item.title}`} className="rounded-lg border border-border p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <Badge variant="secondary">
                          {isTestSeries ? "Test Series" : isPackage ? "Package" : item.isEbook ? "E-Book" : "Course"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Amount: ₹{Number(item.price || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Mode: {item.modeLabel || "-"}</p>
                      <p className="text-xs text-muted-foreground">Book Addon: {item.bookLabel || "-"}</p>

                      {isPackage && (
                        <div className="pt-1">
                          <p className="text-xs font-semibold text-foreground mb-1">Included Courses:</p>
                          {includedTitles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {includedTitles.map((title) => (
                                <span key={`${item.title}-${title}`} className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {title}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Package courses data unavailable</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
