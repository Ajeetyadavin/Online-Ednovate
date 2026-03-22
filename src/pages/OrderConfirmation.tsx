import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, Download, Mail, ArrowRight, PartyPopper, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import confetti from "canvas-confetti";

interface OrderItem {
  title: string;
  price: number;
  taxPercentage?: number;
  modeLabel?: string;
  bookLabel?: string;
}

const OrderConfirmation = () => {
  const location = useLocation();
  const orderData = location.state as {
    items: OrderItem[];
    subtotal?: number;
    couponDiscount?: number;
    taxAmount?: number;
    total: number;
    orderId: string;
    email: string;
    name: string;
    paymentMethod: string;
  } | null;

  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Celebration confetti
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#E53935", "#1A3A6E", "#FFD700", "#4CAF50"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#E53935", "#1A3A6E", "#FFD700", "#4CAF50"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    setTimeout(() => setShowContent(true), 300);
  }, []);

  // Fallback if navigated directly
  const items = orderData?.items || [];
  const subtotal = Number(orderData?.subtotal || items.reduce((sum, item) => sum + Number(item.price || 0), 0));
  const couponDiscount = Number(orderData?.couponDiscount || 0);
  const taxAmount = Number(orderData?.taxAmount || 0);
  const total = orderData?.total || 0;
  const orderId = orderData?.orderId || "EDN" + Math.random().toString(36).substring(2, 10).toUpperCase();
  const email = orderData?.email || "your email";
  const name = orderData?.name || "Student";

  return (
    <div>
      <div className="bg-secondary/30 flex items-center justify-center p-4 py-10">
      <div className={`w-full max-w-lg transition-all duration-700 ${showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <div className="bg-background rounded-2xl border border-border shadow-lg overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-br from-[rgb(38,72,151)] to-[rgba(38,72,151,0.8)] px-6 py-8 text-center text-primary-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-foreground/20 flex items-center justify-center animate-scale-in">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-xl font-bold mb-1">Payment Successful!</h1>
            <p className="text-sm text-primary-foreground/80">Thank you for your purchase, {name}</p>
          </div>

          {/* Order Details */}
          <div className="px-6 py-5 space-y-4">
            {/* Order ID & Date */}
            <div className="flex justify-between items-center bg-secondary/50 rounded-lg p-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Order ID</p>
                <p className="text-xs font-bold text-foreground">{orderId}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Date</p>
                <p className="text-xs font-bold text-foreground">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
            </div>

            {/* Items */}
            {items.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-accent" /> Courses Purchased
                </h3>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-2 text-xs py-1.5 px-2 rounded bg-secondary/30">
                      <div className="flex-1">
                        <span className="text-foreground/80 line-clamp-1 block">{item.title}</span>
                        {item.modeLabel && <span className="text-[10px] text-accent font-medium">Mode: {item.modeLabel}</span>}
                        {item.bookLabel && <span className="text-[10px] text-indigo-600 font-medium">Books: {item.bookLabel}</span>}
                      </div>
                      <span className="font-semibold text-foreground whitespace-nowrap">₹{item.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Total */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Coupon Discount</span>
                  <span>-₹{couponDiscount.toLocaleString()}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-foreground/80 font-medium">
                  <span>Tax</span>
                  <span>+₹{taxAmount.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-foreground">Amount Paid</span>
                <span className="text-lg font-extrabold text-accent">₹{total.toLocaleString()}</span>
              </div>
            </div>

            <Separator />

            {/* Email notice */}
            <div className="flex items-start gap-2.5 bg-accent/5 border border-accent/15 rounded-lg p-3">
              <Mail className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Confirmation sent to {email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Check your inbox for course access details and receipt</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-xs font-semibold rounded-lg gap-1.5">
                <Download className="w-3.5 h-3.5" /> Download Receipt
              </Button>
              <Link to="/dashboard" className="flex-1">
                <Button size="sm" className="w-full h-9 text-xs font-semibold rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
                  Start Learning <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">
          Need help? Contact us at info@ednovate.in
        </p>
      </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
