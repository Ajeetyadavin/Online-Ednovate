import { createContext, useContext, useState, ReactNode } from "react";
import type { Course } from "@/data/courses";

interface OrderRecord {
  id: string;
  date: string;
  items: { title: string; price: number }[];
  total: number;
  status: "Completed" | "Processing";
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
  completePurchase: (orderData: { orderId: string; total: number; paymentMethod: string }) => void;
  updateProgress: (courseId: string, progress: number) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Course[]>([]);
  const [purchasedCourses, setPurchasedCourses] = useState<PurchasedCourse[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

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

  const completePurchase = (orderData: { orderId: string; total: number; paymentMethod: string }) => {
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

  return (
    <CartContext.Provider
      value={{
        items, addToCart, removeFromCart, isInCart, cartCount: items.length, clearCart: () => setItems([]),
        purchasedCourses, orders, isPurchased, completePurchase, updateProgress,
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
