import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import {
  adminApi,
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
import {
  Search, Mail, MapPin, LogIn, Edit2, Trash2, Loader2, Shield,
  Clock, Eye, BookOpen, KeyRound, Send, Users, Activity,
  MessageSquare, RefreshCcw, GraduationCap, ToggleLeft, ToggleRight,
  ChevronRight, Phone,
} from "lucide-react";

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

/* ─── Component ─────────────────────────────────────────────────── */
export default function AdminUsers() {
  const navigate = useNavigate();
  const { loginAsUser } = useAuth();
  const { courses } = usePlatformData();

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
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const [courseForm, setCourseForm] = useState({ courseId: "", purchaseDate: "", durationDays: 180, totalViews: 2, usedViews: 0, notes: "", isEnabled: true });
  const [extendForm, setExtendForm] = useState({ courseId: "", extraDays: 30, extraViews: 1 });
  const [passwordForm, setPasswordForm] = useState({ password: "" });
  const [messageForm, setMessageForm] = useState({ channel: "in_app", subject: "", message: "" });
  const [curriculumMetaByCourse, setCurriculumMetaByCourse] = useState<Record<string, { lectures: number; totalSeconds: number }>>({});

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
      const data = await adminApi.listStudents(search);
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
      const data = await adminApi.getStudentDetails(studentId);
      setSelectedStudent(data.student);
      setCourseAccess(data.courseAccess || []);
      setLoginLogs(data.loginLogs || []);
      setVideoActivity(data.videoActivity || []);
      setNotifications(data.notifications || []);
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
    const handler = () => void loadCurriculumMeta();
    window.addEventListener("curriculum-updated", handler as EventListener);
    return () => window.removeEventListener("curriculum-updated", handler as EventListener);
  }, [loadCurriculumMeta]);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [searchTerm, students]);

  const totalWatchedSeconds = useMemo(() => videoActivity.reduce((sum, item) => sum + Number(item.viewedSeconds || 0), 0), [videoActivity]);

  const selectedCourseMeta = useMemo(() => {
    const meta = curriculumMetaByCourse[courseForm.courseId];
    return { lectures: meta?.lectures || 0, durationText: formatSecondsToClock(meta?.totalSeconds || 0) };
  }, [curriculumMetaByCourse, courseForm.courseId]);

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
      if (selectedStudentId === id) { setSelectedStudentId(""); setSelectedStudent(null); setCourseAccess([]); setLoginLogs([]); setVideoActivity([]); setNotifications([]); }
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
          </div>
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
                      { label: "Videos Watched", value: videoActivity.length, color: "text-violet-700 bg-violet-50" },
                      { label: "Watch Time", value: `${(totalWatchedSeconds / 3600).toFixed(1)}h`, color: "text-emerald-700 bg-emerald-50" },
                      { label: "Notifications", value: notifications.length, color: "text-amber-700 bg-amber-50" },
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
                        <div key={`${access.studentId}-${access.courseId}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 line-clamp-1">{access.courseTitle}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {formatDuration(access.durationDays)} · Views: {access.usedViews}/{access.totalViews} (rem: {access.remainingViews}) · Expires: {formatDateTime(access.expiresAt)}
                            </p>
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${access.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {access.isEnabled ? "Enabled" : "Disabled"}
                            </span>
                            <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2 text-[11px]" onClick={() => handleToggleCourse(access.courseId, !access.isEnabled)}>
                              {access.isEnabled ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
                              {access.isEnabled ? "Disable" : "Enable"}
                            </Button>
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
                    <p className="mb-2 text-xs font-bold text-slate-800">Video Watch Activity ({videoActivity.length})</p>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-100 bg-slate-50"><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Viewed</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Course / Chapter</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Video</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Progress</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Watched</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {videoActivity.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400">No video activity</td></tr>
                          ) : videoActivity.slice(0, 100).map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-500">{formatDateTime(item.lastViewedAt)}</td>
                              <td className="px-4 py-2">
                                <p className="text-slate-600 truncate max-w-[120px]">{item.courseId || "—"}</p>
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
                        <thead><tr className="border-b border-slate-100 bg-slate-50"><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Time</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Channel</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Subject</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Message</th><th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {notifications.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400">No messages sent yet</td></tr>
                          ) : notifications.map((n) => (
                            <tr key={n.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-500">{formatDateTime(n.createdAt)}</td>
                              <td className="px-4 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{n.channel}</span></td>
                              <td className="px-4 py-2 text-slate-600">{n.subject || "—"}</td>
                              <td className="max-w-[200px] truncate px-4 py-2 text-slate-500">{n.message}</td>
                              <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${n.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{n.status}</span></td>
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
    </div>
  );
}
