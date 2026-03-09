import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Order {
  id: string;
  orderNumber: string;
  studentName: string;
  email: string;
  courses: string[];
  amount: number;
  paymentMethod: string;
  status: "paid" | "pending" | "failed" | "refunded";
  date: string;
}

const mockOrders: Order[] = [
  { id: "1", orderNumber: "ORD-2024-001", studentName: "Rahul Kumar", email: "rahul@gmail.com", courses: ["CA Foundation Complete"], amount: 4999, paymentMethod: "UPI", status: "paid", date: "2024-12-01" },
  { id: "2", orderNumber: "ORD-2024-002", studentName: "Priya Sharma", email: "priya@gmail.com", courses: ["CS Executive Combo"], amount: 7999, paymentMethod: "Card", status: "pending", date: "2024-12-02" },
  { id: "3", orderNumber: "ORD-2024-003", studentName: "Aman Gupta", email: "aman@gmail.com", courses: ["CMA Inter Law"], amount: 2499, paymentMethod: "UPI", status: "paid", date: "2024-12-03" },
  { id: "4", orderNumber: "ORD-2024-004", studentName: "Sneha Patel", email: "sneha@gmail.com", courses: ["CA Inter Accounts", "Tax Planning"], amount: 5998, paymentMethod: "Net Banking", status: "failed", date: "2024-12-04" },
  { id: "5", orderNumber: "ORD-2024-005", studentName: "Vikash Singh", email: "vikash@gmail.com", courses: ["Tax Masterclass"], amount: 1999, paymentMethod: "UPI", status: "refunded", date: "2024-12-05" },
];

const statusColor: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-blue-100 text-blue-700",
};

const AdminOrders = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = mockOrders.filter((o) => {
    const matchSearch = o.studentName.toLowerCase().includes(search.toLowerCase()) || o.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">{mockOrders.length} total orders</p>
        </div>
        <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export CSV</Button>
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
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
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
                    <td className="py-3 px-4 font-mono text-xs">{order.orderNumber}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{order.studentName}</p>
                      <p className="text-xs text-muted-foreground">{order.email}</p>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {order.courses.map((c) => (
                        <span key={c} className="text-xs bg-muted px-2 py-0.5 rounded-full mr-1">{c}</span>
                      ))}
                    </td>
                    <td className="py-3 px-4 font-bold">₹{order.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{order.paymentMethod}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrders;
