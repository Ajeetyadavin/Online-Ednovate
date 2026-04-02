import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import {
  adminApi,
  type AdminOrderGroup,
  type CourseMasterAttemptOption,
  type CourseMasterDeliveryMode,
  type CourseMasterViewMode,
  type StudentRecord,
  type StudentCourseAccess,
  type StudentLoginLog,
  type StudentVideoActivity,
  type StudentNotification,
} from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search, Mail, MapPin, LogIn, Edit2, Trash2, Loader2, Shield,
  Clock, Eye, BookOpen, KeyRound, Send, Users, Activity,
  MessageSquare, RefreshCcw, GraduationCap, ToggleLeft, ToggleRight,
  ChevronRight, Phone, Calendar, Download, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Infinity, CreditCard, Settings2, Save,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* ─── Helpers ──────────────────────────────────────────────────── */
const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (days: number) => `${days}d`;

const parseLessonDurationToSeconds = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return 0;
  if (raw.includes(":")) {
    const parts = raw.split(":").map((item) => Number(item.trim()));
    if (parts.some((item) => !Number.isFinite(item) || item < 0)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.floor(Number(raw) * 60);
  const hours = Number((raw.match(/(\d+(?:\.\d+)?)\s*h/) || [])[1] || 0);
  const minutes = Number((raw.match(/(\d+(?:\.\d+)?)\s*m/) || [])[1] || 0);
  const seconds = Number((raw.match(/(\d+(?:\.\d+)?)\s*s/) || [])[1] || 0);
  return Math.max(0, Math.floor(hours * 3600 + minutes * 60 + seconds));
};

const computeCurriculumMeta = (chapters: any[]) => {
  const lessons = Array.isArray(chapters) ? chapters.flatMap((ch) => Array.isArray(ch?.lessons) ? ch.lessons : []) : [];
  const videoLessons = lessons.filter((l) => l?.type === "video");
  const totalSeconds = videoLessons.reduce((sum, l) => sum + parseLessonDurationToSeconds(l?.duration), 0);
  return { lectures: videoLessons.length, totalSeconds };
};

const formatSecondsToClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
};

const avatarColor = (name: string) => {
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-teal-500"];
  const i = name.charCodeAt(0) % colors.length;
  return colors[i];
};

type DetailTab = "overview" | "courses" | "activity" | "message";
type AssignableCourseOption = {
  id: string;
  title: string;
  isCombo?: boolean;
  viewOptions?: number[];
  deliveryModes?: Array<{ id?: string; label?: string; name?: string }>;
  masterConfig?: {
    combinations?: Array<{
      viewModeId?: string | null;
      attemptOptionId?: string | null;
      deliveryModeId?: string | null;
    }>;
  };
};

type AccessDraft = {
  expiresAt: string;
  isEnabled: boolean;
  isUnlimitedViews: boolean;
};

type AccessHealth = "active" | "disabled" | "expired" | "out_of_views";

const formatWatchDuration = (seconds?: number) => {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const accessStatusConfig: Record<AccessHealth, { label: string; badge: string }> = {
  active: { label: "Active", badge: "border border-emerald-200 bg-emerald-50 text-emerald-700" },
  disabled: { label: "Disabled", badge: "border border-slate-200 bg-slate-100 text-slate-600" },
  expired: { label: "Expired", badge: "border border-red-200 bg-red-50 text-red-700" },
  out_of_views: { label: "Out of Watch Time", badge: "border border-amber-200 bg-amber-50 text-amber-700" },
};

const getCourseAccessHealth = (access: StudentCourseAccess): AccessHealth => {
  if (access.isEnabled === false) return "disabled";
  if (access.expiresAt) {
    const expiry = new Date(access.expiresAt).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) return "expired";
  }
  if (access.isUnlimitedViews !== true && Math.max(0, Number(access.remainingWatchSeconds || 0)) <= 0) {
    return "out_of_views";
  }
  return "active";
};

