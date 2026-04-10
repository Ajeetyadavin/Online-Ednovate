import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LifeBuoy,
  Send,
  Ticket,
  ImageIcon,
  ChevronLeft,
  MessageSquare,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  Clock,
  Plus,
  Inbox,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Headphones,
} from "lucide-react";
import {
  createStudentSupportTicketApi,
  getStudentSupportCoursesApi,
  getStudentSupportTicketDetailsApi,
  getStudentSupportTicketsApi,
  replyStudentSupportTicketApi,
  type StudentSupportCourse,
  type StudentSupportMessage,
  type StudentSupportTicket,
  uploadStudentSupportScreenshotApi,
} from "@/services/authApi";

const issueCategories = [
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "access", label: "Access" },
  { value: "content", label: "Content" },
  { value: "payment", label: "Payment" },
  { value: "other", label: "Other" },
];

const priorities = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  open: { label: "Open", color: "bg-amber-100 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 border border-blue-200", dot: "bg-blue-500" },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 border border-slate-200", dot: "bg-slate-400" },
};

const priorityConfig: Record<string, { color: string }> = {
  high: { color: "bg-rose-50 text-rose-700 border border-rose-200" },
  medium: { color: "bg-amber-50 text-amber-700 border border-amber-200" },
  low: { color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

const formatStatusLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatTime = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read screenshot"));
    reader.readAsDataURL(file);
  });
};

