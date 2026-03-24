import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BookOpen, User, ShoppingBag, PlayCircle, Clock, IndianRupee,
  Calendar, LogOut, Edit2, Save, TrendingUp, Bell,
  ChevronRight, Star, Target, LayoutDashboard, Award, Zap, Mail, Lock,
  GraduationCap, Clock3, CheckCircle, FolderOpen
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { usePlatformData } from "@/context/PlatformDataContext";
import LoginModal from "@/components/LoginModal";
import { changeStudentPasswordApi, getStudentDashboardApi, updateStudentCourseVideoQualityApi, updateStudentProfileApi } from "@/services/authApi";

type VideoQualityPref = "auto" | "high" | "medium" | "low";

const quickActions = [
  { label: "Browse Courses", icon: BookOpen, color: "bg-orange-100 text-[#E74623]", href: "/packages" },
  { label: "Technical Support", icon: Bell, color: "bg-blue-100 text-[#1e3a8a]", href: "/dashboard/technical-support" },
  { label: "Notifications", icon: Bell, color: "bg-amber-100 text-amber-600", href: "#", action: "notifications" },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { purchasedCourses, orders } = useCart();
  const { isLoggedIn, logout, user, refreshProfile } = useAuth();
  const { courses } = usePlatformData();
  const [isEditing, setIsEditing] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    joinedDate: "",
    avatar: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; subject?: string; message: string; createdAt: string }>>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [courseQualityPrefs, setCourseQualityPrefs] = useState<Record<string, VideoQualityPref>>({});
  const [qualitySavingCourseId, setQualitySavingCourseId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    setProfile((prev) => ({
      ...prev,
      name: user.name || "Student",
      email: user.email || "",
      phone: user.mobile || "",
      joinedDate: "",
    }));
  }, [user?.studentId, user?.name, user?.email, user?.mobile]);

  useEffect(() => {
    if (!isLoggedIn) return;

    let active = true;
    const loadNotifications = async () => {
      setIsNotificationsLoading(true);
      try {
        const result = await getStudentDashboardApi();
        if (!active || !result.ok || !result.data) return;

        const next = Array.isArray(result.data.notifications)
          ? result.data.notifications.map((item) => ({
              id: Number(item.id || 0),
              subject: String(item.subject || ""),
              message: String(item.message || ""),
              createdAt: String(item.createdAt || ""),
            }))
          : [];
        setNotifications(next);

        const prefMap = Object.fromEntries(
          (result.data.courseAccess || []).map((item) => [
            item.courseId,
            (item.preferredVideoQuality || "auto") as VideoQualityPref,
          ]),
        );
        setCourseQualityPrefs(prefMap);
      } finally {
        if (active) setIsNotificationsLoading(false);
      }
    };

    void loadNotifications();
    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  const dashboardCourses = useMemo(() => {
    return purchasedCourses.filter((course) => {
      if (!course.isCombo || !Array.isArray(course.packageCourseIds) || course.packageCourseIds.length === 0) {
        return true;
      }
      const hasAnyBundledChild = course.packageCourseIds.some((id) => purchasedCourses.some((p) => p.id === id));
      return !hasAnyBundledChild;
    });
  }, [purchasedCourses]);

  const totalHours = dashboardCourses.reduce((sum, c) => sum + (c.hours || 0), 0);
  const completedCount = dashboardCourses.filter(c => c.progress === 100).length;
  const avgProgress = dashboardCourses.length > 0
    ? Math.round(dashboardCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / dashboardCourses.length)
    : 0;

  const courseTitleById = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleQuickAction = (action: { href: string; action?: string }) => {
    if (action.action === "notifications") {
      setNotificationsOpen(true);
      return;
    }
    navigate(action.href);
  };

  const handleSaveProfile = async () => {
    setIsProfileSaving(true);
    try {
      const result = await updateStudentProfileApi({
        name: profile.name,
        email: profile.email,
        mobile: profile.phone,
      });
      if (!result.ok) {
        alert(result.message || "Failed to update profile");
        return;
      }
      await refreshProfile();
      setIsEditing(false);
      alert("Profile updated successfully");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      alert("Please enter current and new password");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New password and confirm password do not match");
      return;
    }
    setIsPasswordSaving(true);
    try {
      const result = await changeStudentPasswordApi(passwordForm.currentPassword, passwordForm.newPassword);
      if (!result.ok) {
        alert(result.message || "Failed to change password");
        return;
      }
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("Password changed successfully");
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleCourseQualityChange = async (courseId: string, nextValue: VideoQualityPref) => {
    setCourseQualityPrefs((prev) => ({ ...prev, [courseId]: nextValue }));
    setQualitySavingCourseId(courseId);

    const result = await updateStudentCourseVideoQualityApi({
      courseId,
      preferredVideoQuality: nextValue,
    });

    setQualitySavingCourseId("");

    if (!result.ok) {
      alert(result.message || "Failed to save quality preference");
      void getStudentDashboardApi().then((fresh) => {
        if (!fresh.ok || !fresh.data) return;
        const prefMap = Object.fromEntries(
          (fresh.data.courseAccess || []).map((item) => [
            item.courseId,
            (item.preferredVideoQuality || "auto") as VideoQualityPref,
          ]),
        );
        setCourseQualityPrefs(prefMap);
      });
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Login Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Please login or sign up to view your dashboard.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSignupMode(false);
                setLoginOpen(true);
              }}
            >
              Login
            </Button>
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => {
                setSignupMode(true);
                setLoginOpen(true);
              }}
            >
              Sign Up
            </Button>
          </div>
          <Button variant="ghost" className="mt-3" onClick={() => navigate("/")}>
            Back to Home
          </Button>
          <LoginModal
            open={loginOpen}
            onOpenChange={setLoginOpen}
            isSignup={signupMode}
            onToggleMode={() => setSignupMode((prev) => !prev)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-8">
      <div className="bg-[#1e3a8a] border-b border-[#1e3a8a]">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-7">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 md:w-16 md:h-16 border-2 md:border-3 border-white/30 shadow-xl shrink-0">
              <AvatarImage src={profile.avatar} />
              <AvatarFallback className="bg-white text-[#1e3a8a] text-lg md:text-2xl font-bold">
                {profile.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-white truncate">{profile.name}</h1>
              <p className="text-blue-200 text-xs md:text-sm flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Member since {profile.joinedDate || "N/A"}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-white text-[#1e3a8a] hover:bg-blue-50 font-semibold text-xs px-3 h-8 shrink-0"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: "Enrolled", value: dashboardCourses.length, icon: FolderOpen },
              { label: "Completed", value: completedCount, icon: CheckCircle },
              { label: "Hours", value: totalHours, icon: Clock3 },
              { label: "Progress", value: `${avgProgress}%`, icon: TrendingUp },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-lg p-2 md:p-3 text-center">
                <s.icon className="w-4 h-4 md:w-5 md:h-5 mx-auto text-white/80 mb-1" />
                <p className="text-base md:text-xl font-bold text-white">{s.value}</p>
                <p className="text-[9px] md:text-[11px] text-blue-200 truncate">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-10 mb-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto sm:max-w-xl">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action)}
              className="bg-card rounded-xl p-3 sm:p-4 shadow-md border border-border hover:shadow-lg hover:border-orange-200 transition-all text-center group"
            >
              <div className={`w-11 h-11 rounded-xl ${action.color} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-md`}>
                <action.icon className="w-5 h-5" />
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-foreground/80 leading-tight">{action.label}</p>
              {action.action === "notifications" && notifications.length > 0 ? (
                <span className="mt-1.5 inline-flex rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  {notifications.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <Tabs defaultValue="courses" className="space-y-5">
          <TabsList className="bg-card shadow-md rounded-2xl h-12 p-1.5 w-full sm:w-auto border border-slate-200/60">
            <TabsTrigger value="courses" className="rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#E74623] data-[state=active]:text-white data-[state=active]:shadow-md px-4 sm:px-6">
              <BookOpen className="w-4 h-4 mr-1.5 hidden sm:block" /> My Courses
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#E74623] data-[state=active]:text-white data-[state=active]:shadow-md px-4 sm:px-6">
              <ShoppingBag className="w-4 h-4 mr-1.5 hidden sm:block" /> Orders
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#E74623] data-[state=active]:text-white data-[state=active]:shadow-md px-4 sm:px-6">
              <User className="w-4 h-4 mr-1.5 hidden sm:block" /> Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="space-y-4">
            {dashboardCourses.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
                    <BookOpen className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No courses yet</h3>
                  <p className="text-sm text-slate-500 mb-5 max-w-xs">Start your learning journey by exploring our courses</p>
                  <Button className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl h-11 px-6 shadow-lg" onClick={() => navigate("/packages")}>
                    <Target className="w-4 h-4 mr-2" /> Explore Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboardCourses.map(course => (
                  <Card key={course.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 group border-slate-200/60">
                    <div className="relative h-36 sm:h-40 overflow-hidden">
                      <img
                        src={course.thumbnail || course.image || "/placeholder.svg"}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {course.progress === 100 && (
                        <div className="absolute inset-0 bg-emerald-500/90 flex items-center justify-center">
                          <Award className="w-12 h-12 text-white" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 flex gap-2">
                        {course.isCombo && (
                          <span className="bg-[#E74623] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                            BUNDLE
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        <select
                          aria-label="Video quality preference"
                          className="h-7 rounded-md border border-white/30 bg-black/60 px-2 text-[10px] font-semibold text-white backdrop-blur-sm focus:outline-none"
                          value={(courseQualityPrefs[course.id] || "auto") as VideoQualityPref}
                          onChange={(event) => void handleCourseQualityChange(course.id, event.target.value as VideoQualityPref)}
                          disabled={qualitySavingCourseId === course.id}
                        >
                          <option value="auto">Auto</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="flex items-center justify-between text-[11px] text-white/90">
                          <span className="font-semibold bg-black/50 px-2 py-0.5 rounded">{course.progress}% complete</span>
                          <span className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded"><Clock className="w-3 h-3" /> {course.hours}h</span>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <Badge variant="secondary" className="text-[10px] mb-2 font-semibold bg-blue-100 text-blue-700">{course.category.replace("-", " ").toUpperCase()}</Badge>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-1">{course.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {course.professor}
                      </p>
                      {course.isCombo && Array.isArray(course.packageCourseIds) && course.packageCourseIds.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1e3a8a] mb-1.5">Included Courses ({course.packageCourseIds.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {course.packageCourseIds.slice(0, 3).map((id) => {
                              const bundledTitle = courseTitleById.get(id) || purchasedCourses.find((p) => p.id === id)?.title || id;
                              return (
                                <span key={`${course.id}-${id}`} className="rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-medium text-blue-700 line-clamp-1">
                                  {bundledTitle}
                                </span>
                              );
                            })}
                            {course.packageCourseIds.length > 3 && (
                              <span className="text-[9px] text-blue-600 font-medium">+{course.packageCourseIds.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}
                      <Progress value={course.progress} className="h-1.5 bg-slate-100 rounded-full mb-3" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white text-xs h-9 rounded-xl font-semibold shadow-md group/btn"
                          onClick={() => navigate(`/learn/${course.id}`)}
                        >
                          <PlayCircle className="w-4 h-4 mr-1.5 group-hover/btn:scale-110 transition-transform" />
                          {course.progress === 100 ? "Review" : course.progress > 0 ? "Continue" : "Start"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-9 rounded-xl font-semibold border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={() => navigate(`/dashboard/course/${course.id}/about`)}
                        >
                          About
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-3">
            {orders.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
                    <ShoppingBag className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No orders yet</h3>
                  <p className="text-sm text-slate-500 mb-5">Your purchase history will appear here</p>
                  <Button className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl h-11 px-6 shadow-lg" onClick={() => navigate("/packages")}>
                    Browse Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              orders.map(order => (
                <Card
                  key={order.id}
                  className="hover:shadow-xl transition-all duration-300 border-slate-200/60 overflow-hidden cursor-pointer group"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className={`w-full sm:w-1.5 h-1.5 sm:h-auto ${order.status === "Completed" ? "bg-gradient-to-b from-emerald-400 to-emerald-500" : "bg-gradient-to-b from-amber-400 to-orange-500"}`} />
                      <div className="p-5 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <p className="text-sm font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">{order.id}</p>
                              <Badge className={`text-[10px] font-semibold ${order.status === "Completed" ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200" : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border-amber-200"} border`}>
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-2 mb-3">
                              <Calendar className="w-3.5 h-3.5" /> {order.date}
                            </p>
                            <div className="space-y-1.5">
                              {order.items.map((item, i) => (
                                <p key={i} className="text-sm text-slate-600 flex items-center gap-2">
                                  <BookOpen className="w-3.5 h-3.5 text-[#E74623] shrink-0" />
                                  <span className="line-clamp-1 font-medium">{item.title}</span>
                                </p>
                              ))}
                            </div>
                            <p className="mt-3 text-xs text-[#E74623] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              <ChevronRight className="w-3 h-3" /> Click to view full order details
                            </p>
                          </div>
                          <div className="text-right sm:min-w-[100px]">
                            <p className="text-xl font-bold text-slate-800 flex items-center justify-end">
                              <IndianRupee className="w-4 h-4 mr-0.5 text-[#E74623]" />{order.total.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="profile" className="pb-8">
            <Card className="border-slate-200 shadow-lg rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#E74623] shadow-md">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-800">Profile Settings</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Manage your account details</p>
                  </div>
                </div>
                {isEditing ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl shadow-md"
                    onClick={handleSaveProfile}
                    disabled={isProfileSaving}
                  >
                    <Save className="w-4 h-4 mr-1.5" /> {isProfileSaving ? "Saving..." : "Save"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-1.5" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-orange-50 border border-slate-100">
                  <Avatar className="w-16 h-16 border-3 border-white shadow-md">
                    <AvatarImage src={profile.avatar} />
                    <AvatarFallback className="bg-[#E74623] text-white text-xl font-bold">
                      {profile.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-bold text-slate-800">{profile.name}</p>
                    <p className="text-sm text-slate-500">{profile.email}</p>
                    {isEditing && (
                      <Button variant="link" size="sm" className="text-xs text-[#E74623] h-auto p-0 mt-1 font-semibold">
                        Change Photo
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {[
                    { label: "Full Name", key: "name" as const, editable: true, icon: User },
                    { label: "Email Address", key: "email" as const, editable: true, icon: Mail },
                    { label: "Phone Number", key: "phone" as const, editable: true, icon: User },
                    { label: "Member Since", key: "joinedDate" as const, editable: false, icon: Calendar },
                  ].map(field => (
                    <div key={field.key} className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <field.icon className="w-3.5 h-3.5" /> {field.label}
                      </Label>
                      <Input
                        value={profile[field.key]}
                        disabled={!isEditing || !field.editable}
                        onChange={e => setProfile(p => ({ ...p, [field.key]: e.target.value }))}
                        className={`h-12 text-sm rounded-xl ${!field.editable ? "bg-slate-50" : isEditing ? "border-[#E74623]/30 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100" : "border-slate-200"}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Change Password</h4>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">Current Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter current password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                        className="h-12 text-sm rounded-xl border-slate-200 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">New Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        className="h-12 text-sm rounded-xl border-slate-200 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">Confirm Password</Label>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        className="h-12 text-sm rounded-xl border-slate-200 focus:border-[#E74623] focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>
                  <Button
                    className="bg-[#E74623] hover:bg-[#d13a1a] text-white rounded-xl h-11 px-6 shadow-lg"
                    onClick={handleChangePassword}
                    disabled={isPasswordSaving}
                  >
                    {isPasswordSaving ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
          </DialogHeader>
          {isNotificationsLoading ? (
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{item.subject || "Order Update"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : ""}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <p><span className="font-semibold text-foreground">Order ID:</span> {selectedOrder.id}</p>
                <p><span className="font-semibold text-foreground">Date:</span> {selectedOrder.date}</p>
                <p><span className="font-semibold text-foreground">Payment:</span> {selectedOrder.paymentMethod || "-"}</p>
                <p><span className="font-semibold text-foreground">Status:</span> {selectedOrder.status}</p>
                <p><span className="font-semibold text-foreground">Dispatch:</span> {selectedOrder.dispatchStatus || "-"}</p>
                <p><span className="font-semibold text-foreground">Tracking:</span> {selectedOrder.trackingId || "-"}</p>
                <p className="md:col-span-2"><span className="font-semibold text-foreground">Note:</span> {selectedOrder.dispatchNote || "-"}</p>
              </div>

              <div className="space-y-3">
                {selectedOrder.items.map((item, index) => {
                  const itemType = String(item.itemType || "").toLowerCase();
                  const isPackage = itemType === "package";
                  const packageCourseIds = isPackage && item.courseId
                    ? (Array.isArray(courseById.get(item.courseId)?.packageCourseIds)
                        ? courseById.get(item.courseId)?.packageCourseIds
                        : [])
                    : [];
                  const includedTitles = Array.isArray(packageCourseIds)
                    ? packageCourseIds.map((id) => courseTitleById.get(id) || id)
                    : [];

                  return (
                    <div key={`${selectedOrder.id}-${index}-${item.title}`} className="rounded-lg border border-border p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <Badge variant="secondary">
                          {isPackage ? "Package" : item.isEbook ? "E-Book" : "Course"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Amount: ₹{Number(item.price || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Mode: {item.modeLabel || "-"}</p>
                      <p className="text-xs text-muted-foreground">Book Addon: {item.bookLabel || "-"}</p>

                      {isPackage && (
                        <div className="pt-1">
                          <p className="text-xs font-semibold text-foreground mb-1">Included Courses:</p>
                          {includedTitles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {includedTitles.map((title) => (
                                <span key={`${item.title}-${title}`} className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {title}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Package courses data unavailable</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
