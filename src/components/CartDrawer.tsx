import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Separator } from "@/components/ui/separator";
import LoginModal from "./LoginModal";

const CartDrawer = () => {
  const { items, removeFromCart, cartCount, clearCart } = useCart();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const totalOriginal = items.reduce((sum, item) => sum + item.originalPrice, 0);
  const totalSavings = totalOriginal - totalPrice;

  const handleCheckout = () => {
    if (!isLoggedIn) {
      setOpen(false);
      setSignupMode(false);
      setLoginOpen(true);
      return;
    }

    setOpen(false);
    setTimeout(() => navigate("/checkout"), 200);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative p-2 hover:bg-secondary rounded-lg transition-colors">
          <ShoppingCart className="w-[18px] h-[18px] text-foreground/60" />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-scale-in">
              {cartCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="flex flex-col p-0 w-[92vw] max-w-[340px] sm:max-w-[400px]">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="w-4 h-4 text-accent" />
            My Cart ({cartCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 opacity-20" />
            <p className="text-sm font-medium">Your cart is empty</p>
            <p className="text-xs">Add courses to get started</p>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 p-2.5 rounded-lg bg-secondary/50 border border-border">
                  {/* Course info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-foreground line-clamp-2 leading-tight mb-1">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mb-1.5">{item.professor}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-foreground">₹{item.price.toLocaleString()}</span>
                      {item.originalPrice > item.price && (
                        <span className="text-[10px] text-muted-foreground line-through">₹{item.originalPrice.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="self-start p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer with total */}
            <div className="border-t border-border px-4 py-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal ({cartCount} items)</span>
                  <span>₹{totalOriginal.toLocaleString()}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-xs text-green-600 font-medium">
                    <span>You save</span>
                    <span>-₹{totalSavings.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm font-bold text-foreground">
                  <span>Total</span>
                  <span>₹{totalPrice.toLocaleString()}</span>
                </div>
              </div>

              <Button
                className="w-full h-10 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-lg shadow-sm text-sm"
                onClick={handleCheckout}
              >
                Proceed to Checkout
              </Button>

              <button
                onClick={clearCart}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors text-center py-1"
              >
                Clear Cart
              </button>
            </div>
          </>
        )}
      </SheetContent>

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        isSignup={signupMode}
        redirectPath="/checkout"
        onToggleMode={() => setSignupMode((prev) => !prev)}
      />
    </Sheet>
  );
};

export default CartDrawer;
