import { useEffect, useMemo, useState } from "react";
import { adminApi, type AdminOrderLine } from "@/services/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCcw, UserRound, Trash2, Package, Truck, Clock, DollarSign, Filter, ShoppingBag } from "lucide-react";

const DISPATCH_STATUSES = ["pending", "processing", "dispatched", "delivered", "cancelled"] as const;

const statusBadgeCls: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  processing: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  dispatched: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  delivered: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  cancelled: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

const buildAddressText = (line: AdminOrderLine) => {
  return [
    line.shippingAddressLine1,
    line.shippingAddressLine2,
    line.shippingCity,
    line.shippingState,
    line.shippingPincode,
    line.shippingCountry,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrderLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dispatchFilter, setDispatchFilter] = useState<"all" | "pending" | "processing" | "dispatched" | "delivered" | "cancelled">("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<"all" | "ebook" | "course" | "package">("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [historyLines, setHistoryLines] = useState<AdminOrderLine[]>([]);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editDispatchStatus, setEditDispatchStatus] = useState<string>("pending");
  const [editTrackingId, setEditTrackingId] = useState("");
  const [editDispatchNote, setEditDispatchNote] = useState("");

  const loadOrders = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await adminApi.listOrders({
        search: searchTerm || undefined,
        dispatchStatus: dispatchFilter,
        itemType: itemTypeFilter,
        limit: 500,
      });
      setOrders(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [dispatchFilter, itemTypeFilter]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      [
        order.orderId,
        order.studentName,
        order.studentEmail,
        order.courseTitle,
        order.trackingId,
      ].some((value) => String(value || "").toLowerCase().includes(q)),
    );
  }, [orders, searchTerm]);

  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  }, [filteredOrders]);

  const openUserHistory = async (studentId: string, studentName: string) => {
    setSelectedStudentId(studentId);
    setSelectedUserName(studentName);
    setHistoryOpen(true);
    setHistoryLines([]);
    try {
      const data = await adminApi.getStudentOrderHistory(studentId);
      setHistoryLines(Array.isArray(data.lines) ? data.lines : []);
    } catch {
      setHistoryLines([]);
    }
  };

  const startEdit = (line: AdminOrderLine) => {
    setEditingLine(line.id);
    setEditDispatchStatus(line.dispatchStatus || "pending");
    setEditTrackingId(line.trackingId || "");
    setEditDispatchNote(line.dispatchNote || "");
  };

  const saveDispatch = async () => {
    if (!editingLine) return;
    try {
      await adminApi.updateOrderDispatch(editingLine, {
        dispatchStatus: editDispatchStatus,
        trackingId: editTrackingId,
        dispatchNote: editDispatchNote,
        status: "completed",
      });

      setOrders((prev) =>
        prev.map((line) =>
          line.id === editingLine
            ? { ...line, dispatchStatus: editDispatchStatus, trackingId: editTrackingId, dispatchNote: editDispatchNote }
            : line,
        ),
      );
      setHistoryLines((prev) =>
        prev.map((line) =>
          line.id === editingLine
            ? { ...line, dispatchStatus: editDispatchStatus, trackingId: editTrackingId, dispatchNote: editDispatchNote }
            : line,
        ),
      );
      setEditingLine(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dispatch details");
    }
  };

  const deleteOrder = async (line: AdminOrderLine) => {
    const confirmed = window.confirm(`Delete order ${line.orderId} for ${line.courseTitle}?`);
    if (!confirmed) return;

    try {
      await adminApi.deleteOrder(line.id);
      setOrders((prev) => prev.filter((item) => item.id !== line.id));
      setHistoryLines((prev) => prev.filter((item) => item.id !== line.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
            <p className="text-slate-500 text-sm">Track and manage customer orders</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Dispatched</p>
                <p className="text-3xl font-bold text-emerald-600">{orders.filter((o) => o.dispatchStatus === "dispatched").length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100">
                <Truck className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{orders.filter((o) => o.dispatchStatus === "pending").length}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-purple-600">₹{totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">All Orders</CardTitle>
                <CardDescription className="text-slate-500">{filteredOrders.length} orders found</CardDescription>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-slate-400" />
                <div className="flex gap-1">
                  {["all", "pending", "processing", "dispatched", "delivered"].map((status) => (
                    <Button
                      key={status}
                      variant={dispatchFilter === status ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDispatchFilter(status as any)}
                      className={`h-8 px-3 text-xs font-medium capitalize ${
                        dispatchFilter === status
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={itemTypeFilter}
                onChange={(e) => setItemTypeFilter(e.target.value as "all" | "ebook" | "course" | "package")}
              >
                <option value="all">All Items</option>
                <option value="ebook">E-Book</option>
                <option value="course">Course</option>
                <option value="package">Package</option>
              </select>
              <Button variant="outline" size="sm" onClick={() => void loadOrders()} disabled={isLoading} className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50">
                <RefreshCcw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64 h-9 rounded-lg border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200">
                  <TableHead className="font-semibold text-slate-700 text-sm">Order ID</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-sm">Customer</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-sm">Item</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-sm">Amount</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-sm">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-sm">Tracking</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-sm">Date</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <code className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-mono font-medium">
                          {order.orderId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{order.studentName || "Customer"}</p>
                          <p className="text-slate-500 text-xs">{order.studentEmail || "N/A"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900 text-sm line-clamp-1">{order.courseTitle}</p>
                          <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
                            {order.itemType === "package" ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">Package</span>
                            ) : order.isEbook ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">E-Book</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">Course</span>
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-slate-900">₹{Number(order.amount || 0).toLocaleString()}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusBadgeCls[order.dispatchStatus] || "bg-slate-100 text-slate-700 hover:bg-slate-100"} text-xs font-medium`}>
                          {order.dispatchStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600 font-mono text-xs">{order.trackingId || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-500">{order.orderDate || "-"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 w-8 p-0"
                            onClick={() => void openUserHistory(order.studentId, order.studentName || "Customer")}
                            title="View order history"
                          >
                            <UserRound className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 p-0"
                            onClick={() => void deleteOrder(order)}
                            title="Delete order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCcw className="w-5 h-5 animate-spin" />
                          <span>Loading orders...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Package className="w-10 h-10 text-slate-300" />
                          <span>No orders found</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-600 bg-rose-50 px-4 py-2 rounded-lg">{error}</p> : null}
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <UserRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">{selectedUserName}</DialogTitle>
                <p className="text-sm text-slate-500">Order History</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {historyLines.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No order history for this user.</p>
              </div>
            ) : (
              historyLines.map((line) => (
                <div key={line.id} className="rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{line.courseTitle}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">{line.orderId}</code>
                        <span className="text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{line.orderDate || "-"}</span>
                      </div>
                    </div>
                    <Badge className={`${statusBadgeCls[line.dispatchStatus] || "bg-slate-100 text-slate-700"} shrink-0`}>{line.dispatchStatus}</Badge>
                  </div>

                  {editingLine === line.id ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                        <select
                          value={editDispatchStatus}
                          onChange={(e) => setEditDispatchStatus(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          {DISPATCH_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Tracking ID</label>
                        <Input
                          value={editTrackingId}
                          onChange={(e) => setEditTrackingId(e.target.value)}
                          placeholder="Enter tracking ID"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Note</label>
                        <Input
                          value={editDispatchNote}
                          onChange={(e) => setEditDispatchNote(e.target.value)}
                          placeholder="Dispatch note"
                          className="h-9"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2 text-sm bg-slate-50 rounded-lg p-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <p><span className="text-slate-500 text-xs">Name:</span> <span className="text-slate-700 font-medium">{line.customerName || line.studentName || "-"}</span></p>
                        <p><span className="text-slate-500 text-xs">Phone:</span> <span className="text-slate-700 font-medium">{line.customerPhone || line.studentMobile || "-"}</span></p>
                        <p><span className="text-slate-500 text-xs">Email:</span> <span className="text-slate-700 font-medium">{line.customerEmail || line.studentEmail || "-"}</span></p>
                        <p className="col-span-2 sm:col-span-3"><span className="text-slate-500 text-xs">Address:</span> <span className="text-slate-700">{buildAddressText(line) || "Not provided"}</span></p>
                        <p><span className="text-slate-500 text-xs">Tracking:</span> <span className="text-slate-700 font-mono">{line.trackingId || "-"}</span></p>
                        <p><span className="text-slate-500 text-xs">Type:</span> <span className="text-slate-700">{line.itemType === "package" ? "Package" : line.isEbook ? "E-Book" : "Course"}</span></p>
                        <p><span className="text-slate-500 text-xs">Amount:</span> <span className="text-slate-900 font-semibold">₹{Number(line.amount || 0).toLocaleString()}</span></p>
                        <p><span className="text-slate-500 text-xs">Payment:</span> <span className="text-slate-700">{line.modeLabel || "-"}</span></p>
                        <p><span className="text-slate-500 text-xs">Book:</span> <span className="text-slate-700">{line.bookLabel || "-"}</span></p>
                        <p><span className="text-slate-500 text-xs">Package:</span> <span className="text-slate-700">{line.parentPackageTitle || (line.itemType === "package" ? line.courseTitle : "-")}</span></p>
                        <p className="col-span-2 sm:col-span-3"><span className="text-slate-500 text-xs">Note:</span> <span className="text-slate-700">{line.dispatchNote || "-"}</span></p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {editingLine === line.id ? (
                      <>
                        <Button size="sm" onClick={() => void saveDispatch()} className="bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingLine(null)} className="border-slate-200">Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(line)} className="border-slate-200 text-slate-700 hover:bg-slate-50">
                          Update Dispatch
                        </Button>
                        <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300" onClick={() => void deleteOrder(line)}>
                          Delete Order
                        </Button>
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
