import "./App.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import Layout from "./components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Packages from "./pages/Packages";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import CourseDetails from "./pages/CourseDetails";
import Dashboard from "./pages/Dashboard";
import TechnicalSupport from "./pages/TechnicalSupport";
import CourseLMS from "./pages/CourseLMS";
import CourseAbout from "./pages/CourseAbout";
import ApiTest from "./pages/ApiTest";
import ContactUs from "./pages/ContactUs";
import Maintenance from "./pages/Maintenance";
import TestSeries from "./pages/TestSeries";
import TestPaperDetails from "./pages/TestPaperDetails";
import TestAttempt from "./pages/TestAttempt";
import { CartProvider } from "./context/CartContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { SiteSettingsProvider, useSiteSettings } from "./context/SiteSettingsContext";
import { PlatformDataProvider } from "./context/PlatformDataContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import ScrollToTop from "./components/ScrollToTop";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminCourseContent from "./pages/admin/AdminCourseContent";
import AdminBunnyVideo from "./pages/admin/AdminBunnyVideo";
import AdminMasters from "./pages/admin/AdminMasters";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminTechnicalSupport from "./pages/admin/AdminTechnicalSupport";
import AdminHomepage from "./pages/admin/AdminHomepage";
import AdminHeader from "./pages/admin/AdminHeader";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminSubAdmins from "./pages/admin/AdminSubAdmins";
import AdminMarketing from "./pages/admin/AdminMarketing";
import AdminFaculty from "./pages/admin/AdminFaculty";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminApiModule from "./pages/admin/AdminApiModule";
import AdminCrackIt from "./pages/admin/AdminCrackIt";
import CourseCollection from "./pages/CourseCollection";
import FacultyDetail from "./pages/FacultyDetail";
import AboutUs from "./pages/AboutUs";
import { ProfessorAuthProvider, useProfessorAuth } from "./context/ProfessorAuthContext";
import ProfessorLogin from "./pages/ProfessorLogin";
import ProfessorDashboard from "./pages/ProfessorDashboard";

const queryClient = new QueryClient();
const FORCED_LOGOUT_NOTICE_KEY = "ednovate_forced_logout_notice";

type ForcedLogoutNotice = {
  message: string;
  at?: string;
  audience?: "admin" | "student" | string;
};

const PublicRouteGuard = () => {
  const { settings } = useSiteSettings();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  if (!isAdminRoute && settings.maintenanceMode) {
    return <Maintenance />;
  }

  return <Outlet />;
};

const ProfessorProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useProfessorAuth();
  const location = useLocation();
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/professor/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
};

const StudentProtectedRoute = () => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

