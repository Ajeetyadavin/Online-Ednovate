import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";

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
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { PlatformDataProvider } from "./context/PlatformDataContext";
import ScrollToTop from "./components/ScrollToTop";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminCourseContent from "./pages/admin/AdminCourseContent";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminTechnicalSupport from "./pages/admin/AdminTechnicalSupport";
import AdminHomepage from "./pages/admin/AdminHomepage";
import AdminHeader from "./pages/admin/AdminHeader";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminSubAdmins from "./pages/admin/AdminSubAdmins";
import AdminStudentAccess from "./pages/admin/AdminStudentAccess";
import AdminMarketing from "./pages/admin/AdminMarketing";
import AdminFaculty from "./pages/admin/AdminFaculty";
import CourseCollection from "./pages/CourseCollection";
import FacultyDetail from "./pages/FacultyDetail";

const queryClient = new QueryClient();

// Main app content wrapped in context providers
const AppContent = () => (
  <QueryClientProvider client={queryClient}>
    <SiteSettingsProvider>
      <PlatformDataProvider>
        <AuthProvider>
          <CartProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ScrollToTop />
                <Routes>
                  {/* Public routes */}
                  <Route element={<Layout />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/packages" element={<Packages />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/order-confirmation" element={<OrderConfirmation />} />
                    <Route path="/course/:id" element={<CourseDetails />} />
                    <Route path="/learn/:id" element={<CourseLMS />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard/technical-support" element={<TechnicalSupport />} />
                    <Route path="/dashboard/course/:id/about" element={<CourseAbout />} />
                    <Route path="/collections/:slug" element={<CourseCollection />} />
                    <Route path="/faculty/:id" element={<FacultyDetail />} />
                    <Route path="/contact-us" element={<ContactUs />} />
                    <Route path="/api-test" element={<ApiTest />} />
                  </Route>

                  {/* Admin routes */}
                  <Route path="/admin" element={<AdminAuthProvider><AdminLogin /></AdminAuthProvider>} />
                  <Route path="/admin/login" element={<AdminAuthProvider><AdminLogin /></AdminAuthProvider>} />
                  <Route path="/admin/*" element={<AdminAuthProvider><AdminLayout /></AdminAuthProvider>}>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="courses" element={<AdminCourses />} />
                    <Route path="course-content" element={<AdminCourseContent />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                    <Route path="faculty" element={<AdminFaculty />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="student-access" element={<AdminStudentAccess />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="announcements" element={<AdminAnnouncements />} />
                    <Route path="technical-support" element={<AdminTechnicalSupport />} />
                    <Route path="marketing" element={<AdminMarketing />} />
                    <Route path="homepage" element={<AdminHomepage />} />
                    <Route path="header" element={<AdminHeader />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="subadmins" element={<AdminSubAdmins />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </CartProvider>
        </AuthProvider>
      </PlatformDataProvider>
    </SiteSettingsProvider>
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