/* ─── Component ─────────────────────────────────────────────────── */
export default function AdminUsers() {
  const navigate = useNavigate();
  const { loginAsUser } = useAuth();
  const { courses } = usePlatformData();
  const [assignCourseOptions, setAssignCourseOptions] = useState<AssignableCourseOption[]>([]);
  const [masterViewModes, setMasterViewModes] = useState<CourseMasterViewMode[]>([]);
  const [masterAttemptOptions, setMasterAttemptOptions] = useState<CourseMasterAttemptOption[]>([]);
  const [masterDeliveryModes, setMasterDeliveryModes] = useState<CourseMasterDeliveryMode[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<"Active" | "Inactive" | "">("");
  const [loginTarget, setLoginTarget] = useState<string | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [courseAccess, setCourseAccess] = useState<StudentCourseAccess[]>([]);
  const [loginLogs, setLoginLogs] = useState<StudentLoginLog[]>([]);
  const [videoActivity, setVideoActivity] = useState<StudentVideoActivity[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [studentOrders, setStudentOrders] = useState<AdminOrderGroup[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [selectedAccessCourseId, setSelectedAccessCourseId] = useState("");
  const [accessDraft, setAccessDraft] = useState<AccessDraft>({ expiresAt: "", isEnabled: true, isUnlimitedViews: false });
  const [accessActionKey, setAccessActionKey] = useState("");
  const [accessExtendDays, setAccessExtendDays] = useState("30");
  const [accessExtendWatchHours, setAccessExtendWatchHours] = useState("0");
  const [accessExtendWatchMinutes, setAccessExtendWatchMinutes] = useState("0");
  const [accessExtendDirection, setAccessExtendDirection] = useState<"add" | "subtract">("add");
  const [accessAdjustWatchHours, setAccessAdjustWatchHours] = useState("0");
  const [accessAdjustWatchMinutes, setAccessAdjustWatchMinutes] = useState("0");
  const [accessAdjustDirection, setAccessAdjustDirection] = useState<"add" | "subtract">("add");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [videoActivityQuery, setVideoActivityQuery] = useState("");
  const [videoActivityCourseId, setVideoActivityCourseId] = useState("all");
  const [videoActivityProgress, setVideoActivityProgress] = useState<"all" | "completed" | "in_progress" | "not_started">("all");
  const [videoActivityFromDate, setVideoActivityFromDate] = useState("");
  const [videoActivityToDate, setVideoActivityToDate] = useState("");
  const [showVideoActivityFilters, setShowVideoActivityFilters] = useState(false);

  const [courseForm, setCourseForm] = useState({ courseId: "", purchaseDate: "", durationDays: 180, totalViews: 2, usedViews: 0, notes: "", isEnabled: true });
  const [extendForm, setExtendForm] = useState({ courseId: "", extraDays: 30, extraViews: 1 });
  const [passwordForm, setPasswordForm] = useState({ password: "" });
  const [messageForm, setMessageForm] = useState({ channel: "in_app", subject: "", message: "" });
  const [curriculumMetaByCourse, setCurriculumMetaByCourse] = useState<Record<string, { lectures: number; totalSeconds: number }>>({});
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState<StudentRecord | null>(null);
  const [isAssigningCourse, setIsAssigningCourse] = useState(false);
  const [quickAssignForm, setQuickAssignForm] = useState({
    courseId: "",
    selectedViewModeId: "",
    selectedAttemptOptionId: "",
    selectedModeId: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    validityDays: 180,
    attempts: 2,
    watchHours: 0,
    watchMinutes: 0,
    notes: "",
    isEnabled: true,
  });

  const loadCurriculumMeta = useCallback(async () => {
    try {
      const response = await adminApi.getCourses();
      const rawCurricula = response.curricula && typeof response.curricula === "object" ? response.curricula : {};
      const nextMeta = Object.fromEntries(
        Object.entries(rawCurricula).map(([courseId, chapters]) => [courseId, computeCurriculumMeta(Array.isArray(chapters) ? chapters : [])]),
      );
      setCurriculumMetaByCourse(nextMeta);
    } catch { /* ignore */ }
  }, []);

  const loadStudents = async (search = "") => {
    setIsLoading(true);
    try {
      const data = await adminApi.listStudents(
        search, 
        fromDate ? fromDate + 'T00:00' : undefined, 
        toDate ? toDate + 'T23:59' : undefined
      );
      setStudents(data.students);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudentDetails = async (studentId: string) => {
    if (!studentId) return;
    setDetailLoading(true);
    setDetailError("");
    try {
      const [data, orderHistory] = await Promise.all([
        adminApi.getStudentDetails(studentId),
        adminApi.getStudentOrderHistory(studentId).catch(() => ({ lines: [], grouped: [] })),
      ]);
      setSelectedStudent(data.student);
      setCourseAccess(data.courseAccess || []);
      setLoginLogs(data.loginLogs || []);
      setVideoActivity(data.videoActivity || []);
      setNotifications(data.notifications || []);
      setStudentOrders(orderHistory.grouped || []);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Failed to load student details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { loadStudents(); }, []);
  useEffect(() => { if (selectedStudentId) { loadStudentDetails(selectedStudentId); setActiveTab("overview"); } }, [selectedStudentId]);
  useEffect(() => { void loadCurriculumMeta(); }, [courses.length, loadCurriculumMeta]);
  useEffect(() => {
    let cancelled = false;
    const loadAssignCourses = async () => {
      try {
        const [response, masters] = await Promise.all([adminApi.getCourses(), adminApi.getCourseMasters()]);
        if (cancelled) return;
        const list = Array.isArray(response?.courses)
          ? response.courses.map((course) => {
              const row = (course && typeof course === "object") ? (course as Record<string, unknown>) : {};
              return {
              id: String(course.id || "").trim(),
              title: String(course.title || "Untitled Course").trim(),
              isCombo: Boolean(course.isCombo),
              viewOptions: Array.isArray(row.viewOptions)
                ? row.viewOptions.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 1)
                : [],
              masterConfig: row.masterConfig && typeof row.masterConfig === "object"
                ? (row.masterConfig as AssignableCourseOption["masterConfig"])
                : undefined,
              deliveryModes: Array.isArray(row.deliveryModes)
                ? (row.deliveryModes as Array<{ id?: string; label?: string; name?: string }>)
                : [],
            };
          }).filter((course) => course.id)
          : [];
        setAssignCourseOptions(list);
        setMasterViewModes(Array.isArray(masters?.viewModes) ? masters.viewModes.filter((item) => item.isActive !== false) : []);
        setMasterAttemptOptions(Array.isArray(masters?.attemptOptions) ? masters.attemptOptions.filter((item) => item.isActive !== false) : []);
        setMasterDeliveryModes(Array.isArray(masters?.deliveryModes) ? masters.deliveryModes.filter((item) => item.isActive !== false) : []);
      } catch {
        if (cancelled) return;
        setAssignCourseOptions([]);
        setMasterViewModes([]);
        setMasterAttemptOptions([]);
        setMasterDeliveryModes([]);
      }
    };

    void loadAssignCourses();

    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const handler = () => void loadCurriculumMeta();
    window.addEventListener("curriculum-updated", handler as EventListener);
    return () => window.removeEventListener("curriculum-updated", handler as EventListener);
  }, [loadCurriculumMeta]);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [searchTerm, students]);

  const totalWatchedSeconds = useMemo(() => videoActivity.reduce((sum, item) => sum + Number(item.viewedSeconds || 0), 0), [videoActivity]);

  const courseTitleById = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((course) => {
      const id = String(course.id || "").trim();
      if (!id) return;
      map.set(id, String(course.title || "Untitled Course"));
    });
    return map;
  }, [courses]);

  const videoActivityCourseOptions = useMemo(() => {
    const options = new Map<string, string>();
    videoActivity.forEach((item) => {
      const id = String(item.courseId || "").trim();
      if (!id) return;
      options.set(id, courseTitleById.get(id) || id);
    });
    return Array.from(options.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [videoActivity, courseTitleById]);

  const filteredVideoActivity = useMemo(() => {
    const query = videoActivityQuery.trim().toLowerCase();
    const fromTs = videoActivityFromDate ? new Date(`${videoActivityFromDate}T00:00:00`).getTime() : null;
    const toTs = videoActivityToDate ? new Date(`${videoActivityToDate}T23:59:59`).getTime() : null;

    return videoActivity.filter((item) => {
      if (videoActivityCourseId !== "all" && String(item.courseId || "").trim() !== videoActivityCourseId) {
        return false;
      }

      const progress = Number(item.progressPercent || 0);
      if (videoActivityProgress === "completed" && progress < 100) return false;
      if (videoActivityProgress === "in_progress" && (progress <= 0 || progress >= 100)) return false;
      if (videoActivityProgress === "not_started" && progress > 0) return false;

      if (fromTs !== null || toTs !== null) {
        const lastViewedTs = new Date(item.lastViewedAt || "").getTime();
        if (!Number.isFinite(lastViewedTs)) return false;
        if (fromTs !== null && lastViewedTs < fromTs) return false;
        if (toTs !== null && lastViewedTs > toTs) return false;
      }

      if (!query) return true;
      const courseLabel = courseTitleById.get(String(item.courseId || "").trim()) || String(item.courseId || "");
      const haystack = [courseLabel, item.courseId, item.chapterTitle, item.lessonTitle]
        .map((part) => String(part || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [videoActivity, videoActivityQuery, videoActivityCourseId, videoActivityProgress, videoActivityFromDate, videoActivityToDate, courseTitleById]);

  const selectedCourseMeta = useMemo(() => {
    const meta = curriculumMetaByCourse[courseForm.courseId];
    return { lectures: meta?.lectures || 0, durationText: formatSecondsToClock(meta?.totalSeconds || 0) };
  }, [curriculumMetaByCourse, courseForm.courseId]);

  const selectedManagedAccess = useMemo(
    () => courseAccess.find((access) => access.courseId === selectedAccessCourseId) || null,
    [courseAccess, selectedAccessCourseId],
  );

  const courseAccessStats = useMemo(() => {
    return courseAccess.reduce(
      (acc, access) => {
        const status = getCourseAccessHealth(access);
        acc.total += 1;
        acc[status] += 1;
        return acc;
      },
      { total: 0, active: 0, disabled: 0, expired: 0, out_of_views: 0 },
    );
  }, [courseAccess]);

  const assignableCourses = useMemo(() => {
    const source = assignCourseOptions.length > 0
      ? assignCourseOptions
      : courses.map((course) => ({
          id: String(course.id || "").trim(),
          title: String(course.title || "Untitled Course").trim(),
          isCombo: Boolean(course.isCombo),
          viewOptions: Array.isArray((course as unknown as { viewOptions?: number[] }).viewOptions)
            ? (course as unknown as { viewOptions?: number[] }).viewOptions
            : [],
          masterConfig: (course as unknown as { masterConfig?: AssignableCourseOption["masterConfig"] }).masterConfig,
          deliveryModes: Array.isArray((course as unknown as { deliveryModes?: Array<{ id?: string; label?: string; name?: string }> }).deliveryModes)
            ? (course as unknown as { deliveryModes?: Array<{ id?: string; label?: string; name?: string }> }).deliveryModes
            : [],
        }));
    return source.filter((course) => course.id && !course.isCombo);
  }, [assignCourseOptions, courses]);

  const selectedAssignCourse = useMemo(
    () => assignableCourses.find((item) => item.id === quickAssignForm.courseId) || null,
    [assignableCourses, quickAssignForm.courseId],
  );

  const viewSelectOptions = useMemo(() => {
    if (!selectedAssignCourse) return [] as Array<{ value: string; label: string; views: number | null; isUnlimited?: boolean }>;
    const combos = Array.isArray(selectedAssignCourse.masterConfig?.combinations)
      ? selectedAssignCourse.masterConfig?.combinations || []
      : [];
    const masterIds = Array.from(new Set(combos.map((item) => String(item.viewModeId || "").trim()).filter(Boolean)));
    if (masterIds.length > 0) {
      return masterIds.map((id) => {
        const mode = masterViewModes.find((item) => item.id === id);
        const views = mode?.maxViews ?? null;
        const isUnlimited = mode?.isLifetime === true || views === null;
        return {
          value: id,
          label: mode?.name || id,
          views,
          isUnlimited,
        };
      });
    }

    const fallbackViews = Array.isArray(selectedAssignCourse.viewOptions) && selectedAssignCourse.viewOptions.length > 0
      ? selectedAssignCourse.viewOptions
      : [1, 2, 3];
    return fallbackViews.map((count) => ({
      value: `views:${count}`,
      label: `${count} View${count > 1 ? "s" : ""}`,
      views: count,
      isUnlimited: false,
    }));
  }, [selectedAssignCourse, masterViewModes]);

  const attemptSelectOptions = useMemo(() => {
    if (!selectedAssignCourse) return [] as Array<{ value: string; label: string }>;
    const combos = Array.isArray(selectedAssignCourse.masterConfig?.combinations)
      ? selectedAssignCourse.masterConfig?.combinations || []
      : [];
    const masterIds = Array.from(new Set(combos.map((item) => String(item.attemptOptionId || "").trim()).filter(Boolean)));
    if (masterIds.length > 0) {
      return masterIds.map((id) => {
        const option = masterAttemptOptions.find((item) => item.id === id);
        return {
          value: id,
          label: option?.label || id,
        };
      });
    }
    return [
      { value: "attempt:1", label: "Attempt 1" },
      { value: "attempt:2", label: "Attempt 2" },
      { value: "attempt:3", label: "Attempt 3" },
    ];
  }, [selectedAssignCourse, masterAttemptOptions]);

  const modeSelectOptions = useMemo(() => {
    if (!selectedAssignCourse) return [] as Array<{ value: string; label: string }>;
    const combos = Array.isArray(selectedAssignCourse.masterConfig?.combinations)
      ? selectedAssignCourse.masterConfig?.combinations || []
      : [];
    const masterIds = Array.from(new Set(combos.map((item) => String(item.deliveryModeId || "").trim()).filter(Boolean)));
    if (masterIds.length > 0) {
      return masterIds.map((id) => {
        const mode = masterDeliveryModes.find((item) => item.id === id);
        return {
          value: id,
          label: mode?.name || id,
        };
      });
    }

    const fallback = Array.isArray(selectedAssignCourse.deliveryModes) && selectedAssignCourse.deliveryModes.length > 0
      ? selectedAssignCourse.deliveryModes
      : [{ id: "online", label: "Online" }];

    return fallback.map((item, index) => {
      const rawId = String(item?.id || "").trim();
      const value = rawId || `mode:${index + 1}`;
      const label = String(item?.label || item?.name || rawId || `Mode ${index + 1}`).trim();
      return { value, label };
    });
  }, [selectedAssignCourse, masterDeliveryModes]);

  useEffect(() => {
    if (!quickAssignForm.courseId) return;
    if (viewSelectOptions.length > 0 && !viewSelectOptions.some((item) => item.value === quickAssignForm.selectedViewModeId)) {
      setQuickAssignForm((prev) => ({ ...prev, selectedViewModeId: viewSelectOptions[0].value }));
    }
    if (attemptSelectOptions.length > 0 && !attemptSelectOptions.some((item) => item.value === quickAssignForm.selectedAttemptOptionId)) {
      setQuickAssignForm((prev) => ({ ...prev, selectedAttemptOptionId: attemptSelectOptions[0].value }));
    }
    if (modeSelectOptions.length > 0 && !modeSelectOptions.some((item) => item.value === quickAssignForm.selectedModeId)) {
      setQuickAssignForm((prev) => ({ ...prev, selectedModeId: modeSelectOptions[0].value }));
    }
  }, [quickAssignForm.courseId, quickAssignForm.selectedViewModeId, quickAssignForm.selectedAttemptOptionId, quickAssignForm.selectedModeId, viewSelectOptions, attemptSelectOptions, modeSelectOptions]);

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    setIsSaving(true);
    try {
      const data = await adminApi.updateStudent(editingStudent.id, editingStudent);
      setStudents((prev) => prev.map((s) => (s.id === data.student.id ? data.student : s)));
      setSelectedStudent((prev) => (prev?.id === data.student.id ? data.student : prev));
      setEditDialogOpen(false);
      setEditingStudent(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update student");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Delete this student permanently?")) return;
    try {
      await adminApi.deleteStudent(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      if (selectedStudentId === id) { setSelectedStudentId(""); setSelectedStudent(null); setCourseAccess([]); setLoginLogs([]); setVideoActivity([]); setNotifications([]); setStudentOrders([]); setSelectedAccessCourseId(""); }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete student");
    }
  };

  const handleQuickLogin = async (studentId: string) => {
    setLoginTarget(studentId);
    try {
      const result = await adminApi.quickLogin(studentId);
      localStorage.setItem("ednovate_session_token", result.token);
      loginAsUser(result.student);
      navigate(result.redirectPath || "/dashboard");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Quick login failed");
    } finally {
      setLoginTarget(null);
    }
  };

  const toggleSelected = (id: string, checked: boolean) => setSelectedIds((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredStudents.map((s) => s.id) : []);

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} students?`)) return;
    try {
      await adminApi.bulkDeleteStudents(selectedIds);
      setStudents((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
      setSelectedIds([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Bulk delete failed");
    }
  };

  const bulkUpdateStatus = async () => {
    if (selectedIds.length === 0 || !bulkStatus) return;
    try {
      await adminApi.bulkUpdateStudents(selectedIds, { status: bulkStatus });
      setStudents((prev) => prev.map((s) => (selectedIds.includes(s.id) ? { ...s, status: bulkStatus } : s)));
      setSelectedIds([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Bulk update failed");
    }
  };

  const exportUsersToExcel = async () => {
    setIsExporting(true);
    try {
      const data = await adminApi.listStudents(
        searchTerm, 
        fromDate ? fromDate + 'T00:00' : undefined, 
        toDate ? toDate + 'T23:59' : undefined
      );
      const users = data.students || [];
      
      if (users.length === 0) {
        alert("No users to export");
        return;
      }
      
      const rows = users.map((u) => ({
        "Name": u.name || "",
        "Email": u.email || "",
        "Phone": u.mobile || "",
        "Status": u.status || "",
        "Created": u.createdAt || "",
      }));
      
      const { utils, writeFile } = await import("xlsx");
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Users");
      writeFile(wb, "users-export.xlsx");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const exportVideoActivityCsv = () => {
    if (!selectedStudent) return;
    if (filteredVideoActivity.length === 0) {
      alert("No filtered video activity to export");
      return;
    }

    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Last Viewed",
      "Course",
      "Course Id",
      "Chapter",
      "Video",
      "Progress (%)",
      "Watched (seconds)",
    ];

    const rows = filteredVideoActivity.map((item) => {
      const courseId = String(item.courseId || "").trim();
      const courseTitle = courseTitleById.get(courseId) || courseId || "—";
      return [
        formatDateTime(item.lastViewedAt),
        courseTitle,
        courseId,
        item.chapterTitle || "—",
        item.lessonTitle || "—",
        Number(item.progressPercent || 0).toFixed(0),
        Number(item.viewedSeconds || 0),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `video-activity-${selectedStudent.id}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportVideoActivityPdf = () => {
    if (!selectedStudent) return;
    if (filteredVideoActivity.length === 0) {
      alert("No filtered video activity to export");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const generatedAt = new Date();

    doc.setFontSize(14);
    doc.text("Student Video Watch Activity", 40, 36);
    doc.setFontSize(10);
    doc.text(`Student: ${selectedStudent.name} (${selectedStudent.email})`, 40, 54);
    doc.text(`Generated: ${formatDateTime(generatedAt.toISOString())}`, 40, 68);
    doc.text(
      `Filters: course=${videoActivityCourseId === "all" ? "all" : (courseTitleById.get(videoActivityCourseId) || videoActivityCourseId)}, progress=${videoActivityProgress}, from=${videoActivityFromDate || "any"}, to=${videoActivityToDate || "any"}, search=${videoActivityQuery || "none"}`,
      40,
      82,
    );

    autoTable(doc, {
      startY: 96,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [14, 165, 233] },
      head: [["Last Viewed", "Course", "Chapter", "Video", "Progress", "Watched (s)"]],
      body: filteredVideoActivity.map((item) => {
        const courseId = String(item.courseId || "").trim();
        return [
          formatDateTime(item.lastViewedAt),
          courseTitleById.get(courseId) || courseId || "—",
          item.chapterTitle || "—",
          item.lessonTitle || "—",
          `${Number(item.progressPercent || 0).toFixed(0)}%`,
          String(Number(item.viewedSeconds || 0)),
        ];
      }),
    });

    const stamp = generatedAt.toISOString().replace(/[:.]/g, "-");
    doc.save(`video-activity-${selectedStudent.id}-${stamp}.pdf`);
  };

  const handleSaveCourseAccess = async () => {
    if (!selectedStudentId || !courseForm.courseId) return;
    const selectedCourse = courses.find((c) => c.id === courseForm.courseId);
    if (!selectedCourse) { alert("Select a valid course"); return; }
    try {
      await adminApi.saveStudentCourseAccess(selectedStudentId, { courseId: selectedCourse.id, courseTitle: selectedCourse.title, purchaseDate: courseForm.purchaseDate, durationDays: courseForm.durationDays, totalViews: courseForm.totalViews, usedViews: courseForm.usedViews, notes: courseForm.notes, isEnabled: courseForm.isEnabled });
      await loadStudentDetails(selectedStudentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save course access");
    }
  };

  const handleExtendAccess = async () => {
    if (!selectedStudentId || !extendForm.courseId) return;
    try {
      await adminApi.extendStudentCourseAccess(selectedStudentId, extendForm.courseId, extendForm.extraDays, extendForm.extraViews);
      await loadStudentDetails(selectedStudentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to extend access");
    }
  };

  const handleToggleCourse = async (courseId: string, isEnabled: boolean) => {
    if (!selectedStudentId) return;
    try {
      await adminApi.toggleStudentCourse(selectedStudentId, courseId, isEnabled);
      await loadStudentDetails(selectedStudentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update course state");
    }
  };

  const handleChangePassword = async () => {
    if (!selectedStudentId || !passwordForm.password.trim()) return;
    try {
      await adminApi.changeStudentPassword(selectedStudentId, passwordForm.password.trim());
      setPasswordForm({ password: "" });
      alert("Password updated successfully");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to change password");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedStudentId || !messageForm.message.trim()) return;
    try {
      await adminApi.sendStudentMessage(selectedStudentId, { channel: messageForm.channel, subject: messageForm.subject.trim(), message: messageForm.message.trim() });
      setMessageForm((prev) => ({ ...prev, subject: "", message: "" }));
      await loadStudentDetails(selectedStudentId);
      alert("Message queued successfully");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  const handleDeleteNotification = async (notificationId: number) => {
    if (!selectedStudentId || !notificationId) return;
    if (!confirm("Delete this notification? It will be removed from user side too.")) return;

    try {
      await adminApi.deleteStudentNotification(selectedStudentId, notificationId);
      await loadStudentDetails(selectedStudentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete notification");
    }
  };

  useEffect(() => {
    if (!selectedManagedAccess) {
      setAccessDraft({ expiresAt: "", isEnabled: true, isUnlimitedViews: false });
      return;
    }

    setAccessDraft({
      expiresAt: toDateTimeLocalValue(selectedManagedAccess.expiresAt),
      isEnabled: selectedManagedAccess.isEnabled !== false,
      isUnlimitedViews: selectedManagedAccess.isUnlimitedViews === true,
    });
    setAccessExtendDays("30");
    setAccessExtendWatchHours("0");
    setAccessExtendWatchMinutes("0");
    setAccessExtendDirection("add");
    setAccessAdjustWatchHours("0");
    setAccessAdjustWatchMinutes("0");
    setAccessAdjustDirection("add");
  }, [selectedManagedAccess?.courseId, selectedManagedAccess?.updatedAt]);

  const runAccessAction = async (actionKey: string, callback: () => Promise<unknown>) => {
    setAccessActionKey(actionKey);
    try {
      await callback();
      if (selectedStudentId) {
        await loadStudentDetails(selectedStudentId);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update access");
    } finally {
      setAccessActionKey("");
    }
  };

  const openQuickAssignDialog = (student: StudentRecord) => {
    setAssigningStudent(student);
    setQuickAssignForm({
      courseId: "",
      selectedViewModeId: "",
      selectedAttemptOptionId: "",
      selectedModeId: "",
      purchaseDate: new Date().toISOString().slice(0, 10),
      validityDays: 180,
      attempts: 2,
      watchHours: 0,
      watchMinutes: 0,
      notes: "",
      isEnabled: true,
    });
    setAssignDialogOpen(true);
  };

  const handleQuickAssignCourse = async () => {
    if (!assigningStudent?.id || !quickAssignForm.courseId) {
      alert("Please select a course");
      return;
    }

    const course = assignableCourses.find((item) => item.id === quickAssignForm.courseId);
    if (!course) {
      alert("Selected course not found");
      return;
    }

    const selectedView = viewSelectOptions.find((item) => item.value === quickAssignForm.selectedViewModeId) || null;
    const selectedAttempt = attemptSelectOptions.find((item) => item.value === quickAssignForm.selectedAttemptOptionId) || null;
    const selectedMode = modeSelectOptions.find((item) => item.value === quickAssignForm.selectedModeId) || null;
    const parsedAttemptFromLabel = selectedAttempt ? Number((selectedAttempt.label.match(/(\d+)/) || [])[1] || 0) : 0;
    const resolvedAttempts = Math.max(
      1,
      selectedView?.views || parsedAttemptFromLabel || Number(quickAssignForm.attempts || 1),
    );

    const noteParts = [quickAssignForm.notes.trim()].filter(Boolean);
    if (selectedView) noteParts.push(`View: ${selectedView.label}`);
    if (selectedAttempt) noteParts.push(`Attempt: ${selectedAttempt.label}`);
    if (selectedMode) noteParts.push(`Mode: ${selectedMode.label}`);

    const manualWatchHours = Math.max(0, Number(quickAssignForm.watchHours || 0))
      + (Math.max(0, Number(quickAssignForm.watchMinutes || 0)) / 60);

    setIsAssigningCourse(true);
    try {
      await adminApi.saveStudentCourseAccess(assigningStudent.id, {
        courseId: course.id,
        courseTitle: course.title,
        purchaseDate: quickAssignForm.purchaseDate,
        durationDays: Math.max(1, Number(quickAssignForm.validityDays || 1)),
        totalViews: resolvedAttempts,
        isUnlimitedViews: selectedView?.isUnlimited === true,
        usedViews: 0,
        notes: noteParts.join(" | "),
        isEnabled: quickAssignForm.isEnabled,
      });

      if (manualWatchHours > 0) {
        await adminApi.extendStudentCourseAccess(assigningStudent.id, course.id, 0, 0, manualWatchHours);
      }

      if (selectedStudentId === assigningStudent.id) {
        await loadStudentDetails(assigningStudent.id);
      }

      setAssignDialogOpen(false);
      setAssigningStudent(null);
      alert("Course assigned successfully");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to assign course");
    } finally {
      setIsAssigningCourse(false);
    }
  };

  /* ─── Tab definitions ─── */
  const tabs: { key: DetailTab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: Shield },
    { key: "courses", label: "Courses", icon: BookOpen },
    { key: "activity", label: "Activity", icon: Activity },
    { key: "message", label: "Message", icon: MessageSquare },
  ];

  const activeCount = students.filter((s) => s.status === "Active").length;

  return (
    <div className="space-y-5 font-['Inter']">

      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/25">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="mt-0.5 text-xs text-slate-500">Manage profiles, course access, activity logs and communication.</p>
        </div>
      </div>

      {/* ─── Stat Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: students.length, icon: Users, color: "text-slate-700", bg: "bg-gradient-to-br from-slate-100 to-slate-50", border: "border-slate-200" },
          { label: "Active", value: activeCount, icon: Shield, color: "text-emerald-700", bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/50", border: "border-emerald-200" },
          { label: "Inactive", value: students.length - activeCount, icon: ToggleLeft, color: "text-slate-500", bg: "bg-gradient-to-br from-slate-50 to-slate-100/50", border: "border-slate-200" },
          { label: "Enrollments", value: courseAccess.length, icon: GraduationCap, color: "text-blue-700", bg: "bg-gradient-to-br from-blue-50 to-blue-100/50", border: "border-blue-200" },
        ].map((stat) => (
          <div key={stat.label} className={`flex items-center gap-3 rounded-2xl border ${stat.border} bg-white p-4 shadow-sm`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Student Table Card ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50/50 px-5 py-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Student Directory</h2>
                <p className="text-xs text-slate-500">{filteredStudents.length} records</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-slate-200 text-xs" onClick={() => loadStudents(searchTerm)}>
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 w-56 rounded-xl border-slate-200 bg-white pl-9 text-xs" placeholder="Search name or email…" />
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-red-200 text-xs text-red-600 hover:bg-red-50" onClick={bulkDelete} disabled={selectedIds.length === 0}>
              <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedIds.length})
            </Button>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as "Active" | "Inactive" | "")} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Bulk Status…</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <Button variant="outline" size="sm" className="h-9 rounded-xl border-slate-200 text-xs" onClick={bulkUpdateStatus} disabled={!bulkStatus || selectedIds.length === 0}>Apply</Button>
            <Button variant="outline" size="sm" className={`h-9 gap-1.5 rounded-xl border-slate-200 text-xs ${showDateFilter ? "bg-gray-100" : ""}`} onClick={() => setShowDateFilter(!showDateFilter)}>
              <Calendar className="h-3.5 w-3.5" /> Date {showDateFilter ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-emerald-200 text-xs text-emerald-600 hover:bg-emerald-50" onClick={exportUsersToExcel} disabled={isExporting}>
              <Download className={`h-3.5 w-3.5 ${isExporting ? "animate-pulse" : ""}`} /> {isExporting ? "Exporting..." : "Export"}
            </Button>
          </div>

          {showDateFilter && (
            <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-600">From:</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[140px] h-8" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-600">To:</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[140px] h-8" />
              </div>
              <Button size="sm" onClick={() => loadStudents(searchTerm)}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/40">
                <th className="px-5 py-3 text-left">
                  <input type="checkbox" className="rounded border-slate-300" checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length} onChange={(e) => toggleAll(e.target.checked)} />
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Student</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary/50" /><p className="text-sm text-slate-500">Loading…</p></td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center"><Users className="mx-auto mb-2 h-7 w-7 text-slate-300" /><p className="text-sm font-medium text-slate-500">No students found</p></td></tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="group cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => { setSelectedStudentId(student.id); setDetailDialogOpen(true); }}
                  >
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-slate-300" checked={selectedIds.includes(student.id)} onChange={(e) => toggleSelected(student.id, e.target.checked)} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(student.name)}`}>
                          {student.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{student.name}</p>
                          <p className="text-[11px] text-slate-500">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-slate-600">{student.mobile || "—"}</p>
                      <p className="text-[11px] text-slate-400">{student.city ? `${student.city}, ${student.state || ""}` : "—"}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${student.status === "Active" ? "border border-emerald-200 bg-emerald-100 text-emerald-700" : "border border-slate-200 bg-slate-100 text-slate-600"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${student.status === "Active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {student.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {/* Edit */}
                        <Dialog open={editDialogOpen && editingStudent?.id === student.id} onOpenChange={setEditDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-primary" onClick={() => setEditingStudent(student)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md rounded-2xl border border-slate-100 p-0 shadow-2xl">
                            <DialogHeader className="border-b border-slate-100 px-6 py-4">
                              <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                                  <Edit2 className="h-3.5 w-3.5 text-primary" />
                                </div>
                                Edit Student
                              </DialogTitle>
                            </DialogHeader>
                            {editingStudent && (
                              <div className="space-y-3 px-6 py-5">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Name</label><Input className="h-9 rounded-xl border-slate-200 text-sm" value={editingStudent.name} onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })} /></div>
                                  <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mobile</label><Input className="h-9 rounded-xl border-slate-200 text-sm" value={editingStudent.mobile} onChange={(e) => setEditingStudent({ ...editingStudent, mobile: e.target.value })} /></div>
                                </div>
                                <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Email</label><Input className="h-9 rounded-xl border-slate-200 text-sm" value={editingStudent.email} onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })} /></div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">City</label><Input className="h-9 rounded-xl border-slate-200 text-sm" value={editingStudent.city} onChange={(e) => setEditingStudent({ ...editingStudent, city: e.target.value })} /></div>
                                  <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">State</label><Input className="h-9 rounded-xl border-slate-200 text-sm" value={editingStudent.state} onChange={(e) => setEditingStudent({ ...editingStudent, state: e.target.value })} /></div>
                                  <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Country</label><Input className="h-9 rounded-xl border-slate-200 text-sm" value={editingStudent.country} onChange={(e) => setEditingStudent({ ...editingStudent, country: e.target.value })} /></div>
                                </div>
                                <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Education Level</label><Input className="h-9 rounded-xl border-slate-200 text-sm" value={editingStudent.educationLevel || ""} onChange={(e) => setEditingStudent({ ...editingStudent, educationLevel: e.target.value })} /></div>
                                <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bio</label><Textarea className="rounded-xl border-slate-200 text-sm" value={editingStudent.bio || ""} onChange={(e) => setEditingStudent({ ...editingStudent, bio: e.target.value })} rows={2} /></div>
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <Switch checked={editingStudent.status === "Active"} onCheckedChange={(checked) => setEditingStudent({ ...editingStudent, status: checked ? "Active" : "Inactive" })} />
                                  <span className="text-sm font-medium text-slate-700">Account Active</span>
                                </div>
                                <Button onClick={handleUpdateStudent} className="w-full rounded-xl font-semibold" disabled={isSaving}>
                                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        {/* Quick Login */}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600" onClick={() => handleQuickLogin(student.id)} disabled={loginTarget === student.id}>
                          {loginTarget === student.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                        </Button>

                        {/* Quick Assign Course */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-emerald-600"
                          onClick={() => openQuickAssignDialog(student)}
                          title="Assign Course"
                        >
                          <GraduationCap className="h-3.5 w-3.5" />
                        </Button>

                        {/* Delete */}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => handleDeleteStudent(student.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>

                        {/* View Profile arrow */}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" onClick={() => { setSelectedStudentId(student.id); setDetailDialogOpen(true); }}>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Student Detail Dialog ──────────────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-h-[94vh] max-w-4xl overflow-hidden rounded-2xl border border-slate-100 bg-white p-0 shadow-2xl flex flex-col">
          {/* Dialog Header */}
          <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
            {detailLoading ? (
              <DialogTitle className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading student…</DialogTitle>
            ) : selectedStudent ? (
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${avatarColor(selectedStudent.name)}`}>
                  {selectedStudent.name[0]?.toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 leading-tight">{selectedStudent.name}</DialogTitle>
                  <p className="text-xs text-slate-500">{selectedStudent.email} · ID: {selectedStudent.id}</p>
                </div>
                <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedStudent.status === "Active" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-slate-200 bg-slate-100 text-slate-600"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedStudent.status === "Active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {selectedStudent.status}
                </span>
              </div>
            ) : (
              <DialogTitle className="text-sm font-bold text-slate-900">Student Profile</DialogTitle>
            )}
          </DialogHeader>

          {/* Tabs */}
          <div className="shrink-0 flex border-b border-slate-100 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${activeTab === tab.key ? "border-b-2 border-primary text-primary" : "text-slate-500 hover:text-slate-700"}`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.key === "courses" && courseAccess.length > 0 && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">{courseAccess.length}</span>
                )}
                {tab.key === "activity" && (loginLogs.length > 0 || videoActivity.length > 0) && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-bold text-slate-600">{loginLogs.length + videoActivity.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {detailError ? (
              <div className="flex items-center justify-center py-16 text-sm text-red-600">{detailError}</div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
            ) : !selectedStudent ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">Select a student from the list.</div>
            ) : (

              /* ── OVERVIEW TAB ── */
              activeTab === "overview" ? (
                <div className="space-y-5 p-6">
                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Courses", value: courseAccess.length, color: "text-blue-700 bg-blue-50" },
                      { label: "Orders", value: studentOrders.length, color: "text-amber-700 bg-amber-50" },
                      { label: "Videos Watched", value: videoActivity.length, color: "text-violet-700 bg-violet-50" },
                      { label: "Watch Time", value: `${(totalWatchedSeconds / 3600).toFixed(1)}h`, color: "text-emerald-700 bg-emerald-50" },
                    ].map((stat) => (
                      <div key={stat.label} className={`rounded-xl px-4 py-3 ${stat.color}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{stat.label}</p>
                        <p className="mt-0.5 text-lg font-bold">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Profile Info */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                    {[
                      { icon: Mail, label: "Email", value: selectedStudent.email },
                      { icon: Phone, label: "Mobile", value: selectedStudent.mobile || "—" },
                      { icon: MapPin, label: "Location", value: [selectedStudent.city, selectedStudent.state, selectedStudent.country].filter(Boolean).join(", ") || "—" },
                      { icon: GraduationCap, label: "Education", value: selectedStudent.educationLevel || "—" },
                      { icon: Clock, label: "Last Login", value: formatDateTime(loginLogs[0]?.createdAt) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                        <row.icon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500 w-20 shrink-0">{row.label}</span>
                        <span className="text-xs text-slate-800">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Reset Password */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-slate-500" /> Reset Password</p>
                    <div className="flex gap-2">
                      <Input type="password" placeholder="Enter new password" value={passwordForm.password} onChange={(e) => setPasswordForm({ password: e.target.value })} className="h-9 rounded-xl border-slate-200 text-sm" />
                      <Button size="sm" className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold" onClick={handleChangePassword}>Update</Button>
                    </div>
                  </div>

                  {/* Quick Login */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-blue-800">Quick Login as Student</p>
                      <p className="text-[11px] text-blue-600 mt-0.5">Login to student account directly for support/debugging.</p>
                    </div>
                    <Button size="sm" className="h-9 gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold hover:bg-blue-700" onClick={() => handleQuickLogin(selectedStudent.id)} disabled={loginTarget === selectedStudent.id}>
                      {loginTarget === selectedStudent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                      Login as Student
                    </Button>
                  </div>
                </div>

              /* ── COURSES TAB ── */
              ) : activeTab === "courses" ? (
                <div className="space-y-5 p-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Purchased", value: courseAccessStats.total, color: "text-slate-700 bg-slate-50", icon: BookOpen },
                      { label: "Active", value: courseAccessStats.active, color: "text-emerald-700 bg-emerald-50", icon: CheckCircle2 },
                      { label: "Expired", value: courseAccessStats.expired, color: "text-red-700 bg-red-50", icon: XCircle },
                      { label: "Out of Time", value: courseAccessStats.out_of_views, color: "text-amber-700 bg-amber-50", icon: Clock },
                    ].map((stat) => (
                      <div key={stat.label} className={`rounded-xl px-4 py-3 ${stat.color}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{stat.label}</p>
                          <stat.icon className="h-4 w-4 opacity-70" />
                        </div>
                        <p className="mt-0.5 text-lg font-bold">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-slate-800">Order / Purchase History</p>
                      <span className="text-[11px] text-slate-500">{studentOrders.length} orders</span>
                    </div>
                    {studentOrders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">No purchase history found</div>
                    ) : (
                      <div className="space-y-3">
                        {studentOrders.slice(0, 10).map((order) => (
                          <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-slate-900">Order {order.id}</p>
                                <p className="text-[11px] text-slate-500">{formatDateTime(order.date)} · {order.paymentMethod || "Payment recorded"}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-semibold text-slate-900">₹{Number(order.total || 0).toLocaleString("en-IN")}</p>
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">{order.dispatchStatus || order.status}</span>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {order.items.map((item, index) => (
                                <div key={`${order.id}-${item.id || index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-slate-800">{item.title}</p>
                                    <p className="text-[11px] text-slate-500">{item.itemType || "course"}{item.modeLabel ? ` · ${item.modeLabel}` : ""}{item.bookLabel ? ` · ${item.bookLabel}` : ""}</p>
                                  </div>
                                  <p className="shrink-0 font-semibold text-slate-700">₹{Number(item.price || 0).toLocaleString("en-IN")}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assign / Update */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-800">Assign / Update Course Access</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Course</label>
                        <select value={courseForm.courseId} onChange={(e) => setCourseForm((p) => ({ ...p, courseId: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40">
                          <option value="">Select course…</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <BookOpen className="h-4 w-4 text-slate-400" />
                        <span>{selectedCourseMeta.lectures} lectures · {selectedCourseMeta.durationText}</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Purchase Date</label>
                        <Input type="date" className="h-9 rounded-xl border-slate-200 text-xs" value={courseForm.purchaseDate} onChange={(e) => setCourseForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Duration (days)</label>
                        <Input type="number" className="h-9 rounded-xl border-slate-200 text-xs" value={courseForm.durationDays} onChange={(e) => setCourseForm((p) => ({ ...p, durationDays: Number(e.target.value) || 0 }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Views</label>
                        <Input type="number" className="h-9 rounded-xl border-slate-200 text-xs" value={courseForm.totalViews} onChange={(e) => setCourseForm((p) => ({ ...p, totalViews: Number(e.target.value) || 0 }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Used Views</label>
                        <Input type="number" className="h-9 rounded-xl border-slate-200 text-xs" value={courseForm.usedViews} onChange={(e) => setCourseForm((p) => ({ ...p, usedViews: Number(e.target.value) || 0 }))} />
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Switch checked={courseForm.isEnabled} onCheckedChange={(v) => setCourseForm((p) => ({ ...p, isEnabled: v }))} />
                        <span className="text-xs font-medium text-slate-700">Access Enabled</span>
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notes</label>
                        <Textarea className="rounded-xl border-slate-200 text-xs" value={courseForm.notes} onChange={(e) => setCourseForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes…" />
                      </div>
                    </div>
                    <Button size="sm" className="rounded-xl px-4 text-xs font-semibold" onClick={handleSaveCourseAccess}>Save Course Access</Button>
                  </div>

                  {/* Extend */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-800">Extend Duration / Views</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Course</label>
                        <select value={extendForm.courseId} onChange={(e) => setExtendForm((p) => ({ ...p, courseId: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40">
                          <option value="">Select…</option>
                          {courseAccess.map((a) => <option key={a.courseId} value={a.courseId}>{a.courseTitle}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Extra Days</label>
                        <Input type="number" className="h-9 rounded-xl border-slate-200 text-xs" value={extendForm.extraDays} onChange={(e) => setExtendForm((p) => ({ ...p, extraDays: Number(e.target.value) || 0 }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Extra Views</label>
                        <Input type="number" className="h-9 rounded-xl border-slate-200 text-xs" value={extendForm.extraViews} onChange={(e) => setExtendForm((p) => ({ ...p, extraViews: Number(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl border-slate-200 px-4 text-xs font-semibold" onClick={handleExtendAccess}>Extend Access</Button>
                  </div>

                  {/* Purchased Courses List */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-800">Purchased Courses ({courseAccess.length})</p>
                    {courseAccess.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No courses assigned yet</div>
                    ) : (
                      courseAccess.map((access) => (
                        <div key={`${access.studentId}-${access.courseId}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold text-slate-900 line-clamp-1">{access.courseTitle}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${accessStatusConfig[getCourseAccessHealth(access)].badge}`}>
                                  {accessStatusConfig[getCourseAccessHealth(access)].label}
                                </span>
                                {access.isUnlimitedViews ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                    <Infinity className="h-3 w-3" /> Unlimited
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                Purchase: {formatDateTime(access.purchaseDate)} · Expires: {formatDateTime(access.expiresAt)}
                              </p>
                              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                  <p className="font-semibold text-slate-700">Views</p>
                                  <p>{access.usedViews}/{access.totalViews} used · {access.remainingViews} left</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                  <p className="font-semibold text-slate-700">Watch Time</p>
                                  <p>{access.isUnlimitedViews ? "Unlimited" : `${formatWatchDuration(access.remainingWatchSeconds)} left`}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                  <p className="font-semibold text-slate-700">Notes</p>
                                  <p className="line-clamp-2">{access.notes || "No notes"}</p>
                                </div>
                              </div>
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-2">
                              <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200 px-3 text-[11px]" onClick={() => handleToggleCourse(access.courseId, !access.isEnabled)}>
                                {access.isEnabled ? <ToggleLeft className="mr-1 h-3.5 w-3.5" /> : <ToggleRight className="mr-1 h-3.5 w-3.5" />}
                                {access.isEnabled ? "Disable" : "Enable"}
                              </Button>
                              <Button size="sm" className="h-8 rounded-lg px-3 text-[11px] font-semibold" onClick={() => setSelectedAccessCourseId(access.courseId)}>
                                Manage
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              /* ── ACTIVITY TAB ── */
              ) : activeTab === "activity" ? (
                <div className="space-y-5 p-6">
                  {/* Login History */}
                  <div>
                    <p className="mb-2 text-xs font-bold text-slate-800">Login History ({loginLogs.length})</p>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-100 bg-slate-50"><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Time</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Source</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">IP</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Device</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {loginLogs.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400">No login logs</td></tr>
                          ) : loginLogs.slice(0, 50).map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-600">{formatDateTime(log.createdAt)}</td>
                              <td className="px-4 py-2 text-slate-600">{log.source || "student_login"}</td>
                              <td className="px-4 py-2 text-slate-500">{log.ipAddress || "—"}</td>
                              <td className="max-w-[200px] truncate px-4 py-2 text-slate-500">{log.userAgent || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Video Activity */}
                  <div>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">Video Watch Activity ({filteredVideoActivity.length})</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl border-slate-200 px-3 text-[11px]"
                          onClick={() => setShowVideoActivityFilters((prev) => !prev)}
                        >
                          Filters {showVideoActivityFilters ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl border-slate-200 px-3 text-[11px]"
                          onClick={exportVideoActivityCsv}
                          disabled={filteredVideoActivity.length === 0}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" /> CSV
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl border-slate-200 px-3 text-[11px]"
                          onClick={exportVideoActivityPdf}
                          disabled={filteredVideoActivity.length === 0}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" /> PDF
                        </Button>
                      </div>
                    </div>

                    {showVideoActivityFilters ? (
                      <div className="mb-3 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-5">
                        <Input
                          value={videoActivityQuery}
                          onChange={(e) => setVideoActivityQuery(e.target.value)}
                          className="h-8 rounded-lg border-slate-200 bg-white text-xs"
                          placeholder="Search course/chapter/video"
                        />
                        <select
                          value={videoActivityCourseId}
                          onChange={(e) => setVideoActivityCourseId(e.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <option value="all">All Courses</option>
                          {videoActivityCourseOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.title}</option>
                          ))}
                        </select>
                        <select
                          value={videoActivityProgress}
                          onChange={(e) => setVideoActivityProgress(e.target.value as "all" | "completed" | "in_progress" | "not_started")}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <option value="all">All Progress</option>
                          <option value="completed">Completed (100%)</option>
                          <option value="in_progress">In Progress (1-99%)</option>
                          <option value="not_started">Not Started (0%)</option>
                        </select>
                        <Input
                          type="date"
                          value={videoActivityFromDate}
                          onChange={(e) => setVideoActivityFromDate(e.target.value)}
                          className="h-8 rounded-lg border-slate-200 bg-white text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={videoActivityToDate}
                            onChange={(e) => setVideoActivityToDate(e.target.value)}
                            className="h-8 rounded-lg border-slate-200 bg-white text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-lg px-2 text-[11px]"
                            onClick={() => {
                              setVideoActivityQuery("");
                              setVideoActivityCourseId("all");
                              setVideoActivityProgress("all");
                              setVideoActivityFromDate("");
                              setVideoActivityToDate("");
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-100 bg-slate-50"><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Viewed</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Course / Chapter</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Video</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Progress</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Watched</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredVideoActivity.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400">No video activity</td></tr>
                          ) : filteredVideoActivity.slice(0, 200).map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-500">{formatDateTime(item.lastViewedAt)}</td>
                              <td className="px-4 py-2">
                                <p className="text-slate-600 truncate max-w-[120px]">{courseTitleById.get(String(item.courseId || "").trim()) || item.courseId || "—"}</p>
                                <p className="text-slate-400 truncate max-w-[120px]">{item.chapterTitle || "—"}</p>
                              </td>
                              <td className="max-w-[150px] truncate px-4 py-2 text-slate-600">{item.lessonTitle || "—"}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, item.progressPercent)}%` }} />
                                  </div>
                                  <span className="text-slate-600">{item.progressPercent.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-slate-600">{item.viewedSeconds}s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              /* ── MESSAGE TAB ── */
              ) : activeTab === "message" ? (
                <div className="space-y-5 p-6">
                  {/* Send Form */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-800">Send Message / Notification</p>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Channel</label>
                      <div className="flex flex-wrap gap-2">
                        {["in_app", "email", "sms", "whatsapp"].map((ch) => (
                          <button key={ch} type="button" onClick={() => setMessageForm((p) => ({ ...p, channel: ch }))}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${messageForm.channel === ch ? "border-primary/40 bg-primary/10 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                            {ch === "in_app" ? "In App" : ch.charAt(0).toUpperCase() + ch.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subject</label>
                      <Input className="h-9 rounded-xl border-slate-200 text-sm" placeholder="Subject line…" value={messageForm.subject} onChange={(e) => setMessageForm((p) => ({ ...p, subject: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message</label>
                      <Textarea className="rounded-xl border-slate-200 text-sm" rows={4} placeholder="Type your message…" value={messageForm.message} onChange={(e) => setMessageForm((p) => ({ ...p, message: e.target.value }))} />
                    </div>
                    <Button size="sm" className="gap-1.5 rounded-xl px-4 text-xs font-semibold" onClick={handleSendMessage}>
                      <Send className="h-3.5 w-3.5" /> Send Message
                    </Button>
                  </div>

                  {/* Notification History */}
                  <div>
                    <p className="mb-2 text-xs font-bold text-slate-800">Notification History ({notifications.length})</p>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-100 bg-slate-50"><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Time</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Channel</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Subject</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Message</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th><th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Action</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {notifications.length === 0 ? (
                            <tr><td colSpan={6} className="py-8 text-center text-slate-400">No messages sent yet</td></tr>
                          ) : notifications.map((n) => (
                            <tr key={n.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-500">{formatDateTime(n.createdAt)}</td>
                              <td className="px-4 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{n.channel}</span></td>
                              <td className="px-4 py-2 text-slate-600">{n.subject || "—"}</td>
                              <td className="max-w-[200px] truncate px-4 py-2 text-slate-500">{n.message}</td>
                              <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${n.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{n.status}</span></td>
                              <td className="px-4 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                  onClick={() => void handleDeleteNotification(n.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedManagedAccess)} onOpenChange={(open) => !open && setSelectedAccessCourseId("") }>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-slate-900">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Settings2 className="h-4 w-4 text-primary" />
              </div>
              Manage Course Access
            </DialogTitle>
            {selectedManagedAccess ? (
              <div className="mt-1 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{selectedStudent?.name || "Student"}</span>
                <span> · </span>
                <span>{selectedManagedAccess.courseTitle}</span>
              </div>
            ) : null}
          </DialogHeader>

          {selectedManagedAccess ? (
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-2 gap-4 px-6 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Student</p>
                  <p className="font-semibold text-slate-900">{selectedStudent?.name || "—"}</p>
                  <p className="text-xs text-slate-500">{selectedStudent?.email || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Course</p>
                  <p className="font-semibold text-slate-900">{selectedManagedAccess.courseTitle}</p>
                  <p className="text-xs text-slate-500">{selectedManagedAccess.courseId}</p>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">Access Snapshot</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Status", value: accessStatusConfig[getCourseAccessHealth(selectedManagedAccess)].label },
                    { label: "Views", value: `${selectedManagedAccess.usedViews}/${selectedManagedAccess.totalViews}` },
                    { label: "Watch Left", value: selectedManagedAccess.isUnlimitedViews ? "Unlimited" : formatWatchDuration(selectedManagedAccess.remainingWatchSeconds) },
                    { label: "Expiry", value: formatDateTime(selectedManagedAccess.expiresAt) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Expiry Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={accessDraft.expiresAt}
                      onChange={(e) => setAccessDraft((prev) => ({ ...prev, expiresAt: e.target.value }))}
                      className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Access State</label>
                      <div className="flex gap-2">
                        {(["enabled", "disabled"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setAccessDraft((prev) => ({ ...prev, isEnabled: mode === "enabled" }))}
                            className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${(mode === "enabled" ? accessDraft.isEnabled : !accessDraft.isEnabled) ? "border-primary/40 bg-primary/10 text-primary shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                          >
                            {mode === "enabled" ? "Enabled" : "Disabled"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Watch Limit</label>
                      <div className="flex gap-2">
                        {[{ value: false, label: "Limited" }, { value: true, label: "Unlimited" }].map((mode) => (
                          <button
                            key={mode.label}
                            type="button"
                            onClick={() => setAccessDraft((prev) => ({ ...prev, isUnlimitedViews: mode.value }))}
                            className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${accessDraft.isUnlimitedViews === mode.value ? "border-primary/40 bg-primary/10 text-primary shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">Extend / Reduce Credits</h3>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex gap-2">
                    {(["add", "subtract"] as const).map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        onClick={() => setAccessExtendDirection(direction)}
                        className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${accessExtendDirection === direction ? direction === "add" ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm" : "border-red-200 bg-red-50 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                      >
                        {direction === "add" ? "Add Credits" : "Subtract Credits"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Days</label>
                      <Input type="number" min={0} value={accessExtendDays} onChange={(e) => setAccessExtendDays(e.target.value)} className="h-9 rounded-xl border-slate-200 bg-white text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Watch Hrs</label>
                      <Input type="number" min={0} value={accessExtendWatchHours} onChange={(e) => setAccessExtendWatchHours(e.target.value)} className="h-9 rounded-xl border-slate-200 bg-white text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Watch Mins</label>
                      <Input type="number" min={0} max={59} value={accessExtendWatchMinutes} onChange={(e) => setAccessExtendWatchMinutes(e.target.value)} className="h-9 rounded-xl border-slate-200 bg-white text-sm" />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs font-semibold"
                    disabled={accessActionKey === "extend"}
                    onClick={() => {
                      const extraDays = Math.max(0, Number(accessExtendDays || 0));
                      const watchHours = Math.max(0, Number(accessExtendWatchHours || 0));
                      const watchMinutes = Math.max(0, Math.min(59, Number(accessExtendWatchMinutes || 0)));
                      const totalWatchHours = watchHours + watchMinutes / 60;
                      if (extraDays <= 0 && totalWatchHours <= 0) {
                        alert("Please add at least one credit: days or watch time.");
                        return;
                      }
                      const signedDays = accessExtendDirection === "subtract" ? -extraDays : extraDays;
                      const signedWatch = accessExtendDirection === "subtract" ? -totalWatchHours : totalWatchHours;
                      void runAccessAction("extend", () => adminApi.extendStudentCourseAccess(selectedManagedAccess.studentId, selectedManagedAccess.courseId, signedDays, 0, signedWatch));
                    }}
                  >
                    {accessActionKey === "extend" ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying…</> : accessExtendDirection === "subtract" ? "Apply Reduction" : "Apply Extension"}
                  </Button>
                </div>

                {!accessDraft.isUnlimitedViews ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-700">Manual Watch Time Adjust</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Action</label>
                        <select value={accessAdjustDirection} onChange={(e) => setAccessAdjustDirection(e.target.value === "subtract" ? "subtract" : "add")} className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700">
                          <option value="add">Add Time</option>
                          <option value="subtract">Subtract Time</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hours</label>
                        <Input type="number" min={0} value={accessAdjustWatchHours} onChange={(e) => setAccessAdjustWatchHours(e.target.value)} className="h-9 rounded-xl border-slate-200 bg-white text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mins</label>
                        <Input type="number" min={0} max={59} value={accessAdjustWatchMinutes} onChange={(e) => setAccessAdjustWatchMinutes(e.target.value)} className="h-9 rounded-xl border-slate-200 bg-white text-sm" />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl text-xs font-semibold"
                      disabled={accessActionKey === "watch-adjust"}
                      onClick={() => {
                        const hoursPart = Math.max(0, Number(accessAdjustWatchHours || 0));
                        const minutesPart = Math.max(0, Math.min(59, Number(accessAdjustWatchMinutes || 0)));
                        const totalHours = hoursPart + minutesPart / 60;
                        if (totalHours <= 0) {
                          alert("Enter watch time greater than 0.");
                          return;
                        }
                        const signedHours = accessAdjustDirection === "subtract" ? -totalHours : totalHours;
                        void runAccessAction("watch-adjust", () => adminApi.adjustStudentCourseWatchTime(selectedManagedAccess.studentId, selectedManagedAccess.courseId, signedHours));
                      }}
                    >
                      {accessActionKey === "watch-adjust" ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying…</> : "Apply Watch Adjustment"}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 px-6 py-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl border-slate-200 text-xs text-slate-600"
                    disabled={accessActionKey === "reset"}
                    onClick={() => {
                      if (!window.confirm("Reset used views/watch-time for this course access to zero?")) return;
                      void runAccessAction("reset", () => adminApi.resetStudentCourseViews(selectedManagedAccess.studentId, selectedManagedAccess.courseId, 0));
                    }}
                  >
                    <RefreshCcw className="h-3.5 w-3.5" /> Reset Views
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl border-red-200 text-xs text-red-600 hover:bg-red-50"
                    disabled={accessActionKey === "remove"}
                    onClick={() => {
                      if (!window.confirm("Remove this course access for the student? This cannot be undone.")) return;
                      void runAccessAction("remove", async () => {
                        await adminApi.removeStudentCourseAccess(selectedManagedAccess.studentId, selectedManagedAccess.courseId);
                        setSelectedAccessCourseId("");
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove Access
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs text-slate-600" onClick={() => setSelectedAccessCourseId("")}>Cancel</Button>
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-xl px-4 text-xs font-semibold"
                    disabled={accessActionKey === "save"}
                    onClick={() => {
                      void runAccessAction("save", () => adminApi.updateStudentCourseAccess(selectedManagedAccess.studentId, selectedManagedAccess.courseId, {
                        courseTitle: selectedManagedAccess.courseTitle,
                        expiresAt: accessDraft.expiresAt ? new Date(accessDraft.expiresAt).toISOString() : null,
                        isEnabled: accessDraft.isEnabled,
                        isUnlimitedViews: accessDraft.isUnlimitedViews,
                      }));
                    }}
                  >
                    {accessActionKey === "save" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> Save Access</>}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Quick Assign Course Dialog ─────────────────────────── */}
      <Dialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open && !isAssigningCourse) setAssigningStudent(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl border border-slate-100 p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">
              Assign Course
              {assigningStudent ? <span className="ml-2 text-xs font-medium text-slate-500">to {assigningStudent.name}</span> : null}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Course</label>
              <select
                value={quickAssignForm.courseId}
                onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, courseId: e.target.value, selectedViewModeId: "", selectedAttemptOptionId: "", selectedModeId: "" }))}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">{assignableCourses.length === 0 ? "No courses available" : "Select course…"}</option>
                {assignableCourses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>

            {quickAssignForm.courseId ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Select Views</label>
                  <select
                    value={quickAssignForm.selectedViewModeId}
                    onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, selectedViewModeId: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Select Views</option>
                    {viewSelectOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Select Attempt</label>
                  <select
                    value={quickAssignForm.selectedAttemptOptionId}
                    onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, selectedAttemptOptionId: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Select Attempt</option>
                    {attemptSelectOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Select Mode</label>
                  <select
                    value={quickAssignForm.selectedModeId}
                    onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, selectedModeId: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Select Mode</option>
                    {modeSelectOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Note</label>
              <Textarea
                className="rounded-xl border-slate-200 text-xs"
                rows={3}
                placeholder="Optional note for this assignment"
                value={quickAssignForm.notes}
                onChange={(e) => setQuickAssignForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Switch
                checked={quickAssignForm.isEnabled}
                onCheckedChange={(checked) => setQuickAssignForm((prev) => ({ ...prev, isEnabled: checked }))}
              />
              <span className="text-xs font-medium text-slate-700">Enable access immediately</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-xs"
              onClick={() => {
                setAssignDialogOpen(false);
                if (!isAssigningCourse) setAssigningStudent(null);
              }}
              disabled={isAssigningCourse}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-xl px-4 text-xs font-semibold"
              onClick={handleQuickAssignCourse}
              disabled={isAssigningCourse || !quickAssignForm.courseId || !assigningStudent}
            >
              {isAssigningCourse ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Assigning…</> : "Assign Course"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
