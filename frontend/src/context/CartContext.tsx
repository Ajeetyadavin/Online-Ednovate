import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import type { Course } from "@/data/courses";
import { useAuth } from "@/context/AuthContext";
import {
  SESSION_TOKEN_KEY,
  createStudentPurchaseApi,
  type StudentCourseAccessSelf,
} from "@/services/authApi";
import { progressFromViews } from "@/lib/studentAccess";

interface OrderRecord {
  id: string;
  date: string;
  items: {
    id?: number;
    courseId?: string;
    title: string;
    price: number;
    taxPercentage?: number;
    modeLabel?: string;
    bookLabel?: string;
    itemType?: string;
    isEbook?: boolean;
    dispatchStatus?: string;
    trackingId?: string;
  }[];
  subtotal?: number;
  couponDiscount?: number;
  taxAmount?: number;
  total: number;
  status: "Completed" | "Processing";
  paymentMethod?: string;
  studentName?: string;
  email?: string;
  phone?: string;
  dispatchStatus?: string;
  trackingId?: string;
  dispatchNote?: string;
}

type RemoteOrderItem = {
  courseId?: string;
  title?: string;
  itemType?: string;
  purchaseRefId?: string;
};

interface PurchasedCourse extends Course {
  purchasedOn: string;
  progress: number;
  purchaseRefId?: string;
}

interface CartContextType {
  items: Course[];
  addToCart: (course: Course) => void;
  removeFromCart: (courseId: string) => void;
  isInCart: (courseId: string) => boolean;
  cartCount: number;
  clearCart: () => void;
  purchasedCourses: PurchasedCourse[];
  orders: OrderRecord[];
  isPurchased: (courseId: string) => boolean;
  completePurchase: (orderData: {
    orderId: string;
    total: number;
    subtotal?: number;
    couponDiscount?: number;
    taxAmount?: number;
    paymentMethod: string;
    studentName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    linePricing?: Array<{
      courseId: string;
      baseAmount: number;
      taxAmount: number;
      totalAmount: number;
    }>;
  }) => Promise<{ ok: boolean; message: string }>;
  updateProgress: (courseId: string, progress: number) => void;
  updateOrderStatus: (orderId: string, status: OrderRecord["status"]) => void;
}

const CART_STORAGE_KEY = "ednovate_cart_items";
const PURCHASED_STORAGE_KEY = "ednovate_purchased_courses";
const ORDERS_STORAGE_KEY = "ednovate_orders";

const parseStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const shouldIncludeDashboardOrderItem = (item: RemoteOrderItem) => {
  const itemType = String(item.itemType || "course").trim().toLowerCase();
  if (!String(item.courseId || "").trim()) return false;
  return itemType === "course" || itemType === "package";
};

