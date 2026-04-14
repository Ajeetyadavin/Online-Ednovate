import { useEffect, useMemo, useState } from "react";
import { adminApi, type AdminOrderLine } from "@/services/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCcw, Eye, Trash2, Package, Download, Calendar, ChevronDown, ChevronUp, Mail, RotateCcw, FileText } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import { resolveUploadAssetUrl } from "@/lib/runtimeUrls";

const DISPATCH_STATUSES = ["pending", "processing", "dispatched", "delivered", "cancelled", "refunded"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700 border-orange-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  dispatched: "bg-purple-100 text-purple-700 border-purple-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  refunded: "bg-rose-100 text-rose-700 border-rose-200",
};

const buildAddressText = (line: AdminOrderLine) => {
  return [
    line.shippingAddressLine1,
    line.shippingAddressLine2,
    line.shippingCity,
    line.shippingState,
    line.shippingPincode,
  ].map((v) => String(v || "").trim()).filter(Boolean).join(", ");
};

export default function AdminOrders() {
  const { settings } = useSiteSettings();
  const { courses, categories, getCurriculumForCourse } = usePlatformData();
  const [orders, setOrders] = useState<AdminOrderLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState<"all" | "ebook" | "course" | "package">("all");
  const [masterFilter, setMasterFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [historyLines, setHistoryLines] = useState<AdminOrderLine[]>([]);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("pending");
  const [editTracking, setEditTracking] = useState("");
  const [editNote, setEditNote] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await adminApi.listOrders({
        search: searchTerm || undefined,
        dispatchStatus: statusFilter,
        itemType: itemFilter,
        from: fromDate ? fromDate + 'T00:00' : undefined,
        to: toDate ? toDate + 'T23:59' : undefined,
        limit: 500,
      });
      setOrders(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, [statusFilter, itemFilter]);

  const courseMetaById = useMemo(() => {
    const map = new Map<string, {
      title: string;
      level: string;
      subject: string;
      chapters: string[];
    }>();

    const categoriesById = new Map(categories.map((category) => [String(category.id), category]));

    courses.forEach((course) => {
      const courseId = String(course.id || "").trim();
      if (!courseId) return;

      const categoryId = String(course.category || "").trim();
      const category = categoriesById.get(categoryId);
      const level = String(
        category?.name
          || course.masterConfig?.levelName
          || course.subcategory
          || categoryId
          || "",
      ).trim();

      const subject = String(course.subject || "").trim();

      const curriculum = getCurriculumForCourse(courseId, course.title);
      const chapterTitlesById = new Map(
        curriculum
          .map((chapter) => [String(chapter.id || "").trim(), String(chapter.title || "").trim()] as const)
          .filter((entry) => entry[0] && entry[1]),
      );

      const selected = Array.isArray(course.selectedChapters)
        ? course.selectedChapters.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

      const explicitChapter = String(course.chapter || "").trim();

      const resolvedSelected = selected
        .map((entry) => chapterTitlesById.get(entry) || entry)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);

      const chapterPool = resolvedSelected.length > 0
        ? resolvedSelected
        : explicitChapter
          ? [explicitChapter]
          : curriculum
              .map((chapter) => String(chapter.title || "").trim())
              .filter(Boolean);

      const chapters = Array.from(new Set(chapterPool));

      map.set(courseId, {
        title: String(course.title || "").trim(),
        level,
        subject,
        chapters,
      });
    });

    return map;
  }, [courses, categories, getCurriculumForCourse]);

  const masterOptions = useMemo(() => {
    const entries = new Map<string, string>();
    orders.forEach((order) => {
      const mode = String(order.modeLabel || "").trim();
      if (mode) entries.set(`mode:${mode}`, `Mode: ${mode}`);
      const book = String(order.bookLabel || "").trim();
      if (book) entries.set(`book:${book}`, `Book: ${book}`);
    });
    return Array.from(entries.entries()).map(([value, label]) => ({ value, label }));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      const meta = courseMetaById.get(String(order.courseId || "").trim());
      const courseTitleFilterValue = String(meta?.title || order.courseTitle || "").trim();
      const levelFilterValue = String(meta?.level || "").trim();
      const subjectFilterValue = String(meta?.subject || "").trim();
      const chapterFilterValues = Array.isArray(meta?.chapters) ? meta!.chapters : [];

      const matchesSearch = !q || [order.orderId, order.studentName, order.studentEmail, order.courseTitle].some(
        (v) => String(v || "").toLowerCase().includes(q)
      );

      const matchesMaster = masterFilter === "all"
        ? true
        : masterFilter.startsWith("mode:")
          ? String(order.modeLabel || "").trim() === masterFilter.slice(5)
          : masterFilter.startsWith("book:")
            ? String(order.bookLabel || "").trim() === masterFilter.slice(5)
            : true;

      const normalizedAccess = String(order.accessStatus || "").trim().toLowerCase();
      const matchesAccess = accessFilter === "all" || normalizedAccess === accessFilter;

      const matchesCourse = courseFilter === "all" || courseTitleFilterValue === courseFilter;
      const matchesLevel = levelFilter === "all" || levelFilterValue === levelFilter;
      const matchesSubject = subjectFilter === "all" || subjectFilterValue === subjectFilter;
      const matchesChapter = chapterFilter === "all" || chapterFilterValues.includes(chapterFilter);

      return matchesSearch
        && matchesMaster
        && matchesAccess
        && matchesCourse
        && matchesLevel
        && matchesSubject
        && matchesChapter;
    });
  }, [orders, searchTerm, masterFilter, accessFilter, courseMetaById, courseFilter, levelFilter, subjectFilter, chapterFilter]);

  const courseOptions = useMemo(() => {
    const entries = new Set<string>();
    orders.forEach((order) => {
      const meta = courseMetaById.get(String(order.courseId || "").trim());
      const title = String(meta?.title || order.courseTitle || "").trim();
      if (title) entries.add(title);
    });
    return Array.from(entries).sort((a, b) => a.localeCompare(b));
  }, [orders, courseMetaById]);

  const levelOptions = useMemo(() => {
    const entries = new Set<string>();
    orders.forEach((order) => {
      const meta = courseMetaById.get(String(order.courseId || "").trim());
      const level = String(meta?.level || "").trim();
      if (level) entries.add(level);
    });
    return Array.from(entries).sort((a, b) => a.localeCompare(b));
  }, [orders, courseMetaById]);

  const subjectOptions = useMemo(() => {
    const entries = new Set<string>();
    orders.forEach((order) => {
      const meta = courseMetaById.get(String(order.courseId || "").trim());
      const subject = String(meta?.subject || "").trim();
      if (subject) entries.add(subject);
    });
    return Array.from(entries).sort((a, b) => a.localeCompare(b));
  }, [orders, courseMetaById]);

  const chapterOptions = useMemo(() => {
    const entries = new Set<string>();
    orders.forEach((order) => {
      const meta = courseMetaById.get(String(order.courseId || "").trim());
      (meta?.chapters || []).forEach((chapter) => {
        const value = String(chapter || "").trim();
        if (value) entries.add(value);
      });
    });
    return Array.from(entries).sort((a, b) => a.localeCompare(b));
  }, [orders, courseMetaById]);

  const getOrderAcademicMeta = (order: AdminOrderLine) => {
    const meta = courseMetaById.get(String(order.courseId || "").trim());
    return {
      level: String(meta?.level || "").trim(),
      subject: String(meta?.subject || "").trim(),
      chapters: (meta?.chapters || []).map((entry) => String(entry || "").trim()).filter(Boolean),
    };
  };

  const totalRevenue = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (o.dispatchStatus === "refunded" ? 0 : Number(o.amount || 0)), 0),
    [filteredOrders],
  );

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.dispatchStatus === "pending").length,
    dispatched: orders.filter(o => o.dispatchStatus === "dispatched").length,
    delivered: orders.filter(o => o.dispatchStatus === "delivered").length,
  }), [orders]);

  const openHistory = (line: AdminOrderLine) => {
    setSelectedUserName(line.studentName || "User");
    setHistoryOpen(true);
    setHistoryLines([line]);
    setEditingLine(null);
    setError("");
    setSuccess("");
  };

  const startEdit = (line: AdminOrderLine) => {
    setEditingLine(line.id);
    setEditStatus(line.dispatchStatus || "pending");
    setEditTracking(line.trackingId || "");
    setEditNote(line.dispatchNote || "");
  };

  const saveEdit = async () => {
    if (!editingLine) return;
    try {
      setError("");
      setSuccess("");
      await adminApi.updateOrderDispatch(editingLine, {
        dispatchStatus: editStatus,
        trackingId: editTracking,
        dispatchNote: editNote,
        status: editStatus === "refunded" ? "refunded" : "completed",
      });
      setOrders(prev => prev.map(l => l.id === editingLine ? { ...l, dispatchStatus: editStatus, trackingId: editTracking, dispatchNote: editNote } : l));
      setHistoryLines(prev => prev.map(l => l.id === editingLine ? { ...l, dispatchStatus: editStatus, trackingId: editTracking, dispatchNote: editNote } : l));
      setEditingLine(null);
      setSuccess("Order status updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const buildInvoiceHtml = (line: AdminOrderLine) => {
    const taxableAmount = Math.max(0, Number(line.baseAmount || 0));
    const taxAmount = Math.max(0, Number(line.taxAmount || 0));
    const totalAmount = Math.max(0, Number(line.amount || 0));
    const logoUrl = `${window.location.origin}${resolveUploadAssetUrl(settings.logo, "/ednovate-logo.png")}`;
    const companyName = String(settings.header?.brandTitle || "Ednovate").trim() || "Ednovate";
    const companyAddress = "4th floor, Ajanta Square Building, near Borivali court, Sundar Nagar, Borivali West, Mumbai, Maharashtra 400092";
    const billingAddress = buildAddressText(line) || "Address unavailable";
    const studentName = String(line.studentName || line.customerName || "Student");
    const invoiceDate = line.orderDate ? new Date(line.orderDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");
    const invoiceNo = String(line.orderId || `INV-${line.id}`);
    const details = [
      line.itemType ? `Type: ${line.itemType}` : "",
      line.modeLabel ? `Mode: ${line.modeLabel}` : "",
      line.bookLabel ? `Book: ${line.bookLabel}` : "",
    ].filter(Boolean).join(" | ");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice-${line.orderId}</title>
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
        <div>${line.studentEmail || line.customerEmail || "-"}</div>
        <div>${line.studentMobile || line.customerPhone || "-"}</div>
        <div>${billingAddress}</div>
        <div style="margin-top:4px;"><strong>Payment:</strong> ${line.paymentMethod || "Online"}</div>
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
              <div style="font-weight:700;">${line.courseTitle || "Course"}</div>
              <div style="color:#4b5563;font-size:12px;margin-top:4px;">${details || "Course purchase"}</div>
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
  };

  const downloadInvoice = (line: AdminOrderLine) => {
    const html = buildInvoiceHtml(line);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${line.orderId || `invoice-${line.id}`}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const sendInvoiceToUser = async (line: AdminOrderLine) => {
    try {
      setError("");
      setSuccess("");
      setActionLoadingId(line.id);
      await adminApi.sendOrderInvoice(line.id);
      setSuccess(`Invoice sent to ${line.studentEmail || "user"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setActionLoadingId(null);
    }
  };

  const refundOrder = async (line: AdminOrderLine) => {
    if (line.dispatchStatus === "refunded") return;
    const confirmed = window.confirm(`Refund order ${line.orderId}? This will remove course access.`);
    if (!confirmed) return;
    const refundNote = window.prompt("Refund note (optional):", line.dispatchNote || "") || "";

    try {
      setError("");
      setSuccess("");
      setActionLoadingId(line.id);
      const result = await adminApi.refundOrder(line.id, refundNote);
      const updated = result.item;
      setOrders((prev) => prev.map((row) => (row.id === line.id ? { ...row, ...updated } : row)));
      setHistoryLines((prev) => prev.map((row) => (row.id === line.id ? { ...row, ...updated } : row)));
      setEditingLine(null);
      setSuccess(`Order ${line.orderId} refunded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refund order");
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteOrder = async (line: AdminOrderLine) => {
    if (!window.confirm(`Delete order ${line.orderId}?`)) return;
    try {
      await adminApi.deleteOrder(line.id);
      setOrders(prev => prev.filter(i => i.id !== line.id));
      setHistoryLines(prev => prev.filter(i => i.id !== line.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const exportExcel = async () => {
    try {
      setError("");
      const data = await adminApi.listOrders({ 
        search: searchTerm || undefined,
        dispatchStatus: statusFilter,
        itemType: itemFilter,
        from: fromDate ? fromDate + 'T00:00' : undefined,
        to: toDate ? toDate + 'T23:59' : undefined,
        limit: 10000 
      });
      
      if (!data || !data.items || data.items.length === 0) {
        setError("No orders to export");
        return;
      }
      
      const rows = data.items.map((l: AdminOrderLine) => {
        const academic = getOrderAcademicMeta(l);
        return {
          "Order ID": l.orderId || "",
          "Customer": l.studentName || "",
          "Email": l.studentEmail || "",
          "Course": l.courseTitle || "",
          "Level": academic.level || "",
          "Subject": academic.subject || "",
          "Chapter": academic.chapters.join(", "),
          "Purchase": l.purchaseDate || l.orderDate || "",
          "Expiry": l.expiresAt ? new Date(l.expiresAt).toLocaleDateString("en-IN") : "",
          "Views": `${Number(l.usedViews || 0)}/${Number(l.totalViews || 0)}`,
          "Views Left": Number(l.remainingViews || 0),
          "Access": l.accessStatus || "",
          "Dispatch Status": l.dispatchStatus || "",
          "Amount": Number(l.amount || 0),
          "Date": l.orderDate || "",
        };
      });
      
      const { utils, writeFile } = await import("xlsx");
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Orders");
      writeFile(wb, "orders.xlsx");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
            <p className="text-sm text-gray-500">Manage customer sales</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Dispatched</p>
            <p className="text-2xl font-bold text-purple-600">{stats.dispatched}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>

            <Select value={itemFilter} onValueChange={(value) => setItemFilter(value as "all" | "ebook" | "course" | "package")}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="course">Course</SelectItem>
                <SelectItem value="ebook">E-Book</SelectItem>
                <SelectItem value="package">Package</SelectItem>
              </SelectContent>
            </Select>

            <Select value={masterFilter} onValueChange={setMasterFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Master Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Masters</SelectItem>
                {masterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={accessFilter} onValueChange={setAccessFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Access</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="out_of_views">Out of Views</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courseOptions.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {levelOptions.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjectOptions.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={chapterFilter} onValueChange={setChapterFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Chapter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chapters</SelectItem>
                {chapterOptions.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => setShowDateFilter(!showDateFilter)} className={showDateFilter ? "bg-gray-100" : ""}>
              <Calendar className="w-4 h-4 mr-2" />
              Date
              {showDateFilter ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>

            <Button variant="outline" onClick={() => void loadOrders()} disabled={isLoading}>
              <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button variant="outline" onClick={() => void exportExcel()}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {showDateFilter && (
            <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-600">From:</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-600">To:</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <Button size="sm" onClick={() => void loadOrders()}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</Button>
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {success && <p className="text-green-600 text-sm mt-2">{success}</p>}
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Order ID</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Course</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Amount</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">Loading...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">No orders found</td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{order.orderId}</code>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{order.studentName || "—"}</p>
                      <p className="text-xs text-gray-500">{order.studentEmail || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">{order.courseTitle}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={
                        order.itemType === "package" ? "border-purple-300 text-purple-700" :
                        order.isEbook ? "border-amber-300 text-amber-700" :
                        "border-blue-300 text-blue-700"
                      }>
                        {order.itemType === "package" ? "Package" : order.isEbook ? "E-Book" : "Course"}
                      </Badge>
                      {(order.modeLabel || order.bookLabel) && (
                        <p className="text-[11px] text-gray-500 mt-1">{[order.modeLabel, order.bookLabel].filter(Boolean).join(" | ")}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">₹{Number(order.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${statusColors[order.dispatchStatus] || "bg-gray-100 text-gray-700"}`}>
                        {order.dispatchStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{order.orderDate || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openHistory(order)} title="Access Details">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteOrder(order)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedUserName} - Access Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {historyLines.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No orders found</p>
            ) : (
              historyLines.map((line) => (
                <div key={line.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{line.courseTitle}</p>
                      <p className="text-sm text-gray-500">{line.orderId} • {line.orderDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{Number(line.amount || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Tax: ₹{Number(line.taxAmount || 0).toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[line.dispatchStatus]}`}>
                        {line.dispatchStatus}
                      </span>
                    </div>
                  </div>

                  {editingLine === line.id ? (
                    <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="grid gap-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={editStatus} onValueChange={setEditStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DISPATCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">Tracking ID</Label>
                        <Input value={editTracking} onChange={(e) => setEditTracking(e.target.value)} />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">Note</Label>
                        <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Access Details</p>
                      </div>
                      <div className="text-sm text-gray-600 grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                      {(() => {
                        const academic = getOrderAcademicMeta(line);
                        return (
                          <>
                            <p><span className="text-gray-400">Level:</span> {academic.level || "—"}</p>
                            <p><span className="text-gray-400">Subject:</span> {academic.subject || "—"}</p>
                            <p className="col-span-2"><span className="text-gray-400">Chapter:</span> {academic.chapters.length > 0 ? academic.chapters.join(", ") : "—"}</p>
                          </>
                        );
                      })()}
                      <p><span className="text-gray-400">Order ID:</span> {line.orderId || "—"}</p>
                      <p><span className="text-gray-400">Course:</span> {line.courseTitle || "—"}</p>
                      <p><span className="text-gray-400">Name:</span> {line.studentName || "—"}</p>
                      <p><span className="text-gray-400">Phone:</span> {line.studentMobile || "—"}</p>
                      <p><span className="text-gray-400">Email:</span> {line.studentEmail || "—"}</p>
                      <p><span className="text-gray-400">Tracking:</span> {line.trackingId || "—"}</p>
                      <p><span className="text-gray-400">Purchase Date:</span> {line.purchaseDate || line.orderDate || "—"}</p>
                      <p><span className="text-gray-400">Expiry:</span> {line.expiresAt ? new Date(line.expiresAt).toLocaleDateString("en-IN") : "—"}</p>
                      <p><span className="text-gray-400">Views:</span> {Number(line.usedViews || 0)}/{Number(line.totalViews || 0)} (Left {Number(line.remainingViews || 0)})</p>
                      <p><span className="text-gray-400">Access:</span> {line.accessStatus || "—"}</p>
                      <p><span className="text-gray-400">Dispatch Status:</span> {line.dispatchStatus || "—"}</p>
                      <p className="col-span-2"><span className="text-gray-400">Address:</span> {buildAddressText(line) || "—"}</p>
                    </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadInvoice(line)}>
                      <FileText className="w-4 h-4 mr-1" />
                      Download Invoice
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void sendInvoiceToUser(line)}
                      disabled={actionLoadingId === line.id}
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      {actionLoadingId === line.id ? "Sending..." : "Send Invoice"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-700"
                      onClick={() => void refundOrder(line)}
                      disabled={line.dispatchStatus === "refunded" || actionLoadingId === line.id}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      {line.dispatchStatus === "refunded" ? "Refunded" : "Refund"}
                    </Button>
                    {editingLine === line.id ? (
                      <>
                        <Button size="sm" onClick={saveEdit}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingLine(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(line)}>Edit</Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteOrder(line)}>Delete</Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}