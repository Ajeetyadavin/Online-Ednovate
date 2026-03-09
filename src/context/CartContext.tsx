import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Course } from "@/data/courses";

interface OrderRecord {
  id: string;
  date: string;
  items: { title: string; price: number }[];
  total: number;
  status: "Completed" | "Processing";
  paymentMethod?: string;
  studentName?: string;
  email?: string;
  phone?: string;
}

interface PurchasedCourse extends Course {
  purchasedOn: string;
  progress: number;
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
    paymentMethod: string;
    studentName?: string;
    email?: string;
    phone?: string;
  }) => void;
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

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Course[]>(() => parseStored<Course[]>(CART_STORAGE_KEY, []));
  const [purchasedCourses, setPurchasedCourses] = useState<PurchasedCourse[]>(() =>
    parseStored<PurchasedCourse[]>(PURCHASED_STORAGE_KEY, [])
  );
  const [orders, setOrders] = useState<OrderRecord[]>(() => parseStored<OrderRecord[]>(ORDERS_STORAGE_KEY, []));

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
      if (prev.find((c) => c.id === course.id)) return prev;
      return [...prev, course];
    });
  };

  const removeFromCart = (courseId: string) => {
    setItems((prev) => prev.filter((c) => c.id !== courseId));
  };

  const isInCart = (courseId: string) => items.some((c) => c.id === courseId);
  const isPurchased = (courseId: string) => purchasedCourses.some((c) => c.id === courseId);

  const completePurchase = (orderData: {
    orderId: string;
    total: number;
    paymentMethod: string;
    studentName?: string;
    email?: string;
    phone?: string;
  }) => {
    const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    // Add to purchased courses (skip duplicates)
    setPurchasedCourses((prev) => {
      const newCourses = items
        .filter((item) => !prev.some((p) => p.id === item.id))
        .map((item) => ({ ...item, purchasedOn: now, progress: 0 }));
      return [...prev, ...newCourses];
    });

    // Add order
    setOrders((prev) => [
      {
        id: orderData.orderId,
        date: now,
        items: items.map((i) => ({ title: i.title, price: i.price })),
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
