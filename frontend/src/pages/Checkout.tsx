import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, CreditCard, Smartphone, Building2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { usePlatformData, type ManagedCoupon } from "@/context/PlatformDataContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import LoginModal from "@/components/LoginModal";
import { toast } from "@/hooks/use-toast";
import type { ManagedCourse, ManagedTestPaper } from "@/context/PlatformDataContext";

type CartItem = ManagedCourse | ManagedTestPaper;

const Checkout = () => {
  const { items, cartCount, orders, completePurchase } = useCart();
  const { isLoggedIn, user } = useAuth();
  const { coupons, markCouponUsed } = usePlatformData();
  const { settings: siteSettings } = useSiteSettings();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<ManagedCoupon | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [fullName, setFullName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.mobile || "");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("India");
  const [pincode, setPincode] = useState("");

  const getModeLabel = (item: CartItem): string | undefined => {
    if (!("deliveryModePricingEnabled" in item) || !item.deliveryModePricingEnabled) return undefined;
    const managed = item as ManagedCourse;
    const modes = Array.isArray(managed.deliveryModes) ? managed.deliveryModes : [];
    const selectedIds = Array.isArray(item.selectedDeliveryModeIds)
      ? item.selectedDeliveryModeIds
      : String(item.selectedDeliveryModeId || "").trim()
        ? [String(item.selectedDeliveryModeId || "").trim()]
        : [];
    if (selectedIds.length === 0 || modes.length === 0) return undefined;
    const labels = modes.filter((mode) => selectedIds.includes(mode.id)).map((mode) => mode.label);
    return labels.length > 0 ? labels.join(", ") : undefined;
  };

  const getBookLabel = (item: CartItem): string | undefined => {
    if (!("bookAddonEnabled" in item) || !item.bookAddonEnabled) return undefined;
    const managed = item as ManagedCourse;
    const addons = Array.isArray(managed.bookAddons) ? managed.bookAddons : [];
    const selectedIds = Array.isArray(item.selectedBookAddonIds) ? item.selectedBookAddonIds : [];
    if (selectedIds.length === 0 || addons.length === 0) return undefined;
    const labels = addons.filter((addon) => selectedIds.includes(addon.id)).map((addon) => addon.label);
    return labels.length > 0 ? labels.join(", ") : undefined;
  };

  useEffect(() => {
    if (!user) return;
    setFullName((prev) => prev || user.name || "");
    setEmail((prev) => prev || user.email || "");
    setPhone((prev) => prev || user.mobile || "");
    setAddressLine1((prev) => prev || user.address || "");
    setCity((prev) => prev || user.city || "");
    setState((prev) => prev || user.state || "");
    setCountry((prev) => prev || user.country || "India");
    setPincode((prev) => prev || user.pin || "");
  }, [user]);

  const paymentGateways = siteSettings.paymentGateways;
  const enabledMethods = useMemo(() => {
    const methods: Array<{ id: "cod" | "easebuzz" | "payu" | "hdfc"; label: string; hint: string; icon: typeof Building2 }> = [];
    if (paymentGateways.cod.enabled) {
      methods.push({
        id: "cod",
        label: "Cash on Delivery",
        hint: "Pay when order is delivered",
        icon: Building2,
      });
    }
    if (paymentGateways.easebuzz.enabled) {
      methods.push({
        id: "easebuzz",
        label: "Easebuzz",
        hint: "Cards, UPI, net banking via Easebuzz",
        icon: CreditCard,
      });
    }
    if (paymentGateways.payu.enabled) {
      methods.push({
        id: "payu",
        label: "PayU",
        hint: "Cards, UPI, net banking via PayU",
        icon: Smartphone,
      });
    }
    if (paymentGateways.hdfc.enabled) {
      methods.push({
        id: "hdfc",
        label: "HDFC Gateway",
        hint: "Secure online payment via HDFC",
        icon: CreditCard,
      });
    }
    return methods;
  }, [paymentGateways.cod.enabled, paymentGateways.easebuzz.enabled, paymentGateways.hdfc.enabled, paymentGateways.payu.enabled]);

  useEffect(() => {
    if (enabledMethods.length === 0) return;
    if (!enabledMethods.some((item) => item.id === paymentMethod)) {
      setPaymentMethod(enabledMethods[0].id);
    }
  }, [enabledMethods, paymentMethod]);

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const totalOriginal = items.reduce((sum, item) => sum + (item.originalPrice || item.price), 0);
  const totalSavings = totalOriginal - totalPrice;
  const getCouponDiscount = (candidate: ManagedCoupon): number => {
    const eligibleAmount =
      Array.isArray(candidate.appliesToCourseIds) && candidate.appliesToCourseIds.length > 0
        ? items
            .filter((item) => candidate.appliesToCourseIds?.includes(item.id))
            .reduce((sum, item) => sum + item.price, 0)
        : totalPrice;
    const rawDiscount =
      candidate.discountType === "percent"
        ? (eligibleAmount * candidate.discountValue) / 100
        : candidate.discountValue;
    const cappedDiscount = candidate.maxDiscount
      ? Math.min(rawDiscount, candidate.maxDiscount)
      : rawDiscount;
    return Math.max(0, Math.round(cappedDiscount));
  };

  const couponDiscount = Math.max(0, Math.min(totalPrice, appliedCoupon ? getCouponDiscount(appliedCoupon) : 0));
  const taxTotal = useMemo(() => {
    if (items.length === 0) return 0;

    const eligibleIds = new Set<string>();
    if (appliedCoupon) {
      if (Array.isArray(appliedCoupon.appliesToCourseIds) && appliedCoupon.appliesToCourseIds.length > 0) {
        appliedCoupon.appliesToCourseIds.forEach((id) => eligibleIds.add(String(id)));
      } else {
        items.forEach((item) => eligibleIds.add(item.id));
      }
    }

    const eligibleItems = items.filter((item) => eligibleIds.has(item.id));
    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.price, 0);
    const allocatedCouponByItem = new Map<string, number>();
    let remainingCoupon = couponDiscount;

    eligibleItems.forEach((item, index) => {
      const allocated =
        index === eligibleItems.length - 1
          ? remainingCoupon
          : Math.min(
              remainingCoupon,
              Math.round((couponDiscount * item.price) / Math.max(1, eligibleSubtotal)),
            );
      allocatedCouponByItem.set(item.id, Math.max(0, allocated));
      remainingCoupon = Math.max(0, remainingCoupon - allocated);
    });

    return items.reduce((sum, item) => {
      const discountAllocation = allocatedCouponByItem.get(item.id) || 0;
      const taxableAmount = Math.max(0, item.price - discountAllocation);
      const taxRate = "taxPercentage" in item ? Math.max(0, Number(item.taxPercentage || 0)) : 0;
      return sum + Math.round((taxableAmount * taxRate) / 100);
    }, 0);
  }, [items, appliedCoupon, couponDiscount]);

  const linePricing = useMemo(() => {
    if (items.length === 0) return [] as Array<{ courseId: string; baseAmount: number; taxAmount: number; totalAmount: number }>;

    const eligibleIds = new Set<string>();
    if (appliedCoupon) {
      if (Array.isArray(appliedCoupon.appliesToCourseIds) && appliedCoupon.appliesToCourseIds.length > 0) {
        appliedCoupon.appliesToCourseIds.forEach((id) => eligibleIds.add(String(id)));
      } else {
        items.forEach((item) => eligibleIds.add(item.id));
      }
    }

    const eligibleItems = items.filter((item) => eligibleIds.has(item.id));
    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.price, 0);
    const allocatedCouponByItem = new Map<string, number>();
    let remainingCoupon = couponDiscount;

    eligibleItems.forEach((item, index) => {
      const allocated =
        index === eligibleItems.length - 1
          ? remainingCoupon
          : Math.min(
              remainingCoupon,
              Math.round((couponDiscount * item.price) / Math.max(1, eligibleSubtotal)),
            );
      allocatedCouponByItem.set(item.id, Math.max(0, allocated));
      remainingCoupon = Math.max(0, remainingCoupon - allocated);
    });

    return items.map((item) => {
      const discountAllocation = allocatedCouponByItem.get(item.id) || 0;
      const baseAmount = Math.max(0, item.price - discountAllocation);
      const taxRate = "taxPercentage" in item ? Math.max(0, Number(item.taxPercentage || 0)) : 0;
      const lineTax = Math.round((baseAmount * taxRate) / 100);
      return {
        courseId: item.id,
        baseAmount,
        taxAmount: lineTax,
        totalAmount: baseAmount + lineTax,
      };
    });
  }, [items, appliedCoupon, couponDiscount]);

  const validateCoupon = (couponCode: string): { valid: boolean; message: string; coupon?: ManagedCoupon; discount?: number } => {
    const code = couponCode.trim().toUpperCase();
    const candidate = coupons.find((c) => c.code.toUpperCase() === code);

    if (!candidate) return { valid: false, message: "Coupon code not found" };
    if (!candidate.isActive) return { valid: false, message: "Coupon is inactive" };

    const now = new Date();
    if (candidate.validFrom && now < new Date(candidate.validFrom)) {
      return { valid: false, message: "Coupon is not live yet" };
    }
    if (candidate.validTo && now > new Date(candidate.validTo)) {
      return { valid: false, message: "Coupon has expired" };
    }

    if (Array.isArray(candidate.allowedDaysOfWeek) && candidate.allowedDaysOfWeek.length > 0) {
      if (!candidate.allowedDaysOfWeek.includes(now.getDay())) {
        return { valid: false, message: "Coupon is not valid today" };
      }
    }

    if (candidate.minPurchase && totalPrice < candidate.minPurchase) {
      return {
        valid: false,
        message: `Minimum purchase should be Rs. ${candidate.minPurchase.toLocaleString()}`,
      };
    }

    if (Array.isArray(candidate.appliesToCourseIds) && candidate.appliesToCourseIds.length > 0) {
      const hasEligible = items.some((item) => candidate.appliesToCourseIds?.includes(item.id));
      if (!hasEligible) {
        return { valid: false, message: "Coupon does not apply to selected courses" };
      }

      if (candidate.singleCourseOnly && candidate.appliesToCourseIds.length !== 1) {
        return { valid: false, message: "Coupon course rule is misconfigured" };
      }

      if (candidate.singleCourseOnly) {
        const onlyCourseId = candidate.appliesToCourseIds[0];
        if (!onlyCourseId || !items.some((item) => item.id === onlyCourseId)) {
          return { valid: false, message: "Coupon is valid for only one specific course" };
        }
      }
    }

    const currentEmail = email.trim().toLowerCase();
    if (Array.isArray(candidate.allowedStudentEmails) && candidate.allowedStudentEmails.length > 0) {
      if (!currentEmail || !candidate.allowedStudentEmails.map((v) => v.toLowerCase()).includes(currentEmail)) {
        return { valid: false, message: "Coupon is not valid for this student" };
      }

      if (candidate.singleStudentOnly && candidate.allowedStudentEmails.length !== 1) {
        return { valid: false, message: "Coupon student rule is misconfigured" };
      }
    }

    if (candidate.firstPurchaseOnly) {
      const hasPriorOrders = orders.some((order) => order.email?.trim().toLowerCase() === currentEmail);
      if (hasPriorOrders) {
        return { valid: false, message: "Coupon is valid only on first purchase" };
      }
    }

    if (candidate.maxTotalUses && (candidate.totalUsed || 0) >= candidate.maxTotalUses) {
      return { valid: false, message: "Coupon usage limit reached" };
    }

    if (candidate.maxUsesPerUser && currentEmail) {
      const usedByUser = candidate.usedBy?.[currentEmail] || 0;
      if (usedByUser >= candidate.maxUsesPerUser) {
        return { valid: false, message: "Per-user coupon limit reached" };
      }
    }

    if (candidate.maxUniqueUsers && currentEmail) {
      const usedBy = candidate.usedBy || {};
      const existingUsers = Object.keys(usedBy).filter((key) => (usedBy[key] || 0) > 0);
      const alreadyUsedByCurrent = (usedBy[currentEmail] || 0) > 0;
      if (!alreadyUsedByCurrent && existingUsers.length >= candidate.maxUniqueUsers) {
        return { valid: false, message: "Coupon unique-user limit reached" };
      }
    }

    if (Array.isArray(candidate.allowedPaymentMethods) && candidate.allowedPaymentMethods.length > 0) {
      if (!candidate.allowedPaymentMethods.includes(paymentMethod)) {
        return { valid: false, message: "Coupon is not valid for this payment method" };
      }
    }

    const discount = getCouponDiscount(candidate);
    if (discount <= 0) {
      return { valid: false, message: "Coupon does not produce a discount on this cart" };
    }

    return { valid: true, message: "Coupon applied", coupon: candidate, discount };
  };

  const finalTotal = totalPrice - couponDiscount + taxTotal;

  const requiresShippingAddress = useMemo(() => {
    return items.some((item) => {
      if ("paperCode" in item) return false;
      const managed = item as ManagedCourse;
      const mode = String(getModeLabel(managed) || "").toLowerCase();
      const books = String(getBookLabel(managed) || "").toLowerCase();
      const hasPenDrive = /pen\s*-?drive/.test(mode);
      const hasPhysicalBook = /physical|hard\s*copy|printed|book/.test(books) && !/ebook|e\s*-?notes|enotes/.test(books);
      return hasPenDrive || hasPhysicalBook;
    });
  }, [items]);

  const handleApplyCoupon = () => {
    const result = validateCoupon(coupon);
    if (!result.valid || !result.coupon || !result.discount) {
      setAppliedCoupon(null);
      toast({ title: "Invalid Coupon", description: result.message });
      return;
    }

    setAppliedCoupon(result.coupon);
    toast({ title: "Coupon Applied", description: `Rs. ${result.discount.toLocaleString()} discount added` });
  };

  const handlePlaceOrder = async () => {
    if (enabledMethods.length === 0) {
      toast({
        title: "Payment unavailable",
        description: "No payment gateway is enabled. Please contact support.",
      });
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      toast({ title: "Missing Details", description: "Please enter your full name and email." });
      return;
    }

    if (requiresShippingAddress) {
      if (!phone.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
        toast({
          title: "Address Required",
          description: "For book/pendrive dispatch, please fill phone, address, city, state and pincode.",
        });
        return;
      }
    }

    if (appliedCoupon) {
      const recheck = validateCoupon(appliedCoupon.code);
      if (!recheck.valid || !recheck.coupon) {
        setAppliedCoupon(null);
        toast({ title: "Coupon Removed", description: recheck.message });
        return;
      }
    }

    const orderId = "EDN" + Math.random().toString(36).substring(2, 10).toUpperCase();
    const orderItems = items.map((item) => ({
      title: item.title,
      price: item.price,
      taxPercentage: "taxPercentage" in item ? Number(item.taxPercentage || 0) : 0,
      modeLabel: getModeLabel(item),
      bookLabel: getBookLabel(item),
    }));
    const purchaseResult = await completePurchase({
      orderId,
      total: finalTotal,
      subtotal: totalPrice,
      couponDiscount,
      taxAmount: taxTotal,
      linePricing,
      paymentMethod,
      studentName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      pincode: pincode.trim(),
    });

    if (!purchaseResult.ok) {
      toast({
        title: "Purchase Failed",
        description: purchaseResult.message || "We could not save your course purchase. Please retry.",
      });
      return;
    }

    if (appliedCoupon) {
      markCouponUsed(appliedCoupon.code, email.trim().toLowerCase(), orderId);
    }

    navigate("/order-confirmation", {
      state: {
        items: orderItems,
        subtotal: totalPrice,
        couponDiscount,
        taxAmount: taxTotal,
        total: finalTotal,
        orderId,
        email: email.trim(),
        name: fullName.trim(),
        paymentMethod,
      },
    });
  };

  if (cartCount === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground text-sm">Your cart is empty</p>
        <Link to="/">
          <Button variant="outline" size="sm">Go to Home</Button>
        </Link>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Login Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Please login or create an account to continue checkout.
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
          <Button variant="ghost" className="mt-3" onClick={() => navigate("/packages")}>
            Back to Courses
          </Button>
          <LoginModal
            open={loginOpen}
            onOpenChange={setLoginOpen}
            isSignup={signupMode}
            redirectPath="/checkout"
            onToggleMode={() => setSignupMode((prev) => !prev)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <div className="bg-background border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Checkout ({cartCount} items)</h1>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
            Secure Checkout
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-5">
            {/* Contact */}
            <div className="bg-background rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-bold text-foreground">Contact Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    placeholder="Enter your name"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-background rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">Shipping Address</h2>
                {requiresShippingAddress && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Required for dispatch</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Address Line 1</Label>
                  <Input
                    placeholder="House no, street, area"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Address Line 2 (Optional)</Label>
                  <Input
                    placeholder="Landmark, apartment, etc"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input
                    placeholder="City"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">State</Label>
                  <Input
                    placeholder="State"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <Input
                    placeholder="Country"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pincode</Label>
                  <Input
                    placeholder="Pincode"
                    className="h-9 text-sm bg-secondary/50 border-border"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-background rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-bold text-foreground">Payment Method</h2>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                {enabledMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <label
                      key={method.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === method.id ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/50"}`}
                    >
                      <RadioGroupItem value={method.id} />
                      <Icon className="w-4 h-4 text-accent" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{method.label}</p>
                        <p className="text-[10px] text-muted-foreground">{method.hint}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>

              {enabledMethods.length === 0 && (
                <p className="text-xs text-red-600">No payment gateway is enabled by admin.</p>
              )}

              {paymentMethod === "cod" && (
                <div className="space-y-1.5 pt-2 animate-fade-in">
                  <p className="text-xs text-muted-foreground">Cash on Delivery selected. Payment will be collected at dispatch/delivery.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-background rounded-xl border border-border p-4 space-y-3 sticky top-20">
              <h2 className="text-sm font-bold text-foreground">Order Summary</h2>

              <div className="space-y-2.5 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-foreground line-clamp-2">{item.title}</p>
                      {getModeLabel(item) && (
                        <p className="text-[10px] text-accent font-medium mt-0.5">Mode: {getModeLabel(item)}</p>
                      )}
                      {getBookLabel(item) && (
                        <p className="text-[10px] text-indigo-600 font-medium mt-0.5">Books: {getBookLabel(item)}</p>
                      )}
                      {"paperCode" in item && (
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Test Series • {(item as ManagedTestPaper).paperCode}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">₹{item.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Coupon */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    placeholder="Coupon code"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    className="h-8 text-xs pl-7 bg-secondary/50 border-border"
                    disabled={Boolean(appliedCoupon)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3"
                  onClick={handleApplyCoupon}
                  disabled={Boolean(appliedCoupon) || !coupon.trim()}
                >
                  {appliedCoupon ? "Applied ✓" : "Apply"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Enter admin-created coupon code</p>

              <Separator />

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{totalOriginal.toLocaleString()}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Discount</span>
                    <span>-₹{totalSavings.toLocaleString()}</span>
                  </div>
                )}
                {appliedCoupon && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>-₹{couponDiscount.toLocaleString()}</span>
                  </div>
                )}
                {taxTotal > 0 && (
                  <div className="flex justify-between text-foreground/80 font-medium">
                    <span>Tax</span>
                    <span>+₹{taxTotal.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm font-bold text-foreground pt-1">
                  <span>Total Payable</span>
                  <span>₹{finalTotal.toLocaleString()}</span>
                </div>
              </div>

              <Button
                className="w-full h-10 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-lg shadow-sm text-sm mt-2"
                onClick={handlePlaceOrder}
                disabled={enabledMethods.length === 0}
              >
                {paymentMethod === "cod" ? `Place Order ₹${finalTotal.toLocaleString()}` : `Pay ₹${finalTotal.toLocaleString()}`}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-green-600" />
                100% Secure Payment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
