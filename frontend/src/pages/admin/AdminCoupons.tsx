import { useEffect, useMemo, useState } from "react";
import { type ManagedCoupon, usePlatformData } from "@/context/PlatformDataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Power, Search, Eye } from "lucide-react";
import { adminApi, type StudentRecord } from "@/services/adminApi";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { toast } from "sonner";
import { useConfirm } from "@/context/ConfirmContext";

const weekDays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const paymentMethods = ["upi", "card", "netbanking"];

type CouponForm = {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
  discountType: "percent" | "fixed";
  discountValue: number;
  enableMaxDiscount: boolean;
  maxDiscount: number;
  enableMinPurchase: boolean;
  minPurchase: number;
  enableCourseRestriction: boolean;
  singleCourseOnly: boolean;
  selectedCourseIds: string[];
  enableStudentRestriction: boolean;
  singleStudentOnly: boolean;
  selectedStudentEmails: string[];
  enableDateWindow: boolean;
  validFrom: string;
  validTo: string;
  enableDayRestriction: boolean;
  allowedDaysOfWeek: number[];
  firstPurchaseOnly: boolean;
  enableUsageLimits: boolean;
  maxTotalUses: number;
  maxUsesPerUser: number;
  maxUniqueUsers: number;
  enablePaymentRestriction: boolean;
  allowedPaymentMethods: string[];
};

