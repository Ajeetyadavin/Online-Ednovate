import { useEffect, useMemo, useState } from "react";
import { adminApi, type ActivityLogItem } from "@/services/adminApi";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCcw, FileDown, Users, UserCog, GraduationCap, LogIn, ShoppingCart, Play, Calendar, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const actionBadgeClass = (action: string) => {
  const key = String(action || "").toLowerCase();
  if (key === "delete") return "bg-red-100 text-red-700 border-red-200";
  if (key === "create") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (key === "edit") return "bg-amber-100 text-amber-800 border-amber-200";
  if (key === "purchase") return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (key === "video_watch") return "bg-sky-100 text-sky-700 border-sky-200";
  if (key === "login") return "bg-gray-100 text-gray-700 border-gray-200";
  if (key === "course_assign") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (key === "course_update") return "bg-amber-100 text-amber-800 border-amber-200";
  if (key === "course_remove") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
};

const formatAction = (value: string) =>
  value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

export default function AdminLogs() {
  const { hasPermission } = useAdminAuth();
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [actorType, setActorType] = useState<"all" | "admin" | "subadmin" | "student">("all");
  const [actionType, setActionType] = useState<"all" | "login" | "create" | "edit" | "delete" | "purchase" | "video_watch" | "course_assign" | "course_update" | "course_remove">("all");
  const [actorId, setActorId] = useState("");
  const [actorName, setActorName] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState("300");

  const canRead = hasPermission("logs", "read");

  const loadLogs = async () => {
    if (!canRead) return;
    try {
      setIsLoading(true);
      setError("");
      const result = await adminApi.listActivityLogs({
        actorType,
        actionType,
        actorId: actorId.trim() || undefined,
        actorName: actorName.trim() || undefined,
        actorEmail: actorEmail.trim() || undefined,
        search: search.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        limit: Math.max(20, Math.min(2000, Number(limit || 300))),
      });
      setItems(result.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const summary = useMemo(() => {
    const next = {
      total: items.length,
      admin: 0,
      subadmin: 0,
      student: 0,
      login: 0,
      purchase: 0,
      videoWatch: 0,
    };

    items.forEach((item) => {
      if (item.actor_role === "super_admin") next.admin += 1;
      if (item.actor_role === "sub_admin") next.subadmin += 1;
      if (item.actor_role === "student") next.student += 1;
      if (item.action === "login") next.login += 1;
      if (item.action === "purchase") next.purchase += 1;
      if (item.action === "video_watch") next.videoWatch += 1;
    });

    return next;
  }, [items]);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const createdAt = new Date();

    doc.setFontSize(14);
    doc.text("Ednovate Activity Logs Report", 40, 36);
    doc.setFontSize(10);
    doc.text(`Generated: ${formatDateTime(createdAt.toISOString())}`, 40, 54);
    doc.text(`Filters: actor=${actorType}, action=${actionType}, actorId=${actorId || "all"}`, 40, 68);
    doc.text(`Name=${actorName || "any"}, Email=${actorEmail || "any"}`, 40, 82);
    doc.text(`Date range: ${from || "any"} to ${to || "any"}`, 40, 96);

    autoTable(doc, {
      startY: 110,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [249, 115, 22] },
      head: [["Date Time", "Role", "Name", "Action", "Module", "Target", "Course/Context", "Amount"]],
      body: items.map((item) => [
        formatDateTime(item.created_at),
        item.actor_role,
        `${item.actor_name || "-"}${item.actor_email ? ` (${item.actor_email})` : ""}`,
        item.action,
        item.module_key || "-",
        `${item.target_type || "-"}:${item.target_id || "-"}`,
        item.course_title || (item.details?.courseTitle as string) || (item.details?.lessonTitle as string) || "-",
        item.details?.notes ? `Note: ${String(item.details.notes)}` : (item.details?.studentName ? `Student: ${String(item.details.studentName)}` : "-"),
        typeof item.amount === "number" ? String(item.amount) : "-",
      ]),
    });

    const fileStamp = createdAt.toISOString().replace(/[:.]/g, "-");
    doc.save(`activity-logs-${fileStamp}.pdf`);
  };

  if (!canRead) {
    return (
      <div className="max-w-xl rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-bold text-red-700">Access Restricted</h2>
        <p className="text-sm text-red-600 mt-2">
          Aapke account me Activity Logs module ka access enabled nahi hai. Super Admin se access grant karvaye.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Calendar className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-gray-500 text-sm">Track all admin, sub-admin and student activities</p>
          </div>
        </div>
        <Button onClick={exportPdf} className="gap-2 bg-orange-600 hover:bg-orange-700" disabled={items.length === 0}>
          <FileDown className="w-4 h-4" />
          Download PDF
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-4 h-4 text-orange-600" />
                Filters
              </CardTitle>
              <CardDescription>Filter logs by actor type, action, date range, or search query</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={loadLogs} className="gap-2 bg-orange-600 hover:bg-orange-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Apply
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setActorType("all");
                  setActionType("all");
                  setActorId("");
                  setActorName("");
                  setActorEmail("");
                  setSearch("");
                  setFrom("");
                  setTo("");
                  setLimit("300");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Actor Type</label>
              <select
                value={actorType}
                onChange={(e) => setActorType(e.target.value as "all" | "admin" | "subadmin" | "student")}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Types</option>
                <option value="admin">Admin</option>
                <option value="subadmin">Sub Admin</option>
                <option value="student">Student</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Action</label>
              <select
                value={actionType}
                onChange={(e) =>
                  setActionType(
                    e.target.value as "all" | "login" | "create" | "edit" | "delete" | "purchase" | "video_watch" | "course_assign" | "course_update" | "course_remove",
                  )
                }
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Actions</option>
                <option value="login">Login</option>
                <option value="create">Create</option>
                <option value="edit">Edit</option>
                <option value="delete">Delete</option>
                <option value="purchase">Purchase</option>
                <option value="video_watch">Video Watch</option>
                <option value="course_assign">Course Assign</option>
                <option value="course_update">Course Update</option>
                <option value="course_remove">Course Remove</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Actor ID</label>
              <Input
                placeholder="std-123, subadmin-..."
                value={actorId}
                onChange={(e) => setActorId(e.target.value)}
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Max Rows</label>
              <Input 
                type="number"
                value={limit} 
                onChange={(e) => setLimit(e.target.value)} 
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                placeholder="Student/Sub Admin name"
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                placeholder="student@... or subadmin@..."
                value={actorEmail}
                onChange={(e) => setActorEmail(e.target.value)}
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">From Date</label>
              <Input 
                type="datetime-local" 
                value={from} 
                onChange={(e) => setFrom(e.target.value)} 
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">To Date</label>
              <Input 
                type="datetime-local" 
                value={to} 
                onChange={(e) => setTo(e.target.value)} 
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4 space-y-2">
              <label className="text-sm font-medium text-gray-700">Search</label>
              <Input
                placeholder="Search by name, email, action, module, target, or course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UserCog className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.admin}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500">Sub Admin</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.subadmin}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <GraduationCap className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-xs text-gray-500">Student</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.student}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <LogIn className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-xs text-gray-500">Logins</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.login}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xs text-gray-500">Purchases</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.purchase}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Play className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-xs text-gray-500">Video Watch</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.videoWatch}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-600" />
            Event Timeline
          </CardTitle>
          <CardDescription>Complete activity log with timestamps, actors, actions and context</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-600" />
              <p>Loading logs...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-40 font-semibold text-gray-700">Date Time</TableHead>
                    <TableHead className="font-semibold text-gray-700">Actor</TableHead>
                    <TableHead className="font-semibold text-gray-700">Action</TableHead>
                    <TableHead className="font-semibold text-gray-700">Module</TableHead>
                    <TableHead className="font-semibold text-gray-700">Target</TableHead>
                    <TableHead className="font-semibold text-gray-700">Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={`${item.actor_role}-${item.target_id}-${item.created_at}`} className="hover:bg-gray-50">
                      <TableCell className="py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDateTime(item.created_at)}
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="font-medium text-gray-900">{item.actor_name || "-"}</p>
                        <p className="text-xs text-gray-500 capitalize">{item.actor_role} {item.actor_id ? `| ${item.actor_id}` : ""}</p>
                        {item.actor_email && <p className="text-xs text-gray-500">{item.actor_email}</p>}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={actionBadgeClass(item.action)}>{formatAction(item.action)}</Badge>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-gray-600">{item.module_key || "-"}</TableCell>
                      <TableCell className="py-3 text-xs text-gray-600">{item.target_type || "-"}:{item.target_id || "-"}</TableCell>
                      <TableCell className="py-3 text-xs text-gray-600">
                        {item.course_title ? <p>Course: {item.course_title}</p> : null}
                        {(item.details?.courseTitle && !item.course_title) ? <p>Course: {String(item.details.courseTitle)}</p> : null}
                        {item.details?.studentName ? <p className="font-medium text-gray-800">Student: {String(item.details.studentName)}{item.details.studentEmail ? ` (${String(item.details.studentEmail)})` : ""}</p> : null}
                        {item.details?.notes ? <p className="text-orange-700 font-medium">Note: {String(item.details.notes)}</p> : null}
                        {typeof item.amount === "number" ? <p>Amount: {item.amount}</p> : null}
                        {item.ip_address ? <p>IP: {item.ip_address}</p> : null}
                        {item.details?.lessonTitle ? <p>Lesson: {String(item.details.lessonTitle)}</p> : null}
                        {item.details?.progressPercent !== undefined ? <p>Progress: {String(item.details.progressPercent)}%</p> : null}
                        {item.details?.viewedSeconds !== undefined ? <p>Viewed: {String(item.details.viewedSeconds)} sec</p> : null}
                        {item.details?.paymentMethod ? <p>Payment: {String(item.details.paymentMethod)}</p> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell className="p-8 text-center text-gray-500" colSpan={6}>No logs found for selected filters.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
