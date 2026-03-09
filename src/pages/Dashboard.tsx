import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, User, ShoppingBag, PlayCircle, Clock, IndianRupee,
  Calendar, LogOut, Edit2, Save, TrendingUp, Bell,
  ChevronRight, Star, Target
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

const mockUser = {
  name: "Rahul Sharma",
  email: "rahul.sharma@gmail.com",
  phone: "+91 9876543210",
  joinedDate: "Jan 2025",
  avatar: "",
};

const quickActions = [
  { label: "Browse Courses", icon: BookOpen, color: "bg-primary/10 text-primary", href: "/packages" },
  { label: "Notifications", icon: Bell, color: "bg-amber-500/10 text-amber-600", href: "#" },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { purchasedCourses, orders } = useCart();
  const { logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(mockUser);

  const totalHours = purchasedCourses.reduce((sum, c) => sum + (c.hours || 0), 0);
  const completedCount = purchasedCourses.filter(c => c.progress === 100).length;
  const avgProgress = purchasedCourses.length > 0
    ? Math.round(purchasedCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / purchasedCourses.length)
    : 0;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-8">
      {/* Hero Banner */}
      <div className="bg-[rgb(38,72,151)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-primary-foreground translate-y-1/2 -translate-x-1/4" />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 md:py-10 relative">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative">
              <Avatar className="w-20 h-20 border-[3px] border-primary-foreground/20 shadow-lg">
                <AvatarImage src={profile.avatar} />
                <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-bold">
                  {profile.name.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-primary flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground">{profile.name}</h1>
              <p className="text-primary-foreground/60 text-sm mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Member since {profile.joinedDate}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { label: "Enrolled", value: purchasedCourses.length, icon: BookOpen, accent: "text-blue-300" },
              { label: "Completed", value: completedCount, icon: Star, accent: "text-emerald-300" },
              { label: "Hours Learned", value: totalHours, icon: Clock, accent: "text-amber-300" },
              { label: "Avg Progress", value: `${avgProgress}%`, icon: TrendingUp, accent: "text-violet-300" },
            ].map(s => (
              <div key={s.label} className="bg-primary-foreground/[0.07] backdrop-blur-sm rounded-xl p-3.5 text-center border border-primary-foreground/[0.06]">
                <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.accent}`} />
                <p className="text-xl font-bold text-primary-foreground">{s.value}</p>
                <p className="text-[11px] text-primary-foreground/50 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-6xl mx-auto px-4 -mt-5 relative z-10 mb-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-xs mx-auto sm:max-w-sm">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.href)}
              className="bg-card rounded-xl p-3 sm:p-4 shadow-sm border border-border hover:shadow-md transition-all text-center group"
            >
              <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                <action.icon className="w-5 h-5" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-foreground/80 leading-tight">{action.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4">
        <Tabs defaultValue="courses" className="space-y-5">
          <TabsList className="bg-card shadow-sm rounded-xl h-11 p-1 w-full sm:w-auto border border-border">
            <TabsTrigger value="courses" className="rounded-lg text-xs sm:text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 sm:px-4">
              <BookOpen className="w-4 h-4 mr-1.5 hidden sm:block" /> My Courses
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-lg text-xs sm:text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 sm:px-4">
              <ShoppingBag className="w-4 h-4 mr-1.5 hidden sm:block" /> Orders
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-lg text-xs sm:text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 sm:px-4">
              <User className="w-4 h-4 mr-1.5 hidden sm:block" /> Profile
            </TabsTrigger>
          </TabsList>

          {/* MY COURSES */}
          <TabsContent value="courses" className="space-y-4">
            {purchasedCourses.length === 0 ? (
              <Card className="border-dashed border-2 border-border bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No courses yet</h3>
                  <p className="text-sm text-muted-foreground mb-5 max-w-xs">Start your learning journey by exploring our courses</p>
                  <Button className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg h-10 px-6" onClick={() => navigate("/packages")}>
                    <Target className="w-4 h-4 mr-2" /> Explore Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {purchasedCourses.map(course => (
                  <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-all group border-border">
                    <div className="flex">
                      <div className="w-28 sm:w-36 shrink-0 overflow-hidden relative">
                        <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        {course.progress === 100 && (
                          <div className="absolute inset-0 bg-emerald-600/80 flex items-center justify-center">
                            <Star className="w-8 h-8 text-white" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <Badge variant="secondary" className="text-[10px] mb-1.5 font-medium">{course.category.replace("-", " ").toUpperCase()}</Badge>
                          <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">{course.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {course.professor}
                          </p>
                        </div>
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                            <span className="font-medium">{course.progress}% complete</span>
                            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {course.hours}h</span>
                          </div>
                          <Progress value={course.progress} className="h-1.5 bg-muted" />
                          <Button
                            size="sm"
                            className="mt-2.5 w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs h-8 rounded-lg font-semibold group/btn"
                            onClick={() => navigate(`/learn/${course.id}`)}
                          >
                            <PlayCircle className="w-3.5 h-3.5 mr-1 group-hover/btn:scale-110 transition-transform" />
                            {course.progress === 100 ? "Review" : course.progress > 0 ? "Continue" : "Start"}
                            <ChevronRight className="w-3 h-3 ml-auto" />
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="space-y-3">
            {orders.length === 0 ? (
              <Card className="border-dashed border-2 border-border bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <ShoppingBag className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No orders yet</h3>
                  <p className="text-sm text-muted-foreground mb-5">Your purchase history will appear here</p>
                  <Button className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg h-10 px-6" onClick={() => navigate("/packages")}>
                    Browse Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              orders.map(order => (
                <Card key={order.id} className="hover:shadow-md transition-all border-border overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className={`w-full sm:w-1.5 h-1.5 sm:h-auto ${order.status === "Completed" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <div className="p-4 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-sm font-bold text-foreground">{order.id}</p>
                              <Badge className={`text-[10px] ${order.status === "Completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" : "bg-amber-500/10 text-amber-700 border-amber-200"} border`}>
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                              <Calendar className="w-3.5 h-3.5" /> {order.date}
                            </p>
                            <div className="space-y-1">
                              {order.items.map((item, i) => (
                                <p key={i} className="text-xs text-foreground/75 flex items-center gap-1.5">
                                  <BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="line-clamp-1">{item.title}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground flex items-center">
                              <IndianRupee className="w-4 h-4" />{order.total.toLocaleString()}
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

          {/* PROFILE */}
          <TabsContent value="profile" className="pb-8">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Profile Settings</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage your account details</p>
                </div>
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  className={isEditing ? "bg-accent hover:bg-accent/90 text-accent-foreground" : ""}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? <><Save className="w-4 h-4 mr-1.5" /> Save</> : <><Edit2 className="w-4 h-4 mr-1.5" /> Edit</>}
                </Button>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                  <Avatar className="w-16 h-16 border-2 border-border">
                    <AvatarImage src={profile.avatar} />
                    <AvatarFallback className="bg-accent text-accent-foreground text-xl font-bold">
                      {profile.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                    {isEditing && (
                      <Button variant="link" size="sm" className="text-xs text-accent h-auto p-0 mt-1">
                        Change Photo
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { label: "Full Name", key: "name" as const, editable: true },
                    { label: "Email Address", key: "email" as const, editable: true },
                    { label: "Phone Number", key: "phone" as const, editable: true },
                    { label: "Member Since", key: "joinedDate" as const, editable: false },
                  ].map(field => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
                      <Input
                        value={profile[field.key]}
                        disabled={!isEditing || !field.editable}
                        onChange={e => setProfile(p => ({ ...p, [field.key]: e.target.value }))}
                        className={`h-11 text-sm rounded-lg ${!field.editable ? "bg-muted" : isEditing ? "border-accent/30 focus:border-accent" : ""}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