const isStudentSessionFailure = (message: string) => /session|token|authoriz|logged out|expired/i.test(message);

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn, logout, user } = useAuth();
  const previousStudentIdRef = useRef("");
    const getModeLabel = (course: Course): string | undefined => {
      if (!course.deliveryModePricingEnabled) return undefined;
      const modes = Array.isArray(course.deliveryModes) ? course.deliveryModes : [];
      const selectedId = String(course.selectedDeliveryModeId || "").trim();
      if (!selectedId || modes.length === 0) return undefined;
      const selected = modes.find((mode) => mode.id === selectedId);
      return selected?.label;
    };

    const getBookLabel = (course: Course): string | undefined => {
      if (!course.bookAddonEnabled) return undefined;
      const addons = Array.isArray(course.bookAddons) ? course.bookAddons : [];
      const selectedIds = Array.isArray(course.selectedBookAddonIds) ? course.selectedBookAddonIds : [];
      if (selectedIds.length === 0 || addons.length === 0) return undefined;
      const labels = addons.filter((addon) => selectedIds.includes(addon.id)).map((addon) => addon.label);
      return labels.length > 0 ? labels.join(", ") : undefined;
    };

    const isEbookSelection = (course: Course): boolean => {
      const modeLabel = getModeLabel(course) || "";
      const bookLabel = getBookLabel(course) || "";
      return /e\s*-?book/i.test(modeLabel) || /e\s*-?book/i.test(bookLabel);
    };

  const [items, setItems] = useState<Course[]>(() => parseStored<Course[]>(CART_STORAGE_KEY, []));
  const [purchasedCourses, setPurchasedCourses] = useState<PurchasedCourse[]>(() =>
    parseStored<PurchasedCourse[]>(PURCHASED_STORAGE_KEY, [])
  );
  const [orders, setOrders] = useState<OrderRecord[]>(() => parseStored<OrderRecord[]>(ORDERS_STORAGE_KEY, []));

  useEffect(() => {
    const currentStudentId = isLoggedIn ? String(user?.studentId || "") : "";

    if (!currentStudentId) {
      previousStudentIdRef.current = "";
      setPurchasedCourses([]);
      setOrders([]);
      localStorage.removeItem(PURCHASED_STORAGE_KEY);
      localStorage.removeItem(ORDERS_STORAGE_KEY);
      return;
    }

    if (previousStudentIdRef.current && previousStudentIdRef.current !== currentStudentId) {
      setPurchasedCourses([]);
      setOrders([]);
    }

    previousStudentIdRef.current = currentStudentId;
  }, [isLoggedIn, user?.studentId]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const token = localStorage.getItem(SESSION_TOKEN_KEY) || "";
    if (!token) return;

    const loadRemoteDashboard = async () => {
      try {
        const [dashboardResponse, coursesResponse] = await Promise.all([
          fetch("/api/auth/student/dashboard", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/courses"),
        ]);

        if (dashboardResponse.status === 401 || dashboardResponse.status === 403) {
          setPurchasedCourses([]);
          setOrders([]);
          void logout();
          return;
        }

        if (!dashboardResponse.ok || !coursesResponse.ok) {
          return;
        }

        const dashboardPayload = await dashboardResponse.json();
        const coursesPayload = await coursesResponse.json();

        const accessItems: StudentCourseAccessSelf[] = Array.isArray(dashboardPayload?.courseAccess)
          ? dashboardPayload.courseAccess
          : [];
        const activityItems: Array<{ courseId?: string; progressPercent?: number }> = Array.isArray(dashboardPayload?.videoActivity)
          ? dashboardPayload.videoActivity
          : [];
        const courses: Course[] = Array.isArray(coursesPayload?.courses) ? coursesPayload.courses : [];

        const progressByCourse = activityItems.reduce<Record<string, number>>((acc, item) => {
          const courseId = String(item?.courseId || "").trim();
          if (!courseId) return acc;
          const value = Math.max(0, Math.min(100, Number(item?.progressPercent || 0)));
          acc[courseId] = Math.max(acc[courseId] || 0, value);
          return acc;
        }, {});

        const serverOrders = Array.isArray(dashboardPayload?.orders) ? dashboardPayload.orders : [];
        const nextPurchasedFromOrders = serverOrders
          .flatMap((order: { id?: string; date?: string; items?: RemoteOrderItem[] }) => {
            const orderDate = String(order?.date || "").trim();
            const orderId = String(order?.id || "").trim();
            const items = Array.isArray(order?.items) ? order.items : [];
            return items.map((item, index) => ({ item, orderDate, orderId, index }));
          })
          .filter(({ item }) => shouldIncludeDashboardOrderItem(item))
          .map(({ item, orderDate, orderId, index }) => {
            const courseId = String(item.courseId || "").trim();
            if (!courseId) return null;

            const base = courses.find((course) => course.id === courseId);
            if (!base) return null;

            const purchaseRefId = String(item.purchaseRefId || `${orderId || "order"}:${index}:${courseId}`).trim();
            return {
              ...base,
              purchasedOn: orderDate || new Date().toLocaleDateString("en-IN"),
              progress: progressByCourse[courseId] || 0,
              purchaseRefId,
            } satisfies PurchasedCourse;
          })
          .filter(Boolean) as PurchasedCourse[];

        const nextPurchased = nextPurchasedFromOrders.length > 0
          ? nextPurchasedFromOrders
          : accessItems
              .filter((item) => item?.courseId)
              .map((item, index) => {
                const base = courses.find((course) => course.id === item.courseId);
                if (!base) return null;
                return {
                  ...base,
                  purchasedOn: item.purchaseDate || new Date(item.createdAt || Date.now()).toLocaleDateString("en-IN"),
                  progress: Math.max(progressFromViews(item), progressByCourse[item.courseId] || 0),
                  purchaseRefId: `access:${item.id || index}:${item.courseId}`,
                } satisfies PurchasedCourse;
              })
              .filter(Boolean) as PurchasedCourse[];

        setPurchasedCourses(nextPurchased);

        const nextOrders: OrderRecord[] = serverOrders.map((order: any) => ({
          id: String(order.id || `ORD-${Date.now()}`),
          date: String(order.date || ""),
          items: Array.isArray(order.items)
            ? order.items.map((item: any) => ({
                id: Number(item.id || 0) || undefined,
                courseId: String(item.courseId || "") || undefined,
                title: String(item.title || "Course"),
                price: Number(item.price || 0),
                itemType: String(item.itemType || "") || undefined,
                modeLabel: String(item.modeLabel || "") || undefined,
                bookLabel: String(item.bookLabel || "") || undefined,
                isEbook: item.isEbook === true,
                dispatchStatus: String(item.dispatchStatus || "") || undefined,
                trackingId: String(item.trackingId || "") || undefined,
              }))
            : [],
              subtotal: Number(order.subtotal || 0) || undefined,
              couponDiscount: Number(order.couponDiscount || 0) || undefined,
              taxAmount: Number(order.taxAmount || 0) || undefined,
          total: Number(order.total || 0),
          status: String(order.status || "").toLowerCase() === "processing" ? "Processing" : "Completed",
          paymentMethod: String(order.paymentMethod || ""),
          dispatchStatus: String(order.dispatchStatus || ""),
          trackingId: String(order.trackingId || ""),
          dispatchNote: String(order.dispatchNote || ""),
        }));
        setOrders(nextOrders);
      } catch {
        // Keep local fallback state when remote sync fails.
      }
    };

    void loadRemoteDashboard();
  }, [isLoggedIn, logout]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(PURCHASED_STORAGE_KEY, JSON.stringify(purchasedCourses));
  }, [purchasedCourses]);

  useEffect(() => {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  const addToCart = (course: Course) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === course.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = course;
        return next;
      }
      return [...prev, course];
    });
  };

  const removeFromCart = (courseId: string) => {
    setItems((prev) => prev.filter((c) => c.id !== courseId));
  };

  const isInCart = (courseId: string) => items.some((c) => c.id === courseId);
  const isPurchased = (courseId: string) => purchasedCourses.some((c) => c.id === courseId);

  const completePurchase = async (orderData: {
    orderId: string;
    total: number;
    subtotal?: number;
    couponDiscount?: number;
    taxAmount?: number;
    paymentMethod: string;
    studentName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    linePricing?: Array<{
      courseId: string;
      baseAmount: number;
      taxAmount: number;
      totalAmount: number;
    }>;
  }) => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY) || "";
    if (!token) {
      return { ok: false, message: "Your session has expired. Please log in again and retry." };
    }

    const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const purchaseDate = new Date().toISOString().slice(0, 10);
    const currentCart = [...items];
    let courseCatalogById = new Map<string, Course>();

    try {
      const coursesResponse = await fetch("/api/courses");
      if (coursesResponse.ok) {
        const coursesPayload = await coursesResponse.json();
        const coursesList: Course[] = Array.isArray(coursesPayload?.courses) ? coursesPayload.courses : [];
        courseCatalogById = new Map(coursesList.map((course) => [course.id, course]));
      }
    } catch {
      // Best-effort lookup only.
    }

    const lineAmountByCourseId = new Map<string, { baseAmount: number; taxAmount: number; amount: number }>();
    const providedLinePricing = Array.isArray(orderData.linePricing) ? orderData.linePricing : [];
    providedLinePricing.forEach((line) => {
      const key = String(line.courseId || "").trim();
      if (!key) return;
      lineAmountByCourseId.set(key, {
        baseAmount: Math.max(0, Number(line.baseAmount || 0)),
        taxAmount: Math.max(0, Number(line.taxAmount || 0)),
        amount: Math.max(0, Number(line.totalAmount || 0)),
      });
    });

    currentCart.forEach((item) => {
      if (lineAmountByCourseId.has(item.id)) return;
      const itemPrice = Math.max(0, Number(item.price || 0));
      const totalCartPrice = Math.max(1, currentCart.reduce((sum, cartItem) => sum + Math.max(0, Number(cartItem.price || 0)), 0));
      const discountAllocation = Math.round((Math.max(0, Number(orderData.couponDiscount || 0)) * itemPrice) / totalCartPrice);
      const baseAmount = Math.max(0, itemPrice - discountAllocation);
      const taxRate = Math.max(0, Number(item.taxPercentage || 0));
      const taxAmount = Math.max(0, Math.round((baseAmount * taxRate) / 100));
      lineAmountByCourseId.set(item.id, {
        baseAmount,
        taxAmount,
        amount: baseAmount + taxAmount,
      });
    });

    const payloadItems = currentCart.flatMap((item) => {
      const lineAmounts = lineAmountByCourseId.get(item.id) || {
        baseAmount: Math.max(0, Number(item.price || 0)),
        taxAmount: 0,
        amount: Math.max(0, Number(item.price || 0)),
      };
      const rawAttemptEndDate = String(item.selectedAttemptEndDate || "").trim();
      const parsedAttemptEndDate = rawAttemptEndDate ? new Date(rawAttemptEndDate) : null;
      const hasValidAttemptEndDate = Boolean(parsedAttemptEndDate && Number.isFinite(parsedAttemptEndDate.getTime()));
      const base = {
        courseId: item.id,
        courseTitle: item.title,
        durationDays: Math.max(1, Number(item.selectedValidityDays || 180)),
        expiresAt: hasValidAttemptEndDate ? parsedAttemptEndDate!.toISOString() : undefined,
        totalViews: Math.max(1, Number(item.selectedViews || 2)),
        isUnlimitedViews: item.unlimitedViewsEnabled === true,
        usedViews: 0,
        isEnabled: true,
        baseAmount: lineAmounts.baseAmount,
        taxAmount: lineAmounts.taxAmount,
        amount: lineAmounts.amount,
        modeLabel: getModeLabel(item) || "",
        bookLabel: getBookLabel(item) || "",
        itemType: isEbookSelection(item) ? "ebook" : "course",
        isEbook: isEbookSelection(item),
        grantAccess: true,
        createOrderLine: true,
      };
      if (item.isCombo && Array.isArray(item.packageCourseIds) && item.packageCourseIds.length > 0) {
        const packageOrderLine = {
          ...base,
          itemType: "package",
          isEbook: false,
          grantAccess: false,
          createOrderLine: true,
          packageCourseIds: item.packageCourseIds,
        };

        const childAccessLines = item.packageCourseIds.map((courseId) => ({
          ...base,
          courseId,
          courseTitle: courseCatalogById.get(courseId)?.title || courseId,
          itemType: "course",
          baseAmount: 0,
          taxAmount: 0,
          amount: 0,
          grantAccess: true,
          createOrderLine: false,
          parentPackageId: item.id,
          parentPackageTitle: item.title,
          packageCourseIds: item.packageCourseIds,
        }));

        return [packageOrderLine, ...childAccessLines];
      }

      return [base];
    });

    const remote = await createStudentPurchaseApi({
      orderId: orderData.orderId,
      paymentMethod: orderData.paymentMethod,
      customerName: orderData.studentName,
      customerEmail: orderData.email,
      customerPhone: orderData.phone,
      shippingAddressLine1: orderData.addressLine1,
      shippingAddressLine2: orderData.addressLine2,
      shippingCity: orderData.city,
      shippingState: orderData.state,
      shippingCountry: orderData.country,
      shippingPincode: orderData.pincode,
      subtotal: Number(orderData.subtotal || 0),
      couponDiscount: Number(orderData.couponDiscount || 0),
      taxAmount: Number(orderData.taxAmount || 0),
      total: Number(orderData.total || 0),
      items: payloadItems,
      purchaseDate,
    });

    if (!remote.ok) {
      if (isStudentSessionFailure(remote.message || "")) {
        setPurchasedCourses([]);
        setOrders([]);
        void logout();
      }
      return { ok: false, message: remote.message || "Failed to save your purchase. Please retry." };
    }

    // Add to purchased courses (keep duplicates), expanding bundles
    setPurchasedCourses((prev) => {
      const allItems: PurchasedCourse[] = [];

      for (const item of currentCart) {
        const purchaseRefPrefix = `${orderData.orderId || `local-${Date.now()}`}:${item.id}`;
        // Add the package/course itself for normal courses only.
        if (!item.isCombo) {
          allItems.push({
            ...item,
            purchasedOn: now,
            progress: 0,
            purchaseRefId: `${purchaseRefPrefix}:self:${prev.length + allItems.length}`,
          });
        }
        // If this is a combo package, also add each bundled course with same settings
        if (item.isCombo && Array.isArray(item.packageCourseIds)) {
          const uniqueBundledIds = Array.from(new Set(item.packageCourseIds.map((id) => String(id || "").trim()).filter(Boolean)));
          for (const bundledId of uniqueBundledIds) {
            const catalogCourse = courseCatalogById.get(bundledId);
            // Create a minimal stub inheriting package validity/views settings
            const stub: PurchasedCourse = {
              ...(catalogCourse || item),
              id: bundledId,
              isCombo: false,
              packageCourseIds: [],
              selectedViews: item.selectedViews,
              selectedValidityDays: item.selectedValidityDays,
              unlimitedViewsEnabled: item.unlimitedViewsEnabled,
              purchasedOn: now,
              progress: 0,
              purchaseRefId: `${purchaseRefPrefix}:bundle:${bundledId}:${prev.length + allItems.length}`,
            } as PurchasedCourse;
            allItems.push(stub);
          }
        }
      }
      return [...prev, ...allItems];
    });

    // Add order
    setOrders((prev) => [
      {
        id: orderData.orderId,
        date: now,
        items: currentCart.map((i) => ({
          title: i.title,
          price: i.price,
          taxPercentage: Number(i.taxPercentage || 0),
          modeLabel: getModeLabel(i),
          bookLabel: getBookLabel(i),
        })),
        subtotal: Number(orderData.subtotal || 0) || undefined,
        couponDiscount: Number(orderData.couponDiscount || 0) || undefined,
        taxAmount: Number(orderData.taxAmount || 0) || undefined,
        total: orderData.total,
        status: "Completed",
        paymentMethod: orderData.paymentMethod,
        studentName: orderData.studentName || "Student",
        email: orderData.email || "",
        phone: orderData.phone || "",
      },
      ...prev,
    ]);

    // Clear cart
    setItems([]);
    return { ok: true, message: "Purchase saved successfully." };
  };

  const updateProgress = (courseId: string, progress: number) => {
    setPurchasedCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, progress } : c))
    );
  };

  const updateOrderStatus = (orderId: string, status: OrderRecord["status"]) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status } : order)),
    );
  };

  return (
    <CartContext.Provider
      value={{
        items, addToCart, removeFromCart, isInCart, cartCount: items.length, clearCart: () => setItems([]),
        purchasedCourses, orders, isPurchased, completePurchase, updateProgress, updateOrderStatus,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