export default function TechnicalSupport() {
  const navigate = useNavigate();
  const { isLoggedIn, user, logout } = useAuth();

  const [courses, setCourses] = useState<StudentSupportCourse[]>([]);
  const [tickets, setTickets] = useState<StudentSupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<StudentSupportTicket | null>(null);
  const [messages, setMessages] = useState<StudentSupportMessage[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const [form, setForm] = useState({
    courseId: "",
    issueCategory: "video",
    priority: "medium" as "low" | "medium" | "high",
    subject: "",
    lessonTitle: "",
    issueDetails: "",
    screenshotUrl: "",
  });
  const [screenshotFileName, setScreenshotFileName] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const hasStudentSessionFailure = (message: string) => /session|token|authoriz|logged out|expired/i.test(message);

  const loadSupportData = async () => {
    setIsLoading(true);
    try {
      const [coursesResult, ticketsResult] = await Promise.all([
        getStudentSupportCoursesApi(),
        getStudentSupportTicketsApi(),
      ]);

      if (!coursesResult.ok) {
        if (hasStudentSessionFailure(coursesResult.message || "")) {
          void logout();
          return;
        }
        setError(coursesResult.message || "Failed to load courses");
      } else {
        setCourses(coursesResult.data || []);
      }

      if (!ticketsResult.ok) {
        if (hasStudentSessionFailure(ticketsResult.message || "")) {
          void logout();
          return;
        }
        setError(ticketsResult.message || "Failed to load tickets");
      } else {
        const allTickets = ticketsResult.data || [];
        setTickets(allTickets);
        if (allTickets[0]) {
          await openTicket(allTickets[0].id, allTickets);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadSupportData();
  }, [isLoggedIn, logout]);

  useEffect(() => {
    if (!form.courseId && courses[0]) {
      setForm((prev) => ({ ...prev, courseId: courses[0].courseId }));
    }
  }, [courses, form.courseId]);

  const selectedCourseTitle = useMemo(
    () => courses.find((course) => course.courseId === form.courseId)?.courseTitle || "",
    [courses, form.courseId],
  );

  const openTicket = async (ticketId: number, baseTickets?: StudentSupportTicket[], fromMobile = false) => {
    const sourceTickets = baseTickets || tickets;
    const ticket = sourceTickets.find((item) => item.id === ticketId) || null;
    if (ticket) setSelectedTicket(ticket);
    if (fromMobile) setMobileView("chat");

    const details = await getStudentSupportTicketDetailsApi(ticketId);
    if (!details.ok || !details.data) {
      if (hasStudentSessionFailure(details.message || "")) {
        void logout();
        return;
      }
      setError(details.message || "Failed to open ticket");
      return;
    }

    setSelectedTicket(details.data.ticket);
    setMessages(details.data.messages || []);
  };

  const handleScreenshotChange = async (file: File | null) => {
    if (!file) return;
    setError("");
    setSuccess("");

    try {
      const base64Data = await fileToBase64(file);
      const result = await uploadStudentSupportScreenshotApi({
        fileName: file.name,
        base64Data,
      });

      if (!result.ok || !result.data?.url) {
        setError(result.message || "Screenshot upload failed");
        return;
      }

      setForm((prev) => ({ ...prev, screenshotUrl: result.data?.url || "" }));
      setScreenshotFileName(file.name);
      setSuccess("Screenshot uploaded successfully.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Screenshot upload failed");
    }
  };

  const submitTicket = async () => {
    if (!form.courseId || !form.subject.trim() || !form.issueDetails.trim()) {
      setError("Course, subject, and issue details are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const createResult = await createStudentSupportTicketApi({
        courseId: form.courseId,
        issueCategory: form.issueCategory,
        priority: form.priority,
        subject: form.subject.trim(),
        lessonTitle: form.lessonTitle.trim(),
        issueDetails: form.issueDetails.trim(),
        screenshotUrl: form.screenshotUrl || undefined,
      });

      if (!createResult.ok || !createResult.data) {
        if (hasStudentSessionFailure(createResult.message || "")) {
          void logout();
          return;
        }
        setError(createResult.message || "Failed to submit support request");
        return;
      }

      setSuccess("Support request submitted. Team will reply soon.");
      setForm((prev) => ({
        ...prev,
        subject: "",
        lessonTitle: "",
        issueDetails: "",
        screenshotUrl: "",
      }));
      setScreenshotFileName("");
      setIsCreateTicketOpen(false);

      await loadSupportData();
      await openTicket(createResult.data.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setIsReplying(true);
    setError("");

    try {
      const reply = await replyStudentSupportTicketApi(selectedTicket.id, replyMessage.trim());
      if (!reply.ok) {
        if (hasStudentSessionFailure(reply.message || "")) {
          void logout();
          return;
        }
        setError(reply.message || "Failed to send reply");
        return;
      }

      setReplyMessage("");
      await openTicket(selectedTicket.id);
      await loadSupportData();
    } finally {
      setIsReplying(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Login Required</h2>
          <p className="mt-2 text-sm text-slate-500">Please login to raise technical support requests.</p>
          <Button className="mt-6 w-full rounded-xl font-semibold" onClick={() => navigate("/login")}>
            Go to Login <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const sC = statusConfig;
  const pC = priorityConfig;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 font-['Inter']">
      {/* ─── Top Header Bar ─────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <Headphones className="h-4.5 w-4.5 text-white" style={{ height: "18px", width: "18px" }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Technical Support</h1>
              <p className="text-[11px] text-slate-500">Student Helpdesk</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification badges */}
            {error && (
              <div className="hidden items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 sm:flex">
                <AlertCircle className="h-3 w-3" /> {error}
              </div>
            )}
            {success && (
              <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:flex">
                <CheckCircle2 className="h-3 w-3" /> {success}
              </div>
            )}

            {/* New Ticket Dialog */}
            <Dialog open={isCreateTicketOpen} onOpenChange={setIsCreateTicketOpen}>
              <DialogTrigger asChild>
                <Button className="h-8 gap-1.5 rounded-xl px-3 text-xs font-semibold shadow-sm">
                  <Plus className="h-3.5 w-3.5" /> New Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-[680px] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-0 shadow-2xl">
                <DialogHeader className="border-b border-slate-100 px-6 py-5">
                  <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-slate-900">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Ticket className="h-4 w-4 text-primary" />
                    </div>
                    Raise a Support Ticket
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs text-slate-500">
                    Describe your issue clearly to get faster resolution from our team.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 px-6 py-5">
                  {/* Name + Email */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your Name</Label>
                      <Input
                        className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-600"
                        value={user?.name || ""}
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Email</Label>
                      <Input
                        className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-600"
                        value={user?.email || ""}
                        disabled
                      />
                    </div>
                  </div>

                  {/* Course */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Purchased Course</Label>
                    <select
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={form.courseId}
                      onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                    >
                      {courses.length === 0 && <option value="">No purchased course found</option>}
                      {courses.map((c) => (
                        <option key={c.courseId} value={c.courseId}>{c.courseTitle}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category + Priority */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Issue Category</Label>
                      <select
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={form.issueCategory}
                        onChange={(e) => setForm((p) => ({ ...p, issueCategory: e.target.value }))}
                      >
                        {issueCategories.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Priority</Label>
                      <select
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={form.priority}
                        onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as "low" | "medium" | "high" }))}
                      >
                        {priorities.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subject</Label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/50"
                      placeholder="e.g. Video not playing in Chapter 2"
                      value={form.subject}
                      onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                    />
                  </div>

                  {/* Lesson */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Lesson / Topic <span className="normal-case font-normal text-slate-400">(optional)</span>
                    </Label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus-visible:ring-primary/50"
                      placeholder="e.g. Chapter 2 – Laws of Motion"
                      value={form.lessonTitle}
                      onChange={(e) => setForm((p) => ({ ...p, lessonTitle: e.target.value }))}
                    />
                  </div>

                  {/* Issue Details */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Issue Details</Label>
                    <textarea
                      className="min-h-[110px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Describe the steps to reproduce, browser/device info, and any error messages..."
                      value={form.issueDetails}
                      onChange={(e) => setForm((p) => ({ ...p, issueDetails: e.target.value }))}
                    />
                  </div>

                  {/* Screenshot */}
                  <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5">
                    <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <Paperclip className="h-3.5 w-3.5" /> Attach Screenshot
                    </Label>
                    <Input
                      type="file"
                      className="h-10 cursor-pointer rounded-xl border-slate-200 bg-white text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                      accept="image/*"
                      onChange={(e) => void handleScreenshotChange(e.target.files?.[0] || null)}
                    />
                    {screenshotFileName && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {screenshotFileName}
                      </p>
                    )}
                  </div>

                  {/* Error/Success in dialog */}
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl border-slate-200 text-sm text-slate-600"
                      onClick={() => setIsCreateTicketOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="h-10 rounded-xl px-5 text-sm font-semibold shadow-sm"
                      disabled={isSubmitting || courses.length === 0}
                      onClick={submitTicket}
                    >
                      {isSubmitting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" /> Submit Ticket</>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              className="h-8 gap-1 rounded-xl px-2.5 text-xs text-slate-600 hover:bg-slate-100"
              onClick={() => navigate("/dashboard")}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Mobile Alerts ─────────────────────────────────── */}
      <div className="mx-auto max-w-[1400px] px-4 pt-3 sm:px-6">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:hidden">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 sm:hidden">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {success}
          </div>
        )}
      </div>

      {/* ─── Main Content ───────────────────────────────────── */}
      <div className="mx-auto max-w-[1400px] px-4 pb-8 pt-2 sm:px-6">
        {isLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary/60" />
              <p className="text-sm font-medium text-slate-500">Loading your support tickets...</p>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          /* ── Empty State ── */
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-inner">
              <LifeBuoy className="h-10 w-10 text-primary/60" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">No Support Tickets Yet</h2>
            <p className="mt-2 max-w-xs text-sm text-slate-500">
              Having trouble with your course? Raise a ticket and our team will help you out.
            </p>
            <Dialog open={isCreateTicketOpen} onOpenChange={setIsCreateTicketOpen}>
              <DialogTrigger asChild>
                <Button className="mt-6 gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md">
                  <Plus className="h-4 w-4" /> Raise Your First Ticket
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        ) : (
          /* ── Split Panel ── */
          <div className="flex h-[calc(100vh-120px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">

            {/* ── Mobile Tab Bar ──────────────────────────────── */}
            <div className="flex shrink-0 border-b border-slate-100 md:hidden">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                  mobileView === "list"
                    ? "border-b-2 border-primary text-primary"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Inbox className="h-3.5 w-3.5" /> Tickets
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">
                  {tickets.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView("chat")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                  mobileView === "chat"
                    ? "border-b-2 border-primary text-primary"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Chat
                {selectedTicket && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            </div>

            {/* ── Desktop + Mobile Inner Flex ──────────────────── */}
            <div className="flex min-h-0 flex-1">

            {/* ── Left: Ticket List ─────────────────────────── */}
            <div className={`flex flex-col border-r border-slate-100 bg-slate-50/50 ${
              mobileView === "list" ? "flex" : "hidden"
            } w-full md:flex md:w-[300px] lg:w-[320px] xl:w-[340px]`}>
              {/* Sidebar Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">My Tickets</span>
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
                    {tickets.length}
                  </span>
                </div>
              </div>

              {/* Ticket List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {tickets.map((ticket) => {
                  const isActive = selectedTicket?.id === ticket.id;
                  const sc = sC[ticket.status] || sC["open"];
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => {
                        // On mobile, switch to chat view; on desktop, just load ticket
                        const isMobile = window.innerWidth < 768;
                        void openTicket(ticket.id, undefined, isMobile);
                      }}
                      className={`group w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        isActive
                          ? "border-primary/30 bg-primary/[0.07] shadow-sm"
                          : "border-transparent bg-white hover:border-slate-200 hover:shadow-sm"
                      }`}
                    >
                      {/* Status dot + code */}
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {ticket.ticketCode}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>
                          {sc.label}
                        </span>
                      </div>

                      {/* Subject */}
                      <p className={`line-clamp-2 text-xs font-semibold leading-snug ${isActive ? "text-primary" : "text-slate-800"}`}>
                        {ticket.subject}
                      </p>

                      {/* Course */}
                      <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{ticket.courseTitle}</p>

                      {/* Priority */}
                      <div className="mt-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pC[ticket.priority]?.color || "bg-slate-100 text-slate-600"}`}>
                          {formatStatusLabel(ticket.priority)} Priority
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Right: Chat Area ──────────────────────────── */}
            <div className={`flex min-w-0 flex-1 flex-col bg-white ${
              mobileView === "chat" ? "flex" : "hidden"
            } md:flex`}>
              {selectedTicket ? (
                <>
                  {/* Chat Header */}
                  <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {/* Back button on mobile */}
                        <button
                          type="button"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
                          onClick={() => setMobileView("list")}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-slate-900">{selectedTicket.subject}</h2>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {selectedTicket.courseTitle}
                          {selectedTicket.issueCategory && (
                            <> · {formatStatusLabel(selectedTicket.issueCategory)}</>
                          )}
                        </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${(sC[selectedTicket.status] || sC["open"]).color}`}
                        >
                          {(sC[selectedTicket.status] || sC["open"]).label}
                        </Badge>
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pC[selectedTicket.priority]?.color || "bg-slate-100 text-slate-600"}`}
                        >
                          {formatStatusLabel(selectedTicket.priority)}
                        </Badge>
                        {selectedTicket.screenshotUrl && (
                          <a
                            className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                            href={selectedTicket.screenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ImageIcon className="h-3 w-3" /> Screenshot
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto bg-[#f8fafc] px-5 py-4 space-y-4">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="mb-2 h-8 w-8 text-slate-200" />
                        <p className="text-sm font-medium text-slate-500">No messages yet</p>
                        <p className="mt-1 text-xs text-slate-400">Your conversation will appear here.</p>
                      </div>
                    )}
                    {messages.map((message) => {
                      const isStudent = message.senderRole === "student";
                      return (
                        <div key={message.id} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                          <div className="max-w-[78%]">
                            {/* Sender label */}
                            <div className={`mb-1 flex items-center gap-1.5 ${isStudent ? "justify-end" : "justify-start"}`}>
                              {!isStudent && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-[10px] font-bold text-white">
                                  S
                                </div>
                              )}
                              <p className="text-[10px] font-semibold text-slate-400">
                                {isStudent ? "You" : message.senderName || "Support Team"}
                              </p>
                              {isStudent && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                                  {user?.name?.[0]?.toUpperCase() || "Y"}
                                </div>
                              )}
                            </div>

                            {/* Bubble */}
                            <div
                              className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                isStudent
                                  ? "rounded-tr-sm bg-gradient-to-br from-primary to-primary/90 text-white"
                                  : "rounded-tl-sm border border-slate-150 bg-white text-slate-800"
                              }`}
                              style={{ borderColor: isStudent ? undefined : "#f0f0f5" }}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
                              <p className={`mt-1.5 text-[10px] ${isStudent ? "text-right text-white/60" : "text-slate-400"}`}>
                                {formatTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messageEndRef} />
                  </div>

                  {/* Reply Box */}
                  <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
                    {selectedTicket.status === "closed" ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-medium text-slate-500">
                        <CheckCircle2 className="h-4 w-4 text-slate-400" />
                        This ticket is closed. No further messages can be sent.
                      </div>
                    ) : (
                      <div className="flex items-end gap-3">
                        <textarea
                          className="min-h-[64px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                          placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void sendReply();
                            }
                          }}
                        />
                        <Button
                          className="h-10 w-10 shrink-0 rounded-xl p-0 shadow-sm"
                          disabled={isReplying || !replyMessage.trim()}
                          onClick={() => void sendReply()}
                        >
                          {isReplying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* No ticket selected placeholder */
                <div className="flex flex-1 flex-col items-center justify-center text-center px-8">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <MessageSquare className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-base font-semibold text-slate-700">Select a ticket</p>
                  <p className="mt-1.5 max-w-xs text-xs text-slate-500">
                    Choose a support ticket from the list to view its conversation.
                  </p>
                  <button
                    type="button"
                    className="mt-4 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 md:hidden"
                    onClick={() => setMobileView("list")}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> View Ticket List
                  </button>
                </div>
              )}
            </div>
            </div>{/* end desktop+mobile inner flex */}
          </div>
        )}
      </div>
    </div>
  );
}
