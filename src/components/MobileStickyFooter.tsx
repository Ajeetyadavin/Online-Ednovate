import { Link, useNavigate } from "react-router-dom";
import { Phone, BookOpen, GraduationCap, LogIn, UserCircle } from "lucide-react";
import { useState } from "react";
import LoginModal from "./LoginModal";
import { useAuth } from "@/context/AuthContext";

const MobileStickyFooter = () => {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-[rgb(38,72,151)] flex items-center justify-around py-2 border-t border-primary-foreground/10">
          <Link to="/" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
            <GraduationCap className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Home</span>
          </Link>
          <Link to="/packages" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
            <BookOpen className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Courses</span>
          </Link>
          <a href="tel:+919876543210" className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
            <Phone className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Call Us</span>
          </a>
          {isLoggedIn ? (
            <button onClick={() => navigate("/dashboard")} className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
              <UserCircle className="w-5 h-5" />
              <span className="text-[9px] font-semibold">Profile</span>
            </button>
          ) : (
            <button onClick={() => { setLoginOpen(true); setSignupMode(false); }} className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110">
              <LogIn className="w-5 h-5" />
              <span className="text-[9px] font-semibold">Login</span>
            </button>
          )}
        </div>
      </div>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} isSignup={signupMode} onToggleMode={() => setSignupMode(!signupMode)} />
    </>
  );
};

export default MobileStickyFooter;
