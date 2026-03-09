import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Menu, X, ChevronDown, UserCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import LoginModal from "./LoginModal";
import CartDrawer from "./CartDrawer";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const navLinks = [
  { label: "Courses", href: "/packages", hasDropdown: true },
  { label: "New Releases", href: "/#courses" },
  { label: "Most Popular", href: "/#courses" },
  { label: "About Us", href: "/#why-choose" },
  { label: "Contact Us", href: "/#footer" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, userName, logout } = useAuth();
  const { settings } = useSiteSettings();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      {/* Top info bar */}
      <div className="hidden md:block bg-[rgb(38,72,151)] text-primary-foreground text-[11px] border-b border-primary-foreground/10">
        <div className="container mx-auto px-4 h-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-primary-foreground/85">+91 98765 43210</span>
            <span className="w-px h-3 bg-primary-foreground/25" />
            <span className="text-primary-foreground/85">info@ednovate.in</span>
          </div>
          <div className="flex items-center gap-3 text-primary-foreground/75">
            <span>Download App</span>
            <span className="w-px h-3 bg-primary-foreground/30" />
            <span>Demo Classes Available</span>
          </div>
        </div>
      </div>

      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/95 backdrop-blur-xl border-b border-border shadow-[0_10px_30px_-20px_hsl(var(--primary)/0.45)]"
            : "bg-background/90 backdrop-blur-md border-b border-border/60"
        }`}
      >
        <div className="container mx-auto px-4 flex items-center justify-between h-[60px] sm:h-[66px] gap-2">
          <Link to="/" className="flex items-center group shrink-0">
            <img src={settings.logo} alt="Ednovate - Online Learning" className="h-7 sm:h-8 w-auto max-w-[140px] sm:max-w-none" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
                  location.pathname === link.href
                    ? "text-primary bg-primary/10"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
                {link.hasDropdown && <ChevronDown className="w-3 h-3" />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {searchOpen ? (
              <div className="hidden md:flex items-center gap-1.5 animate-scale-in">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search courses..."
                    className="w-56 h-9 text-xs pl-8 rounded-xl bg-muted border-border/60"
                    autoFocus
                  />
                </div>
                <button onClick={() => setSearchOpen(false)} className="p-2 rounded-lg hover:bg-muted">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex p-2.5 hover:bg-muted rounded-xl transition-colors border border-transparent hover:border-border"
              >
                <Search className="w-[18px] h-[18px] text-foreground/60" />
              </button>
            )}

            <CartDrawer />

            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:flex items-center gap-2 h-10 px-3.5 rounded-xl bg-accent/10 hover:bg-accent/15 transition-colors border border-accent/25">
                    <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                      <span className="text-xs font-bold text-accent-foreground">{userName.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground max-w-[80px] truncate">{userName}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer">
                    <UserCircle className="w-4 h-4 mr-2" /> My Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex text-xs font-semibold h-9 px-3.5 rounded-xl text-foreground/80 hover:text-foreground hover:bg-muted"
                  onClick={() => { setLoginOpen(true); setSignupMode(false); }}
                >
                  Login
                </Button>
                <Button
                  size="sm"
                  className="hidden sm:flex bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-semibold h-9 px-4 rounded-xl shadow-sm"
                  onClick={() => { setLoginOpen(true); setSignupMode(true); }}
                >
                  Sign Up Free
                </Button>
              </>
            )}

            <button className="lg:hidden p-2 rounded-xl hover:bg-muted" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl animate-fade-in">
            <div className="container mx-auto px-4 py-3 space-y-1.5">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search courses..." className="pl-9 h-10 text-sm bg-muted border-border/60 rounded-xl" />
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-sm font-medium text-foreground/75 hover:bg-muted hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-3 pb-1">
                {isLoggedIn ? (
                  <>
                    <Button variant="outline" size="sm" className="flex-1 h-9 text-xs font-semibold rounded-xl" onClick={() => { navigate("/dashboard"); setMobileOpen(false); }}>
                      <UserCircle className="w-4 h-4 mr-1" /> Dashboard
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1 h-9 text-xs font-semibold rounded-xl" onClick={() => { handleLogout(); setMobileOpen(false); }}>
                      <LogOut className="w-4 h-4 mr-1" /> Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="flex-1 h-9 text-xs font-semibold rounded-xl" onClick={() => { setLoginOpen(true); setSignupMode(false); setMobileOpen(false); }}>
                      Login
                    </Button>
                    <Button size="sm" className="flex-1 h-9 text-xs font-semibold rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => { setLoginOpen(true); setSignupMode(true); setMobileOpen(false); }}>
                      Sign Up Free
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} isSignup={signupMode} onToggleMode={() => setSignupMode(!signupMode)} />
    </>
  );
};

export default Header;
