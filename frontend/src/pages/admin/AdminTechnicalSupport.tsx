import { useEffect, useMemo, useState, useRef } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  adminApi,
  type TechnicalSupportMessage,
  type TechnicalSupportTicket,
} from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LifeBuoy,
  Send,
  Ticket,
  ImageIcon,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Clock3,
  Search,
  BookOpen,
  UserRound,
  Flame,
  Trash2,
  Loader2,
  ChevronDown,
  X,
} from "lucide-react";

/* ─── Static config ───────────────────────────────────────────── */
const FILTER_DEFAULTS = { search: "", status: "all", priority: "all", issueCategory: "all", courseId: "", subject: "" };

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];
const priorityOptions = [
  { value: "all", label: "All Priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const categoryOptions = [
  { value: "all", label: "All Category" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "access", label: "Access" },
  { value: "content", label: "Content" },
  { value: "payment", label: "Payment" },
  { value: "other", label: "Other" },
];

const statusStyle: Record<string, { badge: string; dot: string; btnBorder: string; btnText: string; btnHover: string }> = {
  open:        { badge: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-400",   btnBorder: "border-amber-200", btnText: "text-amber-700", btnHover: "hover:bg-amber-50" },
  in_progress: { badge: "bg-blue-100 text-blue-700 border-blue-200",      dot: "bg-blue-500",    btnBorder: "border-blue-200",  btnText: "text-blue-700",  btnHover: "hover:bg-blue-50" },
  resolved:    { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", btnBorder: "border-emerald-200", btnText: "text-emerald-700", btnHover: "hover:bg-emerald-50" },
  closed:      { badge: "bg-slate-100 text-slate-600 border-slate-200",   dot: "bg-slate-400",   btnBorder: "border-slate-200", btnText: "text-slate-600", btnHover: "hover:bg-slate-50" },
};
const priorityStyle: Record<string, string> = {
  high:   "bg-rose-100 text-rose-700 border border-rose-200",
  medium: "bg-orange-100 text-orange-700 border border-orange-200",
  low:    "bg-lime-100 text-lime-700 border border-lime-200",
};

const statusLabel = (v: string) => v.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtTime = (v?: string | null) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
};
const fmtTimeShort = (v?: string | null) => {
  if (!v) return "";
  return new Date(v).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
};

/* ─── Component ─────────────────────────────────────────────────── */
export default function AdminTechnicalSupport() {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission("technical-support", "edit");
  const canDelete = hasPermission("technical-support", "delete");

  const [tickets, setTickets] = useState<TechnicalSupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TechnicalSupportTicket | null>(null);
  const [messages, setMessages] = useState<TechnicalSupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [courses, setCourses] = useState<Array<{ courseId: string; courseTitle: string; total: number }>>([]);
  const [summary, setSummary] = useState({ total: 0, open_count: 0, in_progress_count: 0, resolved_count: 0, closed_count: 0, high_count: 0 });

  const messageEndRef = useRef<HTMLDivElement>(null);

  /* scroll to bottom of chat when messages update */
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const loadTickets = async (nextFilters = filters) => {
    setIsLoading(true);
    try {
      const data = await adminApi.listTechnicalSupportTickets({ ...nextFilters, courseId: nextFilters.courseId || undefined, limit: 250 });
      setTickets(data.items || []);
      setSummary(data.summary || summary);
      setCourses(data.courses || []);
      if (selectedTicket && !(data.items || []).some((t) => t.id === selectedTicket.id)) {
        setSelectedTicket(null);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadTickets(); }, []);

  const openTicket = async (ticketId: number, source?: TechnicalSupportTicket[]) => {
    const base = source || tickets;
    const item = base.find((t) => t.id === ticketId) || null;
    if (item) setSelectedTicket(item);
    try {
      const details = await adminApi.getTechnicalSupportTicket(ticketId);
      setSelectedTicket(details.ticket);
      setMessages(details.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setIsUpdating(true);
    try {
      await adminApi.replyTechnicalSupportTicket(selectedTicket.id, replyMessage.trim(), "in_progress");
      setReplyMessage("");
      await openTicket(selectedTicket.id);
      await loadTickets();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = async (nextStatus: "open" | "in_progress" | "resolved" | "closed") => {
    if (!selectedTicket) return;
    setIsUpdating(true);
    try {
      await adminApi.updateTechnicalSupportTicketStatus(selectedTicket.id, nextStatus);
      await openTicket(selectedTicket.id);
      await loadTickets();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteTicket = async () => {
    if (!selectedTicket || !canDelete) return;

    const confirmed = window.confirm(
      `Delete ticket ${selectedTicket.ticketCode}? This will remove it from both admin and student side.`,
    );
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      const ticketId = selectedTicket.id;
      await adminApi.deleteTechnicalSupportTicket(ticketId);
      setSelectedTicket(null);
      setMessages([]);
      await loadTickets();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const applyFilters = () => void loadTickets(filters);
  const resetFilters = () => { setFilters(FILTER_DEFAULTS); void loadTickets(FILTER_DEFAULTS); };

  const statPills = useMemo(() => [
    { label: "Total", value: summary.total, color: "bg-slate-100 text-slate-700" },
    { label: "Open", value: summary.open_count, color: "bg-amber-100 text-amber-700" },
    { label: "In Progress", value: summary.in_progress_count, color: "bg-blue-100 text-blue-700" },
    { label: "Resolved", value: summary.resolved_count, color: "bg-emerald-100 text-emerald-700" },
    { label: "High Priority", value: summary.high_count, color: "bg-rose-100 text-rose-700" },
  ], [summary]);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4 font-['Inter'] overflow-hidden">

      {/* ─── Top Bar: Header + Stats + Filter Toggle ─────────────── */}
      <div className="shrink-0 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <LifeBuoy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Technical Support</h1>
              <p className="text-xs text-slate-500">{tickets.length} tickets loaded</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl border-slate-200 text-xs" onClick={() => void loadTickets()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl border-slate-200 text-xs" onClick={() => setShowFilters((p) => !p)}>
              <Search className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2">
          {statPills.map((pill) => (
            <span key={pill.label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${pill.color}`}>
              {pill.label}: <strong>{pill.value}</strong>
            </span>
          ))}
        </div>

        {/* Filter panel — collapsible */}
        {showFilters && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input className="h-8 w-44 rounded-xl border-slate-200 pl-9 text-xs" placeholder="Search…" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
              </div>
              {[
                { key: "status" as const, opts: statusOptions },
                { key: "priority" as const, opts: priorityOptions },
                { key: "issueCategory" as const, opts: categoryOptions },
              ].map(({ key, opts }) => (
                <select key={key} value={filters[key]} onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))} className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40">
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ))}
              <select value={filters.courseId} onChange={(e) => setFilters((p) => ({ ...p, courseId: e.target.value }))} className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">All Courses</option>
                {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.courseTitle}</option>)}
              </select>
              <Input className="h-8 w-36 rounded-xl border-slate-200 text-xs" placeholder="Subject contains…" value={filters.subject} onChange={(e) => setFilters((p) => ({ ...p, subject: e.target.value }))} />
              <Button size="sm" className="h-8 rounded-xl px-3 text-xs font-semibold" onClick={applyFilters}>Apply</Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 rounded-xl border-slate-200 px-3 text-xs" onClick={resetFilters}><RotateCcw className="h-3 w-3" />Reset</Button>
              <button type="button" onClick={() => setShowFilters(false)} className="ml-auto text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Split Panel ─────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4">

        {/* Left — Ticket List */}
        <div className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* List header */}
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-slate-800">Ticket Queue</span>
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{tickets.length}</span>
            </div>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <Ticket className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No tickets found</p>
                <p className="mt-1 text-xs text-slate-400">Try relaxing your filters</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((ticket) => {
                  const s = statusStyle[ticket.status] || statusStyle.closed;
                  const isSelected = selectedTicket?.id === ticket.id;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => void openTicket(ticket.id)}
                      className={`w-full px-4 py-3 text-left transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`line-clamp-2 text-xs font-semibold leading-snug ${isSelected ? "text-primary" : "text-slate-900"}`}>{ticket.subject}</p>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {statusLabel(ticket.status)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${priorityStyle[ticket.priority] || "bg-slate-100 text-slate-600"}`}>
                          {ticket.priority === "high" && <Flame className="mr-0.5 inline h-2.5 w-2.5" />}{ticket.priority}
                        </span>
                        <span className="text-[10px] text-slate-400">{ticket.issueCategory}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <UserRound className="h-3 w-3 shrink-0" />
                        <span className="truncate">{ticket.studentName}</span>
                        <span className="ml-auto shrink-0">{fmtTime(ticket.updatedAt || ticket.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — Chat / Detail */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedTicket ? (
            /* Empty state */
            <div className="flex h-full flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <MessageSquare className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-base font-bold text-slate-600">Select a ticket to view</p>
              <p className="mt-1.5 max-w-xs text-sm text-slate-400">Choose any ticket from the queue on the left to see the conversation and respond.</p>
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-4">
                {/* Title + badges */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[selectedTicket.status]?.badge || "bg-slate-100 text-slate-600"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusStyle[selectedTicket.status]?.dot}`} />
                    {statusLabel(selectedTicket.status)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityStyle[selectedTicket.priority] || "bg-slate-100 text-slate-600"}`}>
                    {selectedTicket.priority === "high" && <Flame className="mr-0.5 inline h-3 w-3" />}{selectedTicket.priority} priority
                  </span>
                  <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">{selectedTicket.ticketCode}</span>
                </div>
                <h2 className="text-sm font-bold text-slate-900 leading-snug">{selectedTicket.subject}</h2>

                {/* Meta info row */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{selectedTicket.studentName} · {selectedTicket.studentEmail}</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{selectedTicket.courseTitle}</span>
                  {selectedTicket.lessonTitle && <span className="truncate max-w-[200px]">Lesson: {selectedTicket.lessonTitle}</span>}
                  <span>Category: {selectedTicket.issueCategory}</span>
                  {selectedTicket.screenshotUrl && (
                    <a href={selectedTicket.screenshotUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary hover:bg-primary/20">
                      <ImageIcon className="h-3 w-3" /> Screenshot
                    </a>
                  )}
                </div>

                {/* Status buttons */}
                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">Set Status:</span>
                    {(["open", "in_progress", "resolved", "closed"] as const).map((st) => {
                      const cfg = statusStyle[st];
                      const isActive = selectedTicket.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          disabled={isUpdating || isActive}
                          onClick={() => void updateStatus(st)}
                          className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${isActive ? `${cfg.badge} opacity-100 cursor-default` : `border-slate-200 text-slate-500 ${cfg.btnHover} hover:${cfg.btnText} hover:${cfg.btnBorder}`} disabled:opacity-60`}
                        >
                          {isUpdating ? "…" : statusLabel(st)}
                        </button>
                      );
                    })}

                    {canDelete && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto h-7 gap-1 rounded-xl border-rose-200 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                        disabled={isUpdating}
                        onClick={() => void deleteTicket()}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Ticket
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <MessageSquare className="mb-2 h-6 w-6 text-slate-300" />
                    <p className="text-sm text-slate-400">No messages yet. Be the first to respond.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.senderRole === "admin";
                    return (
                      <div key={msg.id} className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                        <span className={`mb-1 text-[11px] font-bold tracking-wide ${isAdmin ? "text-primary" : "text-slate-500"}`}>
                          {isAdmin ? (msg.senderName || "Admin") : "Student · " + (selectedTicket.studentName || "")}
                        </span>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isAdmin ? "rounded-tr-sm bg-primary text-white" : "rounded-tl-sm border border-slate-200 bg-white text-slate-800"}`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
                          <p className={`mt-1.5 text-[10px] ${isAdmin ? "text-white/60 text-right" : "text-slate-400"}`}>{fmtTimeShort(msg.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Reply box */}
              {canEdit && (
                <div className="shrink-0 border-t border-slate-100 bg-white p-4">
                  <div className="flex flex-col gap-2">
                    <textarea
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      rows={3}
                      placeholder="Write your reply… (Enter to send, Shift+Enter for newline)"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="hidden text-[10px] text-slate-400 sm:block">
                        <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px]">Enter</kbd> send · <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px]">Shift+Enter</kbd> new line
                      </span>
                      <Button
                        className="ml-auto h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold"
                        disabled={isUpdating || !replyMessage.trim()}
                        onClick={() => void sendReply()}
                      >
                        {isUpdating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</> : <><Send className="h-3.5 w-3.5" />Send Reply</>}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
