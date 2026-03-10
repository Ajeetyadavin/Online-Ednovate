import { useNavigate } from "react-router-dom";
import { Phone, BookOpen, GraduationCap, LogIn, UserCircle, LifeBuoy, Settings } from "lucide-react";
import { useState } from "react";
import LoginModal from "./LoginModal";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const MobileStickyFooter = () => {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const { isLoggedIn } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  const iconMap = {
    home: GraduationCap,
    courses: BookOpen,
    phone: Phone,
    profile: UserCircle,
    login: LogIn,
    support: LifeBuoy,
    settings: Settings,
  } as const;

  const visibleButtons = settings.mobileFooter.buttons
    .filter((button) => button.visible)
    .slice(0, 5);

  const openHref = (href: string) => {
    if (!href) return;

    if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
      window.location.href = href;
      return;
    }

    navigate(href);
  };

  const handleButtonAction = (action: string, href: string) => {
    if (action === "tel") {
      const phone = href.startsWith("tel:") ? href : `tel:${href}`;
      window.location.href = phone;
      return;
    }

    if (action === "login") {
      if (isLoggedIn) {
        navigate(href || "/dashboard");
      } else {
        setSignupMode(false);
        setLoginOpen(true);
      }
      return;
    }

    if (action === "dashboard") {
      navigate(href || "/dashboard");
      return;
    }

    openHref(href);
  };

  if (!settings.mobileFooter.visible || visibleButtons.length === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div
          className="bg-[rgb(38,72,151)] grid py-2 border-t border-primary-foreground/10"
          style={{ gridTemplateColumns: `repeat(${visibleButtons.length}, minmax(0, 1fr))` }}
        >
          {visibleButtons.map((button) => {
            const IconComponent =
              button.action === "login" && isLoggedIn
                ? UserCircle
                : iconMap[button.icon] || GraduationCap;

            return (
              <button
                key={button.id}
                onClick={() => handleButtonAction(button.action, button.href)}
                className="flex flex-col items-center gap-0.5 text-primary-foreground/70 hover:text-accent transition-all tap-bounce active:scale-110"
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-[9px] font-semibold truncate max-w-[64px]">
                  {button.action === "login" && isLoggedIn ? "Profile" : button.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} isSignup={signupMode} onToggleMode={() => setSignupMode(!signupMode)} />
    </>
  );
};

export default MobileStickyFooter;