const SiteSecurityGuard = () => {
  const { settings } = useSiteSettings();
  const location = useLocation();
  const [isLocked, setIsLocked] = useState(false);
  const lockTriggeredRef = useRef(false);

  const isAdminRoute = location.pathname.startsWith("/admin");
  const antiInspectEnabled = settings.security?.antiInspectEnabled === true;
  const disableCopyPaste = settings.security?.disableCopyPaste === true;

  const forceClosePage = () => {
    if (lockTriggeredRef.current) return;
    lockTriggeredRef.current = true;

    try {
      sessionStorage.setItem("ednovate_security_locked", "1");
    } catch {
      // ignore storage issues
    }

    try {
      window.open("", "_self");
    } catch {
      // no-op
    }
    try {
      window.close();
    } catch {
      // no-op
    }
    try {
      window.location.replace("about:blank");
    } catch {
      // no-op
    }
  };

  const runInspectChecks = () => {
    const widthGap = window.outerWidth - window.innerWidth;
    const heightGap = window.outerHeight - window.innerHeight;
    const hasDevtoolsBySize = widthGap > 120 || heightGap > 120;

    return hasDevtoolsBySize;
  };

  useLayoutEffect(() => {
    if (isAdminRoute || !antiInspectEnabled) {
      lockTriggeredRef.current = false;
      try {
        sessionStorage.removeItem("ednovate_security_locked");
      } catch {
        // ignore storage issues
      }
      return;
    }

    const previouslyLocked = (() => {
      try {
        return sessionStorage.getItem("ednovate_security_locked") === "1";
      } catch {
        return false;
      }
    })();

    if (previouslyLocked || runInspectChecks()) {
      setIsLocked(true);
      forceClosePage();
    }
  }, [antiInspectEnabled, isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute || !antiInspectEnabled) {
      setIsLocked(false);
      return;
    }

    const triggerSecurityLock = () => {
      setIsLocked(true);
      window.setTimeout(() => {
        forceClosePage();
      }, 40);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const inspectShortcut =
        key === "f12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (event.ctrlKey && key === "u");

      if (inspectShortcut) {
        event.preventDefault();
        event.stopPropagation();
        triggerSecurityLock();
      }
    };

    const detector = window.setInterval(() => {
      if (runInspectChecks()) {
        triggerSecurityLock();
      }
    }, 500);

    if (runInspectChecks()) {
      triggerSecurityLock();
    }

    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.clearInterval(detector);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [antiInspectEnabled, isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute || !disableCopyPaste) {
      return;
    }

    const prevent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blockedShortcut = event.ctrlKey && ["c", "x", "v", "a", "s"].includes(key);
      if (blockedShortcut) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("copy", prevent, true);
    document.addEventListener("cut", prevent, true);
    document.addEventListener("paste", prevent, true);
    document.addEventListener("contextmenu", prevent, true);
    document.addEventListener("selectstart", prevent, true);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("copy", prevent, true);
      document.removeEventListener("cut", prevent, true);
      document.removeEventListener("paste", prevent, true);
      document.removeEventListener("contextmenu", prevent, true);
      document.removeEventListener("selectstart", prevent, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [disableCopyPaste, isAdminRoute]);

  if (!isLocked || isAdminRoute || !antiInspectEnabled) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-6 text-white">
      <div className="max-w-lg space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-6 text-center">
        <h2 className="text-lg font-semibold">Security policy triggered</h2>
        <p className="text-sm text-slate-300">Developer tools were detected. Closing this page by site security policy.</p>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          onClick={() => forceClosePage()}
        >
          Close Page
        </button>
      </div>
    </div>
  );
};

