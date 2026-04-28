import { useNavigate } from "react-router-dom";
import { Phone, BookOpen, GraduationCap, LogIn, UserCircle, LifeBuoy, Settings, Compass, FileText, X } from "lucide-react";
import { useState } from "react";
import LoginModal from "./LoginModal";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const MobileStickyFooter = () => {
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
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

  const isExploreButton = (button: (typeof visibleButtons)[number]) =>
    button.id === "mobile-btn-courses" || button.href === "/packages" || button.label.toLowerCase() === "courses";

  const openExplorePath = (href: string) => {
    setExploreOpen(false);
    navigate(href);
  };

  const handleButtonAction = (button: (typeof visibleButtons)[number]) => {
    const { action, href } = button;
    if (isExploreButton(button)) {
      setExploreOpen((open) => !open);
      return;
    }

    setExploreOpen(false);

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
        {exploreOpen && (
          <>
            <button
              type="button"
              aria-label="Close explore menu"
              className="fixed inset-0 bottom-[56px] bg-black/10"
              onClick={() => setExploreOpen(false)}
            />
            <div className="absolute bottom-[62px] left-3 right-3 overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.28)] animate-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Explore</p>
                  <p className="text-[11px] font-medium text-slate-500">Choose what you want to browse</p>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  onClick={() => setExploreOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  type="button"
                  onClick={() => openExplorePath("/packages")}
                  className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-left transition-transform active:scale-95"
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(38,72,151)] text-white">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-black text-slate-900">Courses</p>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-500">Video lectures</p>
                </button>
                <button
                  type="button"
                  onClick={() => openExplorePath("/test-series")}
                  className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-left transition-transform active:scale-95"
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#E74623] text-white">
                    <FileText className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-black text-slate-900">Test Series</p>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-500">Practice papers</p>
                </button>
              </div>
            </div>
          </>
        )}
        <div
          className="bg-[rgb(38,72,151)] grid py-2 border-t border-primary-foreground/10"
          style={{ gridTemplateColumns: `repeat(${visibleButtons.length}, minmax(0, 1fr))` }}
        >
          {visibleButtons.map((button) => {
            const IconComponent =
              button.action === "login" && isLoggedIn
                ? UserCircle
                : isExploreButton(button)
                  ? Compass
                  : iconMap[button.icon] || GraduationCap;

            return (
              <button
                key={button.id}
                onClick={() => handleButtonAction(button)}
                className="flex flex-col items-center gap-0.5 text-white hover:text-white transition-all tap-bounce active:scale-110"
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-[9px] font-semibold truncate max-w-[64px]">
                  {button.action === "login" && isLoggedIn ? "Profile" : isExploreButton(button) ? "Explore" : button.label}
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
