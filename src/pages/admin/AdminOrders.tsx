import { useEffect, useMemo, useState } from "react";
import { adminApi, type AdminOrderLine } from "@/services/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCcw, UserRound, Trash2, Package, Download, Calendar, ChevronDown, ChevronUp, Mail, RotateCcw, FileText } from "lucide-react";

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
  const [orders, setOrders] = useState<AdminOrderLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState<"all" | "ebook" | "course" | "package">("all");
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

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      [order.orderId, order.studentName, order.studentEmail, order.courseTitle].some(
        (v) => String(v || "").toLowerCase().includes(q)
      )
    );
  }, [orders, searchTerm]);

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
</head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-weight:800;color:#1f3c88;letter-spacing:.08em;">EDNOVATE</div>
      <div style="text-align:right;">
        <div style="font-size:12px;color:#64748b;">INVOICE</div>
        <div style="font-weight:700;">${line.orderId}</div>
      </div>
    </div>
    <div style="padding:16px 20px;font-size:13px;color:#374151;">
      <p><strong>Student:</strong> ${line.studentName || "Student"}</p>
      <p><strong>Email:</strong> ${line.studentEmail || ""}</p>
      <p><strong>Date:</strong> ${line.orderDate || ""}</p>
      <p><strong>Payment:</strong> ${line.paymentMethod || "Online"}</p>
    </div>
    <div style="padding:0 20px 20px 20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:10px;">Item</th>
            <th style="padding:10px;">Details</th>
            <th style="padding:10px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${line.courseTitle || "Course"}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${details || "-"}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">₹${Number(line.amount || 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <div style="text-align:right;padding-top:12px;">
        <div style="font-size:12px;color:#64748b;">Total</div>
        <div style="font-size:18px;font-weight:800;color:#111827;">₹${Number(line.amount || 0).toLocaleString()}</div>
      </div>
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
      
      const rows = data.items.map((l: AdminOrderLine) => ({
        "Order ID": l.orderId || "",
        "Customer": l.studentName || "",
        "Email": l.studentEmail || "",
        "Course": l.courseTitle || "",
        "Amount": Number(l.amount || 0),
        "Status": l.dispatchStatus || "",
        "Date": l.orderDate || "",
      }));
      
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
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-500">Manage customer orders</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Total Orders</p>
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
                        <Button variant="ghost" size="sm" onClick={() => openHistory(order)}>
                          <UserRound className="w-4 h-4" />
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
            <DialogTitle>{selectedUserName} - Selected Order</DialogTitle>
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
                    <div className="text-sm text-gray-600 grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                      <p><span className="text-gray-400">Name:</span> {line.studentName || "—"}</p>
                      <p><span className="text-gray-400">Phone:</span> {line.studentMobile || "—"}</p>
                      <p><span className="text-gray-400">Email:</span> {line.studentEmail || "—"}</p>
                      <p><span className="text-gray-400">Tracking:</span> {line.trackingId || "—"}</p>
                      <p className="col-span-2"><span className="text-gray-400">Address:</span> {buildAddressText(line) || "—"}</p>
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