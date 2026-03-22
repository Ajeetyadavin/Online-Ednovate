import { usePlatformData } from "@/context/PlatformDataContext";
import { useCart } from "@/context/CartContext";
import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/services/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BookOpen, Users, ShoppingCart, IndianRupee, TrendingUp, Eye, Zap } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, change, changeColor }: any) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardContent className="pt-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className={`text-xs font-medium ${changeColor}`}>{change}</p>
        </div>
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100">
          <Icon className="w-6 h-6 text-purple-600" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function AdminDashboard() {
  const { courses, categories } = usePlatformData();
  const { orders, purchasedCourses } = useCart();
  const [topContent, setTopContent] = useState<Array<{ course_id: string; views: number }>>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState({ totalEvents: 0, totalStudents: 0 });
  const [accessSummary, setAccessSummary] = useState({ total: 0, active: 0, disabled: 0, expired: 0, outOfViews: 0 });

  useEffect(() => {
    adminApi.topContent(5).then((res) => setTopContent(res.items || [])).catch(() => {
      // Ignore analytics load failure on dashboard.
    });
    adminApi.analyticsSummary().then((res) => setAnalyticsSummary(res)).catch(() => {
      // Ignore analytics load failure on dashboard.
    });
    adminApi.getStudentAccessSummary({ limit: 20 }).then((res) => {
      setAccessSummary(res.summary || { total: 0, active: 0, disabled: 0, expired: 0, outOfViews: 0 });
    }).catch(() => {
      // Ignore student access summary failure on dashboard.
    });
  }, []);

  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const visibleCourses = courses.filter((c) => c.isVisible).length;
    const completedOrders = orders.filter((o) => o.status === "Completed").length;

    return [
      {
        icon: BookOpen,
        label: "Total Courses",
        value: courses.length,
        change: `${visibleCourses} Live on Website`,
        changeColor: "text-green-600",
      },
      {
        icon: Users,
        label: "Active Students",
        value: purchasedCourses.length,
        change: "From course purchases",
        changeColor: "text-blue-600",
      },
      {
        icon: ShoppingCart,
        label: "Total Orders",
        value: orders.length,
        change: `${completedOrders} Completed`,
        changeColor: "text-purple-600",
      },
      {
        icon: IndianRupee,
        label: "Total Revenue",
        value: `₹${totalRevenue.toLocaleString()}`,
        change: "From all sales",
        changeColor: "text-orange-600",
      },
    ];
  }, [courses, orders, purchasedCourses]);

  // Sample chart data
  const revenueData = [
    { name: "Jan", value: 4000 },
    { name: "Feb", value: 3000 },
    { name: "Mar", value: 2000 },
    { name: "Apr", value: 2780 },
    { name: "May", value: 1890 },
    { name: "Jun", value: 2390 },
  ];

  const categoryData = categories.slice(0, 5).map((cat) => ({
    name: cat.name,
    value: Math.floor(Math.random() * 100) + 20,
  }));

  const COLORS = ["#9333ea", "#3b82f6", "#ec4899", "#f59e0b", "#10b981"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your platform overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {(accessSummary.expired > 0 || accessSummary.outOfViews > 0 || accessSummary.disabled > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Access Anomaly Alerts</CardTitle>
            <CardDescription className="text-amber-800">Learner access issues detected. Review Student Access module.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-white border border-amber-200 p-3">
              <p className="text-xs text-gray-600">Expired Access</p>
              <p className="text-2xl font-bold text-red-600">{accessSummary.expired}</p>
            </div>
            <div className="rounded-lg bg-white border border-amber-200 p-3">
              <p className="text-xs text-gray-600">Out of Views</p>
              <p className="text-2xl font-bold text-amber-600">{accessSummary.outOfViews}</p>
            </div>
            <div className="rounded-lg bg-white border border-amber-200 p-3">
              <p className="text-xs text-gray-600">Disabled Access</p>
              <p className="text-2xl font-bold text-slate-700">{accessSummary.disabled}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Last 6 months performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#9333ea"
                  strokeWidth={2}
                  dot={{ fill: "#9333ea", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
            <CardDescription>Course distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
            <CardDescription>Current order breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: "Completed", value: orders.filter((o) => o.status === "Completed").length },
                { name: "Processing", value: orders.filter((o) => o.status === "Processing").length },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Platform metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-700">Active Categories</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{categories.filter((c) => c.isVisible).length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-700">Visible Courses</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{courses.filter((c) => c.isVisible).length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-700">Conversion Rate</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {orders.length > 0 ? ((purchasedCourses.length / courses.length) * 100).toFixed(1) : "0"}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
              <span className="font-medium text-gray-700">Tracked Events</span>
              <span className="text-2xl font-bold text-gray-900">{analyticsSummary.totalEvents}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Most Viewed Content</CardTitle>
          <CardDescription>Live analytics from learner activity</CardDescription>
        </CardHeader>
        <CardContent>
          {topContent.length === 0 ? (
            <p className="text-sm text-gray-500">No view data yet. Open course pages to start tracking.</p>
          ) : (
            <div className="space-y-2">
              {topContent.map((item) => (
                <div key={item.course_id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{item.course_id}</span>
                  <Badge className="bg-orange-100 text-orange-800">{item.views} views</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
