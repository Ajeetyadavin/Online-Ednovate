import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, ShoppingCart, IndianRupee, TrendingUp, Eye } from "lucide-react";

const stats = [
  { label: "Total Courses", value: "24", icon: BookOpen, change: "+3 this month", color: "text-blue-600 bg-blue-100" },
  { label: "Total Students", value: "1,248", icon: Users, change: "+89 this week", color: "text-green-600 bg-green-100" },
  { label: "Total Orders", value: "856", icon: ShoppingCart, change: "+12 today", color: "text-purple-600 bg-purple-100" },
  { label: "Revenue", value: "₹12,45,000", icon: IndianRupee, change: "+18% vs last month", color: "text-orange-600 bg-orange-100" },
  { label: "Active Enrollments", value: "934", icon: TrendingUp, change: "92% completion", color: "text-teal-600 bg-teal-100" },
  { label: "Page Views", value: "15.2K", icon: Eye, change: "Last 30 days", color: "text-pink-600 bg-pink-100" },
];

const recentOrders = [
  { id: "ORD-001", name: "Rahul Kumar", course: "CA Foundation Complete", amount: "₹4,999", status: "Paid", date: "Today" },
  { id: "ORD-002", name: "Priya Sharma", course: "CS Executive Combo", amount: "₹7,999", status: "Pending", date: "Yesterday" },
  { id: "ORD-003", name: "Aman Gupta", course: "CMA Inter Law", amount: "₹2,499", status: "Paid", date: "2 days ago" },
  { id: "ORD-004", name: "Sneha Patel", course: "CA Inter Accounts", amount: "₹3,999", status: "Failed", date: "3 days ago" },
  { id: "ORD-005", name: "Vikash Singh", course: "Tax Masterclass", amount: "₹1,999", status: "Paid", date: "4 days ago" },
];

const AdminDashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back! Here's your platform overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-card-hover transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Order ID</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Student</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Course</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-2 font-mono text-xs">{order.id}</td>
                    <td className="py-3 px-2 font-medium">{order.name}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{order.course}</td>
                    <td className="py-3 px-2 font-semibold">{order.amount}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.status === "Paid" ? "bg-green-100 text-green-700" :
                        order.status === "Pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{order.date}</td>
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

export default AdminDashboard;
