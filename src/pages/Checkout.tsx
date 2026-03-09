import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, CreditCard, Smartphone, Building2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/context/CartContext";
import { toast } from "@/hooks/use-toast";

const Checkout = () => {
  const { items, cartCount, completePurchase } = useCart();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const totalOriginal = items.reduce((sum, item) => sum + item.originalPrice, 0);
  const totalSavings = totalOriginal - totalPrice;
  const couponDiscount = couponApplied ? Math.round(totalPrice * 0.05) : 0;
  const finalTotal = totalPrice - couponDiscount;

  const handleApplyCoupon = () => {
    if (coupon.trim().toUpperCase() === "EDU5") {
      setCouponApplied(true);
      toast({ title: "🎉 Coupon Applied!", description: "5% extra discount added" });
    } else {
      toast({ title: "Invalid Coupon", description: "Please enter a valid coupon code" });
    }
  };

  const handlePlaceOrder = () => {
    const orderId = "EDN" + Math.random().toString(36).substring(2, 10).toUpperCase();
    const orderItems = items.map((item) => ({ title: item.title, price: item.price }));
    completePurchase({ orderId, total: finalTotal, paymentMethod });
    navigate("/order-confirmation", {
      state: {
        items: orderItems,
        total: finalTotal,
        orderId,
        email: "student@example.com",
        name: "Student",
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
                  <Input placeholder="Enter your name" className="h-9 text-sm bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" placeholder="your@email.com" className="h-9 text-sm bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Phone Number</Label>
                  <Input type="tel" placeholder="+91 98765 43210" className="h-9 text-sm bg-secondary/50 border-border" />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-background rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-bold text-foreground">Payment Method</h2>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "upi" ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/50"}`}>
                  <RadioGroupItem value="upi" />
                  <Smartphone className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">UPI</p>
                    <p className="text-[10px] text-muted-foreground">GPay, PhonePe, Paytm</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "card" ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/50"}`}>
                  <RadioGroupItem value="card" />
                  <CreditCard className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Credit / Debit Card</p>
                    <p className="text-[10px] text-muted-foreground">Visa, Mastercard, RuPay</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "netbanking" ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/50"}`}>
                  <RadioGroupItem value="netbanking" />
                  <Building2 className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Net Banking</p>
                    <p className="text-[10px] text-muted-foreground">All major banks supported</p>
                  </div>
                </label>
              </RadioGroup>

              {paymentMethod === "card" && (
                <div className="space-y-3 pt-2 animate-fade-in">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Card Number</Label>
                    <Input placeholder="1234 5678 9012 3456" className="h-9 text-sm bg-secondary/50 border-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expiry</Label>
                      <Input placeholder="MM/YY" className="h-9 text-sm bg-secondary/50 border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CVV</Label>
                      <Input type="password" placeholder="•••" className="h-9 text-sm bg-secondary/50 border-border" />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === "upi" && (
                <div className="space-y-1.5 pt-2 animate-fade-in">
                  <Label className="text-xs">UPI ID</Label>
                  <Input placeholder="yourname@upi" className="h-9 text-sm bg-secondary/50 border-border" />
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
                    <p className="text-xs text-foreground line-clamp-2 flex-1">{item.title}</p>
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
                    disabled={couponApplied}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3"
                  onClick={handleApplyCoupon}
                  disabled={couponApplied || !coupon.trim()}
                >
                  {couponApplied ? "Applied ✓" : "Apply"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Try: EDU5 for 5% off</p>

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
                {couponApplied && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Coupon (EDU5)</span>
                    <span>-₹{couponDiscount.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm font-bold text-foreground pt-1">
                  <span>Total</span>
                  <span>₹{finalTotal.toLocaleString()}</span>
                </div>
              </div>

              <Button
                className="w-full h-10 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-lg shadow-sm text-sm mt-2"
                onClick={handlePlaceOrder}
              >
                Pay ₹{finalTotal.toLocaleString()}
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
