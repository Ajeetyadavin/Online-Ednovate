import { useAdminAuth } from "@/context/AdminAuthContext";
import { Navigate, Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ShoppingCart,
  Tags,
  LogOut,
  Menu,
  X,
  Bell,
  Headset,
  Megaphone,
  Settings,
  AppWindow,
  Video,
  User,
  Shield,
  Gauge,
  GraduationCap,
  ScrollText,
  UserCheck,
  SlidersHorizontal,
  Braces,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminApi } from "@/services/adminApi";
import {
  ADMIN_SIDEBAR_DEFINITIONS,
  ADMIN_SIDEBAR_STORAGE_KEY,
  buildDefaultAdminSidebarConfig,
  getConfiguredAdminSidebarItems,
  normalizeAdminSidebarConfig,
} from "@/lib/adminSidebarConfig";

const iconMap = {
  dashboard: LayoutDashboard,
  courses: BookOpen,
  courseContent: BookOpen,
  bunnyVideo: Video,
  masters: SlidersHorizontal,
  coupons: Tags,
  faculty: GraduationCap,
  homepage: Settings,
  header: AppWindow,
  users: Users,
  studentAccess: Gauge,
  orders: ShoppingCart,
  leads: UserCheck,
  announcements: Bell,
  technicalSupport: Headset,
  marketing: Megaphone,
  settings: Settings,
  subadmins: Shield,
  logs: ScrollText,
  apis: Braces,
};

const AdminLayout = () => {
  const { admin, isAuthenticated, isLoading, logout, hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarConfig, setSidebarConfig] = useState(buildDefaultAdminSidebarConfig());
  const [homepageExpanded, setHomepageExpanded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY);
      if (stored) {
        setSidebarConfig(normalizeAdminSidebarConfig(JSON.parse(stored)));
      }
    } catch {
      setSidebarConfig(buildDefaultAdminSidebarConfig());
    }

    let cancelled = false;
    const loadFromServer = async () => {
      try {
        const response = await adminApi.getPlatformSettings();
        const site = (response?.settings?.siteSettings || {}) as Record<string, unknown>;
        const adminSidebarRaw = site.adminSidebar;
        if (cancelled) return;
        const normalized = normalizeAdminSidebarConfig(adminSidebarRaw);
        setSidebarConfig(normalized);
        localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // Keep local config on fetch failures.
      }
    };

    void loadFromServer();

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(() => getConfiguredAdminSidebarItems(sidebarConfig), [sidebarConfig]);

  useEffect(() => {
    if (["/admin/homepage", "/admin/header", "/admin/announcements"].some((path) => location.pathname.startsWith(path))) {
      setHomepageExpanded(true);
    }
  }, [location.pathname]);

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

  const allowedNavItems = navItems.filter((item) => item.enabled && item.visible && hasPermission(item.moduleKey, "read"));
  const homepageParentItem = allowedNavItems.find((item) => item.id === "homepage") || null;
  const homepageChildItems = allowedNavItems.filter((item) => item.id === "header" || item.id === "announcements");
  const showHomepageGroup = Boolean(homepageParentItem) || homepageChildItems.length > 0;
  const isHomepageGroupActive = ["/admin/homepage", "/admin/header", "/admin/announcements"].some((path) =>
    location.pathname.startsWith(path),
  );
  const currentModule =
    ADMIN_SIDEBAR_DEFINITIONS.find((item) => location.pathname.startsWith(item.to))?.moduleKey || "dashboard";
  const currentNavItem = navItems.find((item) => location.pathname.startsWith(item.to));
  const isCurrentFeatureEnabled = currentNavItem ? currentNavItem.enabled !== false : true;
  const canViewCurrentModule = hasPermission(currentModule, "read") && isCurrentFeatureEnabled;

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
            if (item.id === "header" || item.id === "announcements") {
              return null;
            }

            if (item.id === "homepage" && homepageParentItem) {
              return (
                <div key={item.to} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setHomepageExpanded((prev) => !prev);
                      navigate(homepageParentItem.to);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                      isHomepageGroupActive
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg"
                        : "text-gray-600 hover:text-gray-900 hover:bg-orange-50"
                    }`}
                  >
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="truncate flex-1 text-left">{homepageParentItem.label}</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${homepageExpanded ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </button>

                  {sidebarOpen && homepageExpanded && homepageChildItems.length > 0 && (
                    <div className="ml-6 space-y-1 border-l border-orange-100 pl-3">
                      {homepageChildItems.map((childItem) => {
                        const isActive = location.pathname === childItem.to;
                        const Icon = iconMap[childItem.iconName] || LayoutDashboard;
                        return (
                          <NavLink
                            key={childItem.to}
                            to={childItem.to}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                              isActive
                                ? "bg-orange-50 text-orange-700"
                                : "text-gray-600 hover:text-gray-900 hover:bg-orange-50"
                            }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{childItem.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = location.pathname === item.to;
            const Icon = iconMap[item.iconName] || LayoutDashboard;
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
                <Icon className="w-5 h-5 flex-shrink-0" />
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
                  {isCurrentFeatureEnabled
                    ? "Aapke account me is module ka view permission enabled nahi hai. Super Admin se access grant karvaye."
                    : "Yeh feature Admin Settings se OFF kiya gaya hai. Use dobara ON karne ke baad access milega."}
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
