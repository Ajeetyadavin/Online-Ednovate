import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart } from "@/context/CartContext";

const statusColor: Record<string, string> = {
  Completed: "bg-green-100 text-green-700",
  Processing: "bg-yellow-100 text-yellow-700",
};

const AdminOrders = () => {
  const { orders, updateOrderStatus } = useCart();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = orders.filter((order) => {
    const matchSearch =
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      (order.studentName || "").toLowerCase().includes(search.toLowerCase()) ||
      (order.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const exportCsv = () => {
    if (orders.length === 0) return;

    const lines = [
      "Order ID,Student Name,Email,Phone,Courses,Amount,Payment Method,Status,Date",
      ...orders.map((order) => {
        const values = [
          order.id,
          order.studentName || "Student",
          order.email || "",
          order.phone || "",
          order.items.map((item) => item.title).join(" | "),
          String(order.total),
          order.paymentMethod || "",
          order.status,
          order.date,
        ];
        return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">{orders.length} total orders</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Processing">Processing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No orders found.</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Order</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Student</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Courses</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden sm:table-cell">Payment</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono text-xs">{order.id}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{order.studentName || "Student"}</p>
                      <p className="text-xs text-muted-foreground">{order.email || "N/A"}</p>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {order.items.map((item) => (
                        <span key={item.title} className="text-xs bg-muted px-2 py-0.5 rounded-full mr-1">{item.title}</span>
                      ))}
                    </td>
                    <td className="py-3 px-4 font-bold">₹{order.total.toLocaleString()}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{order.paymentMethod || "N/A"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[order.status] || "bg-muted text-muted-foreground"}`}>
                        {order.status}
                      </span>
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as "Completed" | "Processing")}
                        className="block mt-1 text-[11px] border border-border rounded px-2 py-1 bg-background"
                      >
                        <option value="Completed">Completed</option>
                        <option value="Processing">Processing</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrders;
