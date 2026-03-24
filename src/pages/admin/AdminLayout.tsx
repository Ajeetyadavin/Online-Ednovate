import { useAdminAuth } from "@/context/AdminAuthContext";
import { Navigate, Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ShoppingCart,
  Tags,
  FolderTree,
  LogOut,
  Menu,
  X,
  Bell,
  Headset,
  Megaphone,
  Settings,
  AppWindow,
  User,
  Shield,
  Gauge,
  GraduationCap,
  ScrollText,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard", moduleKey: "dashboard" as const },
  { to: "/admin/courses", icon: BookOpen, label: "Courses", moduleKey: "courses" as const },
  { to: "/admin/course-content", icon: BookOpen, label: "Course Content", moduleKey: "course-content" as const },
  { to: "/admin/categories", icon: FolderTree, label: "Categories", moduleKey: "categories" as const },
  { to: "/admin/coupons", icon: Tags, label: "Coupons", moduleKey: "coupons" as const },
  { to: "/admin/faculty", icon: GraduationCap, label: "Faculty", moduleKey: "faculty" as const },
  { to: "/admin/homepage", icon: Settings, label: "Homepage Content", moduleKey: "homepage" as const },
  { to: "/admin/header", icon: AppWindow, label: "Header Module", moduleKey: "homepage" as const },
  { to: "/admin/users", icon: Users, label: "Students", moduleKey: "users" as const },
  { to: "/admin/student-access", icon: Gauge, label: "Student Access", moduleKey: "users" as const },
  { to: "/admin/orders", icon: ShoppingCart, label: "Orders", moduleKey: "orders" as const },
  { to: "/admin/leads", icon: UserCheck, label: "Leads", moduleKey: "leads" as const },
  { to: "/admin/announcements", icon: Bell, label: "Announcements", moduleKey: "announcements" as const },
  { to: "/admin/technical-support", icon: Headset, label: "Technical Support", moduleKey: "technical-support" as const },
  { to: "/admin/marketing", icon: Megaphone, label: "Marketing", moduleKey: "marketing" as const },
  { to: "/admin/settings", icon: Settings, label: "Settings", moduleKey: "settings" as const },
  { to: "/admin/subadmins", icon: Shield, label: "Sub Admins", moduleKey: "subadmins" as const },
  { to: "/admin/logs", icon: ScrollText, label: "Activity Logs", moduleKey: "logs" as const },
];

const getModuleForPath = (pathname: string) => {
  const match = navItems.find((item) => pathname.startsWith(item.to));
  return match?.moduleKey || "dashboard";
};

const AdminLayout = () => {
  const { admin, isAuthenticated, isLoading, logout, hasPermission } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 mb-4">
            <div className="w-8 h-8 rounded-full border-4 border-white border-t-orange-300 animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  const allowedNavItems = navItems.filter((item) => hasPermission(item.moduleKey, "read"));
  const currentModule = getModuleForPath(location.pathname);
  const canViewCurrentModule = hasPermission(currentModule, "read");

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-gray-200 transition-all duration-300 fixed h-screen left-0 top-0 z-40 flex flex-col shadow-lg`}
      >
        {/* Logo Section */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-lg text-white">
              E
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-gray-900 text-sm truncate">Ednovate</h1>
                <p className="text-xs text-orange-600 truncate font-semibold">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
          {allowedNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg"
                    : "text-gray-600 hover:text-gray-900 hover:bg-orange-50"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <Button
            onClick={logout}
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-600 hover:text-orange-600 hover:bg-orange-50"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-64" : "ml-20"} transition-all duration-300`}>
        {/* Top Header */}
        <header className="bg-white border-b border-orange-100 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:flex text-gray-600 hover:text-orange-600"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden text-gray-600 hover:text-orange-600"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm cursor-pointer">
                      {admin?.name?.charAt(0).toUpperCase()}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-4 py-3 border-b">
                    <p className="font-semibold text-sm text-gray-900">{admin?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{admin?.email}</p>
                  </div>
                  <DropdownMenuItem className="gap-2">
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="gap-2 text-red-600">
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {canViewCurrentModule ? (
              <Outlet />
            ) : (
              <div className="max-w-xl rounded-xl border border-red-200 bg-red-50 p-6">
                <h2 className="text-lg font-bold text-red-700">Access Restricted</h2>
                <p className="text-sm text-red-600 mt-2">
                  Aapke account me is module ka view permission enabled nahi hai. Super Admin se access grant karvaye.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
