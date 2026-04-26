import { usePlatformData } from "@/context/PlatformDataContext";
import { useCart } from "@/context/CartContext";
import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/services/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { BookOpen, Users, ShoppingCart, IndianRupee, TrendingUp, Eye, Zap, LayoutDashboard, AlertTriangle, BarChart3, PieChart as PieChartIcon, Activity, DollarSign, RefreshCw, Loader2 } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, change, changeColor, color }: any) => (
  <Card className="hover:shadow-md transition-all duration-200 border-l-4" style={{ borderLeftColor: color }}>
    <CardContent className="pt-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className={`text-xs font-medium ${changeColor}`}>{change}</p>
        </div>
        <div className="p-3 rounded-xl" style={{ background: `linear-gradient(135deg, ${color}15, ${color}30)` }}>
          <Icon className="w-6 h-6" style={{ color }} />
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
  
  // Error states
  const [topContentError, setTopContentError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [accessSummaryError, setAccessSummaryError] = useState<string | null>(null);
  
  // Loading states
  const [topContentLoading, setTopContentLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [accessSummaryLoading, setAccessSummaryLoading] = useState(true);

  const loadDashboardData = async () => {
    // Reset errors
    setTopContentError(null);
    setAnalyticsError(null);
    setAccessSummaryError(null);
    
    // Load top content
    setTopContentLoading(true);
    try {
      const topContentRes = await adminApi.topContent(5);
      setTopContent(topContentRes.items || []);
    } catch (error) {
      console.error('Failed to load top content:', error);
      setTopContentError('Failed to load most viewed content. Please try again.');
      setTopContent([]);
    } finally {
      setTopContentLoading(false);
    }
    
    // Load analytics summary
    setAnalyticsLoading(true);
    try {
      const analyticsRes = await adminApi.analyticsSummary();
      setAnalyticsSummary(analyticsRes);
    } catch (error) {
      console.error('Failed to load analytics summary:', error);
      setAnalyticsError('Failed to load analytics data. Some metrics may be unavailable.');
      setAnalyticsSummary({ totalEvents: 0, totalStudents: 0 });
    } finally {
      setAnalyticsLoading(false);
    }
    
    // Load access summary
    setAccessSummaryLoading(true);
    try {
      const accessRes = await adminApi.getStudentAccessSummary({ limit: 20 });
      setAccessSummary(accessRes.summary || { total: 0, active: 0, disabled: 0, expired: 0, outOfViews: 0 });
    } catch (error) {
      console.error('Failed to load student access summary:', error);
      setAccessSummaryError('Failed to load student access data. Anomaly alerts may be incomplete.');
      setAccessSummary({ total: 0, active: 0, disabled: 0, expired: 0, outOfViews: 0 });
    } finally {
      setAccessSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
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
        color: "#10b981",
      },
      {
        icon: Users,
        label: "Active Students",
        value: purchasedCourses.length,
        change: "From course purchases",
        changeColor: "text-blue-600",
        color: "#3b82f6",
      },
      {
        icon: ShoppingCart,
        label: "Total Orders",
        value: orders.length,
        change: `${completedOrders} Completed`,
        changeColor: "text-purple-600",
        color: "#9333ea",
      },
      {
        icon: IndianRupee,
        label: "Total Revenue",
        value: `₹${totalRevenue.toLocaleString()}`,
        change: "From all sales",
        changeColor: "text-orange-600",
        color: "#f59e0b",
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
      {/* Error alerts */}
      {(topContentError || analyticsError || accessSummaryError) && (
        <div className="space-y-2">
          {topContentError && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{topContentError}</AlertDescription>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => adminApi.topContent(5).then((res) => setTopContent(res.items || [])).catch(() => {})}
              >
                Retry
              </Button>
            </Alert>
          )}
          {analyticsError && (
            <Alert variant="destructive" className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{analyticsError}</AlertDescription>
            </Alert>
          )}
          {accessSummaryError && (
            <Alert variant="destructive" className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{accessSummaryError}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm">Welcome back! Here's your platform overview.</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl border-slate-200"
          onClick={loadDashboardData}
          disabled={topContentLoading || analyticsLoading || accessSummaryLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(topContentLoading || analyticsLoading || accessSummaryLoading) ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Access Anomaly Alerts Section */}
      {accessSummaryLoading ? (
        <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50/80 to-orange-50/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-amber-900 text-base">Access Anomaly Alerts</CardTitle>
            </div>
            <CardDescription className="text-amber-700">Loading access data...</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg bg-white/80 border border-amber-200/50 p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Loading...</p>
                <div className="h-8 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : accessSummaryError ? (
        <Card className="border-red-200/50 bg-gradient-to-r from-red-50/80 to-orange-50/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <CardTitle className="text-red-900 text-base">Access Data Unavailable</CardTitle>
            </div>
            <CardDescription className="text-red-700">Failed to load student access data. {accessSummaryError}</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg border-red-200 text-red-700"
              onClick={() => {
                setAccessSummaryError(null);
                loadDashboardData();
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Loading
            </Button>
          </CardContent>
        </Card>
      ) : (accessSummary.expired > 0 || accessSummary.outOfViews > 0 || accessSummary.disabled > 0) ? (
        <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50/80 to-orange-50/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-amber-900 text-base">Access Anomaly Alerts</CardTitle>
            </div>
            <CardDescription className="text-amber-700">Learner access issues detected. Review the Students module.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-white/80 border border-amber-200/50 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Expired Access</p>
              <p className="text-2xl font-bold text-red-600">{accessSummary.expired}</p>
            </div>
            <div className="rounded-lg bg-white/80 border border-amber-200/50 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Out of Views</p>
              <p className="text-2xl font-bold text-amber-600">{accessSummary.outOfViews}</p>
            </div>
            <div className="rounded-lg bg-white/80 border border-amber-200/50 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Disabled Access</p>
              <p className="text-2xl font-bold text-slate-700">{accessSummary.disabled}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">Revenue Trend</CardTitle>
                <CardDescription className="text-slate-500 text-xs">Last 6 months performance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#9333ea"
                  strokeWidth={3}
                  dot={{ fill: "#9333ea", r: 5, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7, fill: "#9333ea" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
                <PieChartIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">Top Categories</CardTitle>
                <CardDescription className="text-slate-500 text-xs">Course distribution</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">Orders by Status</CardTitle>
                <CardDescription className="text-slate-500 text-xs">Current order breakdown</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[
                { name: "Completed", value: orders.filter((o) => o.status === "Completed").length },
                { name: "Processing", value: orders.filter((o) => o.status === "Processing").length },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">Quick Stats</CardTitle>
                <CardDescription className="text-slate-500 text-xs">Platform metrics at a glance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50/50 to-blue-50/50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <span className="font-medium text-slate-700">Active Categories</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{categories.filter((c) => c.isVisible).length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Eye className="w-4 h-4 text-blue-600" />
                </div>
                <span className="font-medium text-slate-700">Visible Courses</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{courses.filter((c) => c.isVisible).length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <span className="font-medium text-slate-700">Conversion Rate</span>
              </div>
              <span className="text-xl font-bold text-slate-900">
                {orders.length > 0 ? ((purchasedCourses.length / courses.length) * 100).toFixed(1) : "0"}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50/50 to-amber-50/50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Activity className="w-4 h-4 text-amber-600" />
                </div>
                <span className="font-medium text-slate-700">Tracked Events</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{analyticsSummary.totalEvents}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">Most Viewed Content</CardTitle>
                <CardDescription className="text-slate-500 text-xs">Live analytics from learner activity</CardDescription>
              </div>
            </div>
            {topContentError && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setTopContentError(null);
                  adminApi.topContent(5)
                    .then((res) => setTopContent(res.items || []))
                    .catch(() => setTopContentError('Retry failed. Please check your connection.'));
                }}
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {topContentLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-slate-500">Loading view analytics...</p>
            </div>
          ) : topContentError ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-10 h-10 text-amber-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 mb-3">{topContentError}</p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  setTopContentError(null);
                  loadDashboardData();
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Data
              </Button>
            </div>
          ) : topContent.length === 0 ? (
            <div className="text-center py-6">
              <Eye className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No view data yet. Open course pages to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topContent.map((item, index) => (
                <div key={item.course_id} className="flex items-center justify-between bg-slate-50/50 rounded-lg px-4 py-3 border border-slate-100 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800 truncate max-w-xs">{item.course_id}</span>
                  </div>
                  <Badge className="bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-200">
                    {item.views} views
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