const makeCode = () => `EDN${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const defaultForm = (): CouponForm => ({
  id: `coupon-${Date.now()}`,
  code: makeCode(),
  description: "",
  isActive: true,
  discountType: "percent",
  discountValue: 10,
  enableMaxDiscount: false,
  maxDiscount: 0,
  enableMinPurchase: false,
  minPurchase: 0,
  enableCourseRestriction: false,
  singleCourseOnly: false,
  selectedCourseIds: [],
  enableStudentRestriction: false,
  singleStudentOnly: false,
  selectedStudentEmails: [],
  enableDateWindow: false,
  validFrom: "",
  validTo: "",
  enableDayRestriction: false,
  allowedDaysOfWeek: [],
  firstPurchaseOnly: false,
  enableUsageLimits: false,
  maxTotalUses: 0,
  maxUsesPerUser: 0,
  maxUniqueUsers: 0,
  enablePaymentRestriction: false,
  allowedPaymentMethods: [],
});

const toForm = (coupon: ManagedCoupon): CouponForm => ({
  id: coupon.id,
  code: coupon.code,
  description: coupon.description || "",
  isActive: coupon.isActive,
  discountType: coupon.discountType,
  discountValue: Number(coupon.discountValue || 0),
  enableMaxDiscount: Number(coupon.maxDiscount || 0) > 0,
  maxDiscount: Number(coupon.maxDiscount || 0),
  enableMinPurchase: Number(coupon.minPurchase || 0) > 0,
  minPurchase: Number(coupon.minPurchase || 0),
  enableCourseRestriction: (coupon.appliesToCourseIds || []).length > 0,
  singleCourseOnly: Boolean(coupon.singleCourseOnly),
  selectedCourseIds: coupon.appliesToCourseIds || [],
  enableStudentRestriction: (coupon.allowedStudentEmails || []).length > 0,
  singleStudentOnly: Boolean(coupon.singleStudentOnly),
  selectedStudentEmails: coupon.allowedStudentEmails || [],
  enableDateWindow: Boolean(coupon.validFrom || coupon.validTo),
  validFrom: coupon.validFrom || "",
  validTo: coupon.validTo || "",
  enableDayRestriction: (coupon.allowedDaysOfWeek || []).length > 0,
  allowedDaysOfWeek: coupon.allowedDaysOfWeek || [],
  firstPurchaseOnly: Boolean(coupon.firstPurchaseOnly),
  enableUsageLimits: Boolean(coupon.maxTotalUses || coupon.maxUsesPerUser),
  maxTotalUses: Number(coupon.maxTotalUses || 0),
  maxUsesPerUser: Number(coupon.maxUsesPerUser || 0),
  maxUniqueUsers: Number(coupon.maxUniqueUsers || 0),
  enablePaymentRestriction: (coupon.allowedPaymentMethods || []).length > 0,
  allowedPaymentMethods: coupon.allowedPaymentMethods || [],
});

export default function AdminCoupons() {
  const { coupons, courses, setCoupons, upsertCoupon, deleteCoupon, toggleCouponActive } = usePlatformData();
  const { admin } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(defaultForm());
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditCoupon, setAuditCoupon] = useState<ManagedCoupon | null>(null);
  const { confirm } = useConfirm();
  const [courseSearch, setCourseSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSavingCoupon, setIsSavingCoupon] = useState(false);

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const courseMap = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c.title])), [courses]);
  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((course) =>
      [course.title, course.id].some((value) => value.toLowerCase().includes(q)),
    );
  }, [courses, courseSearch]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      [student.name, student.email, student.id].some((value) => value.toLowerCase().includes(q)),
    );
  }, [students, studentSearch]);

  useEffect(() => {
    if (!open) return;
    const loadStudents = async () => {
      setIsLoadingStudents(true);
      try {
        const data = await adminApi.listStudents();
        setStudents(data.students || []);
      } catch {
        setStudents([]);
      } finally {
        setIsLoadingStudents(false);
      }
    };
    loadStudents();
  }, [open]);

  useEffect(() => {
    let mounted = true;

    const loadPersistedCoupons = async () => {
      try {
        const result = await adminApi.listCoupons();
        const persistedCoupons = Array.isArray(result?.items)
          ? (result.items as ManagedCoupon[])
          : [];

        if (!mounted || !Array.isArray(persistedCoupons)) return;
        setCoupons(persistedCoupons);
      } catch {
        // Keep in-memory coupons if API is unavailable.
      }
    };

    loadPersistedCoupons();

    return () => {
      mounted = false;
    };
  }, [setCoupons]);

  const persistCoupons = async (nextCoupons: ManagedCoupon[]) => {
    await adminApi.saveCoupons(nextCoupons);
  };

  const reset = () => {
    setForm(defaultForm());
    setCourseSearch("");
    setStudentSearch("");
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (coupon: ManagedCoupon) => {
    setForm(toForm(coupon));
    setCourseSearch("");
    setStudentSearch("");
    setOpen(true);
  };

  const toggleCourse = (courseId: string) => {
    setForm((prev) => ({
      ...prev,
      selectedCourseIds: prev.selectedCourseIds.includes(courseId)
        ? prev.selectedCourseIds.filter((id) => id !== courseId)
        : prev.singleCourseOnly
          ? [courseId]
          : [...prev.selectedCourseIds, courseId],
    }));
  };

  const toggleStudent = (email: string) => {
    const normalized = email.trim().toLowerCase();
    setForm((prev) => ({
      ...prev,
      selectedStudentEmails: prev.selectedStudentEmails.includes(normalized)
        ? prev.selectedStudentEmails.filter((id) => id !== normalized)
        : prev.singleStudentOnly
          ? [normalized]
          : [...prev.selectedStudentEmails, normalized],
    }));
  };

  const save = async () => {
    if (!form.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    if (form.discountValue <= 0) {
      toast.error("Discount value must be greater than 0");
      return;
    }

    const existingCoupon = coupons.find((c) => c.id === form.id);
    const generatedBy = admin ? `${admin.name} (${admin.email})` : "Admin";

    const payload: ManagedCoupon = {
      id: form.id,
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      isActive: form.isActive,
      createdAt: existingCoupon?.createdAt,
      createdBy: existingCoupon?.createdBy || generatedBy,
      discountType: form.discountType,
      discountValue: Number(form.discountValue || 0),
      maxDiscount: form.enableMaxDiscount && form.maxDiscount > 0 ? Number(form.maxDiscount) : undefined,
      minPurchase: form.enableMinPurchase && form.minPurchase > 0 ? Number(form.minPurchase) : undefined,
      appliesToCourseIds: form.enableCourseRestriction ? form.selectedCourseIds : [],
      singleCourseOnly: form.enableCourseRestriction ? form.singleCourseOnly : false,
      allowedStudentEmails: form.enableStudentRestriction ? form.selectedStudentEmails : [],
      singleStudentOnly: form.enableStudentRestriction ? form.singleStudentOnly : false,
      validFrom: form.enableDateWindow && form.validFrom ? form.validFrom : undefined,
      validTo: form.enableDateWindow && form.validTo ? form.validTo : undefined,
      allowedDaysOfWeek: form.enableDayRestriction ? form.allowedDaysOfWeek : [],
      firstPurchaseOnly: form.firstPurchaseOnly,
      maxTotalUses: form.enableUsageLimits && form.maxTotalUses > 0 ? Number(form.maxTotalUses) : undefined,
      maxUsesPerUser: form.enableUsageLimits && form.maxUsesPerUser > 0 ? Number(form.maxUsesPerUser) : undefined,
      maxUniqueUsers: form.enableUsageLimits && form.maxUniqueUsers > 0 ? Number(form.maxUniqueUsers) : undefined,
      allowedPaymentMethods: form.enablePaymentRestriction ? form.allowedPaymentMethods : [],
      totalUsed: existingCoupon?.totalUsed || 0,
      usedBy: existingCoupon?.usedBy || {},
      usageHistory: existingCoupon?.usageHistory || [],
    };

    const nextCoupons = existingCoupon
      ? coupons.map((coupon) => (coupon.id === payload.id ? payload : coupon))
      : [...coupons, payload];

    setIsSavingCoupon(true);
    try {
      upsertCoupon(payload);
      await persistCoupons(nextCoupons);
      toast.success("Coupon saved successfully");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save coupon");
    } finally {
      setIsSavingCoupon(false);
    }
  };

  const handleToggleCoupon = async (couponId: string) => {
    const nextCoupons = coupons.map((coupon) =>
      coupon.id === couponId ? { ...coupon, isActive: !coupon.isActive } : coupon,
    );
    toggleCouponActive(couponId);
    try {
      await persistCoupons(nextCoupons);
    } catch (error) {
      toggleCouponActive(couponId);
      toast.error(error instanceof Error ? error.message : "Failed to update coupon status");
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    const isConfirmed = await confirm({ title: "Delete Coupon?", description: "Delete this coupon permanently?" });
    if (!isConfirmed) return;
    const deleted = coupons.find((coupon) => coupon.id === couponId);
    const nextCoupons = coupons.filter((coupon) => coupon.id !== couponId);
    deleteCoupon(couponId);
    try {
      await persistCoupons(nextCoupons);
      toast.success("Coupon deleted");
    } catch (error) {
      if (deleted) upsertCoupon(deleted);
      toast.error(error instanceof Error ? error.message : "Failed to delete coupon");
    }
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      allowedDaysOfWeek: prev.allowedDaysOfWeek.includes(day)
        ? prev.allowedDaysOfWeek.filter((d) => d !== day)
        : [...prev.allowedDaysOfWeek, day],
    }));
  };

  const togglePaymentMethod = (method: string) => {
    setForm((prev) => ({
      ...prev,
      allowedPaymentMethods: prev.allowedPaymentMethods.includes(method)
        ? prev.allowedPaymentMethods.filter((m) => m !== method)
        : [...prev.allowedPaymentMethods, method],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-600 mt-1">Create advanced open-ended coupon rules</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600">
              <Plus className="w-4 h-4" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Coupon Builder</DialogTitle>
              <DialogDescription>
                Enable only the rules you want. Hidden rules stay disabled and are not saved.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto pr-1 py-2">
              <Card className="border-orange-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Basic Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="Code" />
                    <select
                      value={form.discountType}
                      onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as "percent" | "fixed" }))}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="percent">Percent (%)</option>
                      <option value="fixed">Fixed (INR)</option>
                    </select>
                    <Input type="number" value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: Number(e.target.value) || 0 }))} placeholder="Discount value" />
                  </div>
                  <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))} />
                      <span className="text-sm">Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.firstPurchaseOnly} onCheckedChange={(checked) => setForm((p) => ({ ...p, firstPurchaseOnly: checked }))} />
                      <span className="text-sm">First purchase only</span>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setForm((p) => ({ ...p, code: makeCode() }))}>
                      Generate Code
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Maximum Discount Cap</CardTitle>
                    <Switch
                      checked={form.enableMaxDiscount}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({ ...p, enableMaxDiscount: checked, maxDiscount: checked ? p.maxDiscount : 0 }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enableMaxDiscount && (
                  <CardContent className="pt-0">
                    <Input type="number" value={form.maxDiscount} onChange={(e) => setForm((p) => ({ ...p, maxDiscount: Number(e.target.value) || 0 }))} placeholder="Max discount amount" />
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Minimum Purchase Condition</CardTitle>
                    <Switch
                      checked={form.enableMinPurchase}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({ ...p, enableMinPurchase: checked, minPurchase: checked ? p.minPurchase : 0 }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enableMinPurchase && (
                  <CardContent className="pt-0">
                    <Input type="number" value={form.minPurchase} onChange={(e) => setForm((p) => ({ ...p, minPurchase: Number(e.target.value) || 0 }))} placeholder="Minimum order amount" />
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Course-wise Restriction</CardTitle>
                    <Switch
                      checked={form.enableCourseRestriction}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({
                          ...p,
                          enableCourseRestriction: checked,
                          selectedCourseIds: checked ? p.selectedCourseIds : [],
                          singleCourseOnly: checked ? p.singleCourseOnly : false,
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enableCourseRestriction && (
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-orange-100 px-3 py-2">
                      <span className="text-sm">Only one specific course can use this coupon</span>
                      <Switch
                        checked={form.singleCourseOnly}
                        onCheckedChange={(checked) =>
                          setForm((p) => ({
                            ...p,
                            singleCourseOnly: checked,
                            selectedCourseIds: checked ? p.selectedCourseIds.slice(0, 1) : p.selectedCourseIds,
                          }))
                        }
                      />
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} className="pl-9" placeholder="Search course by name or id" />
                    </div>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                      {filteredCourses.map((course) => (
                        <label key={course.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={form.selectedCourseIds.includes(course.id)}
                            onChange={() => toggleCourse(course.id)}
                          />
                          <span className="truncate">{course.title}</span>
                          <span className="text-xs text-gray-500 ml-auto">{course.id}</span>
                        </label>
                      ))}
                      {filteredCourses.length === 0 && <p className="text-xs text-gray-500 p-2">No course found</p>}
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Student-wise Restriction</CardTitle>
                    <Switch
                      checked={form.enableStudentRestriction}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({
                          ...p,
                          enableStudentRestriction: checked,
                          selectedStudentEmails: checked ? p.selectedStudentEmails : [],
                          singleStudentOnly: checked ? p.singleStudentOnly : false,
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enableStudentRestriction && (
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-orange-100 px-3 py-2">
                      <span className="text-sm">Only one specific student can use this coupon</span>
                      <Switch
                        checked={form.singleStudentOnly}
                        onCheckedChange={(checked) =>
                          setForm((p) => ({
                            ...p,
                            singleStudentOnly: checked,
                            selectedStudentEmails: checked ? p.selectedStudentEmails.slice(0, 1) : p.selectedStudentEmails,
                          }))
                        }
                      />
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="pl-9" placeholder="Search student by name or email" />
                    </div>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                      {isLoadingStudents ? (
                        <p className="text-xs text-gray-500 p-2">Loading students...</p>
                      ) : filteredStudents.length > 0 ? (
                        filteredStudents.map((student) => (
                          <label key={student.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={form.selectedStudentEmails.includes(student.email.toLowerCase())}
                              onChange={() => toggleStudent(student.email)}
                            />
                            <span className="truncate">{student.name}</span>
                            <span className="text-xs text-gray-500 ml-auto truncate max-w-40">{student.email}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500 p-2">No student found</p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Date Window</CardTitle>
                    <Switch
                      checked={form.enableDateWindow}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({ ...p, enableDateWindow: checked, validFrom: checked ? p.validFrom : "", validTo: checked ? p.validTo : "" }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enableDateWindow && (
                  <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input type="datetime-local" value={form.validFrom} onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))} />
                    <Input type="datetime-local" value={form.validTo} onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))} />
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Allowed Days of Week</CardTitle>
                    <Switch
                      checked={form.enableDayRestriction}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({ ...p, enableDayRestriction: checked, allowedDaysOfWeek: checked ? p.allowedDaysOfWeek : [] }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enableDayRestriction && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          className={`px-3 py-1.5 text-xs rounded-full border ${form.allowedDaysOfWeek.includes(d.value) ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-300"}`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Usage Limits</CardTitle>
                    <Switch
                      checked={form.enableUsageLimits}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({
                          ...p,
                          enableUsageLimits: checked,
                          maxTotalUses: checked ? p.maxTotalUses : 0,
                          maxUsesPerUser: checked ? p.maxUsesPerUser : 0,
                          maxUniqueUsers: checked ? p.maxUniqueUsers : 0,
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enableUsageLimits && (
                  <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input type="number" value={form.maxTotalUses} onChange={(e) => setForm((p) => ({ ...p, maxTotalUses: Number(e.target.value) || 0 }))} placeholder="Max total uses" />
                    <Input type="number" value={form.maxUsesPerUser} onChange={(e) => setForm((p) => ({ ...p, maxUsesPerUser: Number(e.target.value) || 0 }))} placeholder="Max uses per user" />
                    <Input type="number" value={form.maxUniqueUsers} onChange={(e) => setForm((p) => ({ ...p, maxUniqueUsers: Number(e.target.value) || 0 }))} placeholder="Max unique users" />
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">Payment Method Restriction</CardTitle>
                    <Switch
                      checked={form.enablePaymentRestriction}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({ ...p, enablePaymentRestriction: checked, allowedPaymentMethods: checked ? p.allowedPaymentMethods : [] }))
                      }
                    />
                  </div>
                </CardHeader>
                {form.enablePaymentRestriction && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {paymentMethods.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => togglePaymentMethod(method)}
                          className={`px-3 py-1.5 text-xs rounded-full border ${form.allowedPaymentMethods.includes(method) ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-300"}`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            <div className="pt-3 border-t">
              <Button onClick={() => void save()} disabled={isSavingCoupon} className="w-full bg-gradient-to-r from-orange-500 to-orange-600">
                {isSavingCoupon ? "Saving..." : "Save Coupon"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Coupon Audit</DialogTitle>
            <DialogDescription>
              {auditCoupon?.code || "-"} generation and usage details
            </DialogDescription>
          </DialogHeader>
          {auditCoupon && (
            <div className="space-y-4 overflow-y-auto">
              <Card>
                <CardContent className="pt-4 space-y-1 text-sm text-gray-700">
                  <p><span className="font-semibold text-gray-900">Generated By:</span> {auditCoupon.createdBy || "Admin"}</p>
                  <p><span className="font-semibold text-gray-900">Generated At:</span> {formatDateTime(auditCoupon.createdAt)}</p>
                  <p><span className="font-semibold text-gray-900">Last Updated:</span> {formatDateTime(auditCoupon.updatedAt)}</p>
                  <p><span className="font-semibold text-gray-900">Total Uses:</span> {auditCoupon.totalUsed || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Usage Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {(auditCoupon.usageHistory || []).length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(auditCoupon.usageHistory || []).map((entry, index) => (
                        <div key={`${entry.email}-${entry.usedAt}-${index}`} className="rounded-md border px-3 py-2 text-xs text-gray-700">
                          <p><span className="font-semibold text-gray-900">Student:</span> {entry.email}</p>
                          <p><span className="font-semibold text-gray-900">Used At:</span> {formatDateTime(entry.usedAt)}</p>
                          {entry.orderId ? <p><span className="font-semibold text-gray-900">Order ID:</span> {entry.orderId}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No usage yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Coupon List</CardTitle>
          <CardDescription>{coupons.length} coupons configured</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length > 0 ? (
                  coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="font-semibold">{coupon.code}</div>
                        {coupon.description && <p className="text-xs text-gray-500">{coupon.description}</p>}
                      </TableCell>
                      <TableCell>
                        {coupon.discountType === "percent" ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                        {coupon.maxDiscount ? <p className="text-xs text-gray-500">max ₹{coupon.maxDiscount}</p> : null}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600 space-y-1">
                          {(coupon.appliesToCourseIds || []).length > 0 && (
                            <p>Courses: {(coupon.appliesToCourseIds || []).map((id) => courseMap[id] || id).join(", ")}</p>
                          )}
                          {(coupon.allowedStudentEmails || []).length > 0 && <p>Students: {(coupon.allowedStudentEmails || []).length}</p>}
                          {coupon.minPurchase ? <p>Min: ₹{coupon.minPurchase}</p> : null}
                          <p>Generated: {formatDateTime(coupon.createdAt)}</p>
                          <p>By: {coupon.createdBy || "Admin"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600">
                          <p>Used: {coupon.totalUsed || 0}</p>
                          {coupon.maxTotalUses ? <p>Limit: {coupon.maxTotalUses}</p> : null}
                          {(coupon.usageHistory || []).length > 0 ? (
                            <p>Last use: {formatDateTime(coupon.usageHistory?.[0]?.usedAt)}</p>
                          ) : (
                            <p>Last use: -</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={coupon.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                          {coupon.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => void handleToggleCoupon(coupon.id)}>
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(coupon)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAuditCoupon(coupon);
                              setAuditOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDeleteCoupon(coupon.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">No coupons created yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
