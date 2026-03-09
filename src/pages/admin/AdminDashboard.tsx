import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, ShoppingCart, IndianRupee, TrendingUp, Eye } from "lucide-react";
import { useMemo } from "react";
import { usePlatformData } from "@/context/PlatformDataContext";
import { useCart } from "@/context/CartContext";

const AdminDashboard = () => {
  const { courses, categories, banners, announcements, testimonials, curricula } = usePlatformData();
  const { orders, purchasedCourses } = useCart();

  const totalRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  );

  const visibleCourses = courses.filter((course) => course.isVisible).length;
  const visibleCategories = categories.filter((category) => category.isVisible).length;
  const totalLessons = Object.values(curricula).reduce(
    (sum, chapters) => sum + chapters.reduce((chapterSum, chapter) => chapterSum + chapter.lessons.length, 0),
    0,
  );

  const stats = [
    {
      label: "Total Courses",
      value: String(courses.length),
      icon: BookOpen,
      change: `${visibleCourses} visible on website`,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "Categories",
      value: String(categories.length),
      icon: Users,
      change: `${visibleCategories} visible categories`,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "Total Orders",
      value: String(orders.length),
      icon: ShoppingCart,
      change: `${purchasedCourses.length} purchased courses`,
      color: "text-purple-600 bg-purple-100",
    },
    {
      label: "Revenue",
      value: `₹${totalRevenue.toLocaleString()}`,
      icon: IndianRupee,
      change: "All completed checkouts",
      color: "text-orange-600 bg-orange-100",
    },
    {
      label: "LMS Lessons",
      value: String(totalLessons),
      icon: TrendingUp,
      change: `${Object.keys(curricula).length} courses with curriculum`,
      color: "text-teal-600 bg-teal-100",
    },
    {
      label: "Frontend Content",
      value: String(
        banners.filter((banner) => banner.isVisible).length +
          announcements.filter((announcement) => announcement.isVisible).length +
          testimonials.filter((testimonial) => testimonial.isVisible).length,
      ),
      icon: Eye,
      change: "Visible banners + announcements + testimonials",
      color: "text-pink-600 bg-pink-100",
    },
  ];

  const recentOrders = orders.slice(0, 8).map((order) => ({
    id: order.id,
    name: "Student",
    course: order.items.map((item) => item.title).join(", "),
    amount: `₹${order.total.toLocaleString()}`,
    status: order.status === "Completed" ? "Paid" : "Pending",
    date: order.date,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Platform overview: courses, frontend visibility, LMS content, and orders.
        </p>
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
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet. New checkouts will appear here.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
