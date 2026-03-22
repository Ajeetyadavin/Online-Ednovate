import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApi, type StudentAccessSummaryItem } from "@/services/adminApi";
import {
  Search,
  RefreshCcw,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  EyeOff,
  BookOpen,
  Loader2,
  Infinity,
  Calendar,
  ShieldCheck,
  Trash2,
  RotateCcw,
  Save,
  ChevronUp,
  ChevronDown,
  Timer,
  Settings2,
  CreditCard,
} from "lucide-react";

interface AccessDraft {
  expiresAt: string;
  isEnabled: boolean;
  isUnlimitedViews: boolean;
}

const formatDuration = (seconds?: number) => {
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

const rowId = (item: StudentAccessSummaryItem) => `${item.studentId}-${item.courseId}`;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusConfig = {
  active: {
    label: "Active",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
    row: "",
  },
  disabled: {
    label: "Disabled",
    badge: "bg-slate-100 text-slate-600 border border-slate-200",
    dot: "bg-slate-400",
    row: "opacity-60",
  },
  expired: {
    label: "Expired",
    badge: "bg-red-100 text-red-700 border border-red-200",
    dot: "bg-red-500",
    row: "bg-red-50/40",
  },
  out_of_views: {
    label: "Out of Views",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
    row: "bg-amber-50/30",
  },
} as const;

type StatusKey = keyof typeof statusConfig;

const getStatusCfg = (status: string) =>
  statusConfig[status as StatusKey] ?? {
    label: status,
    badge: "bg-slate-100 text-slate-600 border border-slate-200",
    dot: "bg-slate-400",
    row: "",
  };

export default function AdminStudentAccess() {
  const [items, setItems] = useState<StudentAccessSummaryItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, disabled: 0, expired: 0, outOfViews: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rowActionKey, setRowActionKey] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AccessDraft>>({});
  const [selectedAccessKey, setSelectedAccessKey] = useState<string | null>(null);
  const [extendDaysInput, setExtendDaysInput] = useState("30");
  const [extendWatchHoursInput, setExtendWatchHoursInput] = useState("0");
  const [extendWatchMinutesInput, setExtendWatchMinutesInput] = useState("0");
  const [extendDirection, setExtendDirection] = useState<"add" | "subtract">("add");
  const [adjustWatchHoursInput, setAdjustWatchHoursInput] = useState("0");
  const [adjustWatchMinutesInput, setAdjustWatchMinutesInput] = useState("0");
  const [adjustWatchDirection, setAdjustWatchDirection] = useState<"add" | "subtract">("add");

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getStudentAccessSummary({ search: query, status, limit: 200 });
      setItems(data.items || []);
      setSummary(data.summary || { total: 0, active: 0, disabled: 0, expired: 0, outOfViews: 0 });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load access summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        const key = rowId(item);
        next[key] = {
          expiresAt: toDateTimeLocalValue(item.expiresAt),
          isEnabled: item.isEnabled !== false,
          isUnlimitedViews: item.isUnlimitedViews === true,
        };
      });
      return next;
    });
  }, [items]);

  const updateDraft = (key: string, updates: Partial<AccessDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        expiresAt: "",
        isEnabled: true,
        isUnlimitedViews: false,
        ...(prev[key] || {}),
        ...updates,
      },
    }));
  };

  const runRowAction = async (key: string, callback: () => Promise<unknown>) => {
    setRowActionKey(key);
    try {
      await callback();
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Action failed");
    } finally {
      setRowActionKey("");
    }
  };

  const selectedItem = useMemo(
    () => items.find((item) => rowId(item) === selectedAccessKey) || null,
    [items, selectedAccessKey],
  );

  useEffect(() => {
    if (!selectedItem) return;
    setExtendDaysInput("30");
    setExtendWatchHoursInput("0");
    setExtendWatchMinutesInput("0");
    setExtendDirection("add");
    setAdjustWatchHoursInput("0");
    setAdjustWatchMinutesInput("0");
    setAdjustWatchDirection("add");
  }, [selectedItem?.studentId, selectedItem?.courseId]);

  const statCards = [
    { label: "Total Enrollments", value: summary.total, icon: Users, color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
    { label: "Active", value: summary.active, icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    { label: "Expired", value: summary.expired, icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    { label: "Out of Views", value: summary.outOfViews, icon: EyeOff, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    { label: "Disabled", value: summary.disabled, icon: Clock, color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" },
  ];

  return (
    <div className="space-y-6 font-['Inter']">
      {/* ─── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Access Monitor</h1>
          <p className="mt-0.5 text-sm text-slate-500">Monitor and manage course access — active, expired, disabled, and view-limit entries.</p>
        </div>
      </div>

      {/* ─── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              const map: Record<string, string> = {
                "Total Enrollments": "all",
                "Active": "active",
                "Expired": "expired",
                "Out of Views": "out_of_views",
                "Disabled": "disabled",
              };
              setStatus(map[card.label] ?? "all");
            }}
            className={`group flex items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:shadow-md ${card.border} ${status === (card.label === "Total Enrollments" ? "all" : card.label.toLowerCase().replace(/ /g, "_")) ? "ring-2 ring-primary/30 shadow-sm" : "bg-white"}`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ─── Table Card ───────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Access Records</h2>
            <p className="text-xs text-slate-500">{items.length} records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load()}
                className="h-9 w-52 rounded-xl border-slate-200 bg-white pl-9 text-xs placeholder:text-slate-400"
                placeholder="Search student or course…"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="out_of_views">Out of Views</option>
              <option value="disabled">Disabled</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="h-9 gap-1.5 rounded-xl border-slate-200 text-xs"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/40">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Student</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Course</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Watch Time</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Expiry</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Active</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary/50" />
                    <p className="text-sm text-slate-500">Loading records…</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <BookOpen className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">No records found</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const cfg = getStatusCfg(item.status);
                  const key = rowId(item);
                  const isActing = rowActionKey.startsWith(key);
                  return (
                    <tr
                      key={key}
                      className={`group transition-colors hover:bg-slate-50/70 ${cfg.row}`}
                    >
                      {/* Student */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-xs font-bold text-primary">
                            {item.studentName?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{item.studentName}</p>
                            <p className="text-[11px] text-slate-500">{item.studentEmail}</p>
                          </div>
                        </div>
                      </td>

                      {/* Course */}
                      <td className="max-w-[200px] px-5 py-3.5">
                        <p className="line-clamp-1 text-xs font-semibold text-slate-800">{item.courseTitle}</p>
                        <p className="text-[11px] text-slate-400">{item.courseId}</p>
                      </td>

                      {/* Watch Time */}
                      <td className="px-5 py-3.5">
                        {item.isUnlimitedViews ? (
                          <div className="flex items-center gap-1 text-indigo-700">
                            <Infinity className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Unlimited</span>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-slate-800">
                              {formatDuration(item.remainingWatchSeconds)} left
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatDuration(item.usedWatchSeconds)} / {formatDuration(item.allowedWatchSeconds)}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-slate-700">{formatDate(item.expiresAt)}</p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="px-5 py-3.5">
                        <p className="text-[11px] text-slate-500">{formatDate(item.lastViewedAt)}</p>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isActing}
                          onClick={() => setSelectedAccessKey(key)}
                          className="h-7 rounded-lg border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Manage Access Dialog ─────────────────────────────── */}
      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedAccessKey(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-0 shadow-2xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-slate-900">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              Manage Student Access
            </DialogTitle>
            {selectedItem && (
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{selectedItem.studentName}</span>
                <span>·</span>
                <span className="line-clamp-1 max-w-[240px]">{selectedItem.courseTitle}</span>
                <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusCfg(selectedItem.status).badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${getStatusCfg(selectedItem.status).dot}`} />
                  {getStatusCfg(selectedItem.status).label}
                </span>
              </div>
            )}
          </DialogHeader>

          {selectedItem && (() => {
            const key = rowId(selectedItem);
            const draft = drafts[key] ?? {
              expiresAt: toDateTimeLocalValue(selectedItem.expiresAt),
              isEnabled: selectedItem.isEnabled !== false,
              isUnlimitedViews: selectedItem.isUnlimitedViews === true,
            };

            return (
              <div className="divide-y divide-slate-100">

                {/* ── Section 1: Student + Course Info ── */}
                <div className="grid grid-cols-2 gap-4 px-6 py-5">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Student</p>
                    <p className="font-semibold text-slate-900">{selectedItem.studentName}</p>
                    <p className="text-xs text-slate-500">{selectedItem.studentEmail}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Course</p>
                    <p className="font-semibold text-slate-900 line-clamp-2">{selectedItem.courseTitle}</p>
                    <p className="text-xs text-slate-400">{selectedItem.courseId}</p>
                  </div>
                </div>

                {/* ── Section 2: Watch Time Summary ── */}
                <div className="px-6 py-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Timer className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Watch Time</h3>
                  </div>
                  {draft.isUnlimitedViews ? (
                    <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3">
                      <Infinity className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-semibold text-indigo-700">Unlimited watch time — no limit enforced</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Remaining", value: formatDuration(selectedItem.remainingWatchSeconds), color: "text-emerald-700 bg-emerald-50" },
                        { label: "Used", value: formatDuration(selectedItem.usedWatchSeconds), color: "text-slate-700 bg-slate-50" },
                        { label: "Total Budget", value: formatDuration(selectedItem.allowedWatchSeconds), color: "text-slate-700 bg-slate-50" },
                      ].map((stat) => (
                        <div key={stat.label} className={`rounded-xl p-3 ${stat.color}`}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{stat.label}</p>
                          <p className="mt-0.5 text-base font-bold">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expiry Date */}
                  <div className="mt-4 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <Calendar className="h-3.5 w-3.5" /> Expiry Date &amp; Time
                    </label>
                    <Input
                      type="datetime-local"
                      value={draft.expiresAt}
                      onChange={(e) => updateDraft(key, { expiresAt: e.target.value })}
                      className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                {/* ── Section 3: Access Settings ── */}
                <div className="px-6 py-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Access Settings</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Access State */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Access State</label>
                      <div className="flex gap-2">
                        {(["enabled", "disabled"] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateDraft(key, { isEnabled: val === "enabled" })}
                            className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                              (val === "enabled" ? draft.isEnabled : !draft.isEnabled)
                                ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            {val === "enabled" ? "✓ Enabled" : "✗ Disabled"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* View Limit */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">View Limit</label>
                      <div className="flex gap-2">
                        {([{ val: false, label: "Limited" }, { val: true, label: "∞ Unlimited" }]).map(({ val, label }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => updateDraft(key, { isUnlimitedViews: val })}
                            className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                              draft.isUnlimitedViews === val
                                ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {!draft.isUnlimitedViews && (
                        <p className="text-[11px] text-slate-400">1 view = full watch-time budget</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Access Credits ── */}
                <div className="px-6 py-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Extend / Reduce Credits</h3>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    {/* Mode toggle */}
                    <div className="flex gap-2">
                      {(["add", "subtract"] as const).map((dir) => (
                        <button
                          key={dir}
                          type="button"
                          onClick={() => setExtendDirection(dir)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
                            extendDirection === dir
                              ? dir === "add"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                                : "border-red-200 bg-red-50 text-red-700 shadow-sm"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {dir === "add" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {dir === "add" ? "Add Credits" : "Subtract Credits"}
                        </button>
                      ))}
                    </div>

                    {/* Days + Watch time inputs */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Days</label>
                        <Input
                          type="number"
                          min={0}
                          value={extendDaysInput}
                          onChange={(e) => setExtendDaysInput(e.target.value)}
                          className="h-9 rounded-xl border-slate-200 bg-white text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Watch Hrs</label>
                        <Input
                          type="number"
                          min={0}
                          value={extendWatchHoursInput}
                          onChange={(e) => setExtendWatchHoursInput(e.target.value)}
                          className="h-9 rounded-xl border-slate-200 bg-white text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Watch Mins</label>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={extendWatchMinutesInput}
                          onChange={(e) => setExtendWatchMinutesInput(e.target.value)}
                          className="h-9 rounded-xl border-slate-200 bg-white text-sm"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full rounded-xl text-xs font-semibold ${
                        extendDirection === "add"
                          ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          : "border-red-200 text-red-700 hover:bg-red-50"
                      }`}
                      disabled={rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-extend`}
                      onClick={() => {
                        const extraDays = Math.max(0, Number(extendDaysInput || 0));
                        const extraWatchHoursWhole = Math.max(0, Number(extendWatchHoursInput || 0));
                        const extraWatchMinutes = Math.max(0, Math.min(59, Number(extendWatchMinutesInput || 0)));
                        const extraWatchHours = extraWatchHoursWhole + extraWatchMinutes / 60;
                        if (extraDays <= 0 && extraWatchHours <= 0) {
                          alert("Please add at least one credit: days or watch time.");
                          return;
                        }
                        const signedDays = extendDirection === "subtract" ? -extraDays : extraDays;
                        const signedWatchHours = extendDirection === "subtract" ? -extraWatchHours : extraWatchHours;
                        void runRowAction(`${selectedItem.studentId}-${selectedItem.courseId}-extend`, () =>
                          adminApi.extendStudentCourseAccess(
                            selectedItem.studentId,
                            selectedItem.courseId,
                            signedDays,
                            0,
                            signedWatchHours,
                          ),
                        );
                      }}
                    >
                      {rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-extend` ? (
                        <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying…</>
                      ) : extendDirection === "subtract" ? (
                        "Apply Subtraction"
                      ) : (
                        "Apply Extension"
                      )}
                    </Button>
                  </div>

                  {/* Manual Watch Time Adjust */}
                  {!draft.isUnlimitedViews && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-700">Manual Watch Time Adjust</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Action</label>
                          <select
                            value={adjustWatchDirection}
                            onChange={(e) => setAdjustWatchDirection(e.target.value === "subtract" ? "subtract" : "add")}
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            <option value="add">Add Time</option>
                            <option value="subtract">Subtract Time</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hours</label>
                          <Input
                            type="number"
                            min={0}
                            value={adjustWatchHoursInput}
                            onChange={(e) => setAdjustWatchHoursInput(e.target.value)}
                            className="h-9 rounded-xl border-slate-200 bg-white text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mins</label>
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            value={adjustWatchMinutesInput}
                            onChange={(e) => setAdjustWatchMinutesInput(e.target.value)}
                            className="h-9 rounded-xl border-slate-200 bg-white text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl text-xs font-semibold"
                        disabled={rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-adjust-watch`}
                        onClick={() => {
                          const hoursPart = Math.max(0, Number(adjustWatchHoursInput || 0));
                          const minutesPart = Math.max(0, Math.min(59, Number(adjustWatchMinutesInput || 0)));
                          const totalHours = hoursPart + minutesPart / 60;
                          if (totalHours <= 0) { alert("Enter watch time greater than 0."); return; }
                          const signedHours = adjustWatchDirection === "subtract" ? -totalHours : totalHours;
                          void runRowAction(`${selectedItem.studentId}-${selectedItem.courseId}-adjust-watch`, () =>
                            adminApi.adjustStudentCourseWatchTime(selectedItem.studentId, selectedItem.courseId, signedHours),
                          );
                        }}
                      >
                        {rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-adjust-watch` ? (
                          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying…</>
                        ) : (
                          "Apply Watch Adjustment"
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Footer Actions ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 px-6 py-4">
                  {/* Danger actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl border-slate-200 text-xs text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                      disabled={rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-reset`}
                      onClick={() => {
                        const confirmed = window.confirm("Reset used views/watch-time for this course access to zero?");
                        if (!confirmed) return;
                        void runRowAction(`${selectedItem.studentId}-${selectedItem.courseId}-reset`, () =>
                          adminApi.resetStudentCourseViews(selectedItem.studentId, selectedItem.courseId, 0),
                        );
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset Views
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl border-red-200 text-xs text-red-600 hover:bg-red-50"
                      disabled={rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-remove`}
                      onClick={() => {
                        const confirmed = window.confirm("Remove this course access for the student? This cannot be undone.");
                        if (!confirmed) return;
                        void runRowAction(`${selectedItem.studentId}-${selectedItem.courseId}-remove`, async () => {
                          await adminApi.removeStudentCourseAccess(selectedItem.studentId, selectedItem.courseId);
                          setSelectedAccessKey(null);
                        });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Access
                    </Button>
                  </div>

                  {/* Save / Close */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedAccessKey(null)}
                      className="rounded-xl border-slate-200 text-xs text-slate-600"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl px-4 text-xs font-semibold shadow-sm"
                      disabled={rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-save`}
                      onClick={() => {
                        void runRowAction(`${selectedItem.studentId}-${selectedItem.courseId}-save`, () => {
                          const parsedExpiresAt = draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null;
                          const unlimitedChanged = draft.isUnlimitedViews !== (selectedItem.isUnlimitedViews === true);
                          if (unlimitedChanged) {
                            const turningOn = draft.isUnlimitedViews;
                            const warning = turningOn
                              ? "Switch to unlimited access? Limited watch-time counters will no longer gate access."
                              : "Switch to limited access? Watch-time limits will be enforced from current course budget.";
                            if (!window.confirm(warning)) return Promise.resolve();
                          }
                          return adminApi.updateStudentCourseAccess(selectedItem.studentId, selectedItem.courseId, {
                            courseTitle: selectedItem.courseTitle,
                            expiresAt: parsedExpiresAt,
                            isEnabled: draft.isEnabled,
                            isUnlimitedViews: draft.isUnlimitedViews,
                          });
                        });
                      }}
                    >
                      {rowActionKey === `${selectedItem.studentId}-${selectedItem.courseId}-save` ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                      ) : (
                        <><Save className="h-3.5 w-3.5" /> Save Access</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