const ForcedLogoutNoticeOverlay = () => {
  const [notice, setNotice] = useState<ForcedLogoutNotice | null>(null);

  useEffect(() => {
    const readNotice = () => {
      try {
        const raw = localStorage.getItem(FORCED_LOGOUT_NOTICE_KEY);
        if (!raw) {
          setNotice(null);
          return;
        }
        const parsed = JSON.parse(raw) as ForcedLogoutNotice;
        if (!parsed?.message) {
          setNotice(null);
          return;
        }
        setNotice(parsed);
      } catch {
        setNotice(null);
      }
    };

    readNotice();
    const onStorage = (event: StorageEvent) => {
      if (event.key === FORCED_LOGOUT_NOTICE_KEY) {
        readNotice();
      }
    };

    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(readNotice, 1000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, []);

  if (!notice) return null;

  const formattedTime = notice.at
    ? new Date(notice.at).toLocaleString("en-IN")
    : "";

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl rounded-xl border border-rose-300 bg-white p-6 text-center shadow-2xl">
        <h2 className="text-lg font-bold text-rose-700">Session Logged Out</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{notice.message}</p>
        {formattedTime && (
          <p className="mt-2 text-xs text-slate-500">Detected at: {formattedTime}</p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            onClick={() => {
              localStorage.removeItem(FORCED_LOGOUT_NOTICE_KEY);
              setNotice(null);
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// Main app content wrapped in context providers
const AppContent = () => (
  <QueryClientProvider client={queryClient}>
    <ConfirmProvider>
      <SiteSettingsProvider>
        <PlatformDataProvider>
          <AuthProvider>
            <CartProvider>
              <ProfessorAuthProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <ScrollToTop />
                    <SiteSecurityGuard />
                    <ForcedLogoutNoticeOverlay />
                    <Routes>
                      <Route element={<PublicRouteGuard />}>
                        {/* Public routes */}
                        <Route element={<Layout />}>
                          <Route path="/" element={<Index />} />
                          <Route path="/packages" element={<Packages />} />
                          <Route path="/about-us" element={<AboutUs />} />
                          <Route path="/login" element={<Login />} />
                          <Route path="/signup" element={<Signup />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/checkout" element={<Checkout />} />
                          <Route path="/order-confirmation" element={<OrderConfirmation />} />
                          <Route path="/course/:id" element={<CourseDetails />} />
                          <Route path="/collections/:slug" element={<CourseCollection />} />
                          <Route path="/faculty/:id" element={<FacultyDetail />} />
                          <Route path="/contact-us" element={<ContactUs />} />
                          <Route path="/test-series" element={<TestSeries />} />
                          <Route path="/test-series/:id" element={<TestPaperDetails />} />
                          <Route path="/api-test" element={<ApiTest />} />
                          <Route element={<StudentProtectedRoute />}>
                            <Route path="/learn/:id" element={<CourseLMS />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/dashboard/technical-support" element={<TechnicalSupport />} />
                            <Route path="/dashboard/course/:id/about" element={<CourseAbout />} />
                          </Route>
                        </Route>
                        <Route element={<StudentProtectedRoute />}>
                          <Route path="/dashboard/test-attempt/:id" element={<TestAttempt />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Route>
                      <Route path="/professor/login" element={<ProfessorLogin />} />
                      <Route element={<ProfessorProtectedRoute />}>
                        <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
                      </Route>

                      {/* Admin routes */}
                      <Route path="/admin" element={<AdminAuthProvider><AdminLogin /></AdminAuthProvider>} />
                      <Route path="/admin/login" element={<AdminAuthProvider><AdminLogin /></AdminAuthProvider>} />
                      <Route path="/admin/*" element={<AdminAuthProvider><AdminLayout /></AdminAuthProvider>}>
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="courses" element={<AdminCourses mode="courses" />} />
                        <Route path="packages" element={<AdminCourses mode="packages" />} />
                        <Route path="course-content" element={<AdminCourseContent />} />
                        <Route path="bunny-video" element={<AdminBunnyVideo />} />
                        <Route path="categories" element={<AdminMasters />} />
                        <Route path="masters" element={<AdminMasters />} />
                        <Route path="coupons" element={<AdminCoupons />} />
                        <Route path="faculty" element={<AdminFaculty />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="orders" element={<AdminOrders />} />
                        <Route path="leads" element={<AdminLeads />} />
                        <Route path="announcements" element={<AdminAnnouncements />} />
                        <Route path="technical-support" element={<AdminTechnicalSupport />} />
                        <Route path="marketing" element={<AdminMarketing />} />
                        <Route path="homepage" element={<AdminHomepage />} />
                        <Route path="header" element={<AdminHeader />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="subadmins" element={<AdminSubAdmins />} />
                        <Route path="logs" element={<AdminLogs />} />
                        <Route path="apis" element={<AdminApiModule />} />
                        <Route path="crackit/questions" element={<AdminCrackIt mode="questions" />} />
                        <Route path="crackit/papers" element={<AdminCrackIt mode="papers" />} />
                      </Route>
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
              </ProfessorAuthProvider>
            </CartProvider>
          </AuthProvider>
        </PlatformDataProvider>
      </SiteSettingsProvider>
    </ConfirmProvider>
  </QueryClientProvider>
);

// Load screens
const LoadingScreen = () => (
  <div className="w-full h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="inline-block">
        <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-muted-foreground">Initializing Ednovate...</p>
    </div>
  </div>
);

const App = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Give the context providers a moment to initialize
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return <AppContent />;
};

export default App;
