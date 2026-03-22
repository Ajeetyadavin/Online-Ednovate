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
  const headerSettings = settings.header;
  const isCollectionHref = (href: string) => /^\/collections\/[a-z0-9-]+$/i.test(String(href || ""));
  const extractCollectionSlug = (href: string) => {
    const match = String(href || "").match(/^\/collections\/([a-z0-9-]+)$/i);
    return match?.[1] || null;
  };

  const collectionBySlug = new Map(
    headerSettings.courseCollections.map((collection) => [collection.slug, collection]),
  );

  const orderedNavLinks = headerSettings.navLinks
    .filter((link) => link.visible)
    .flatMap((link) => {
      if (!isCollectionHref(link.href)) {
        return [link];
      }

      const slug = extractCollectionSlug(link.href);
      if (!slug) return [];
      const collection = collectionBySlug.get(slug);
      if (!collection || !collection.visible || !collection.showInNavigation) {
        return [];
      }

      return [{
        ...link,
        label: link.label || collection.navigationLabel || collection.title,
        href: `/collections/${collection.slug}`,
      }];
    });

  const collectionSlugsInOrderedNav = new Set(
    orderedNavLinks
      .map((link) => extractCollectionSlug(link.href))
      .filter((slug): slug is string => Boolean(slug)),
  );

  const collectionNavLinks = headerSettings.courseCollections
    .filter((collection) => collection.visible && collection.showInNavigation)
    .filter((collection) => !collectionSlugsInOrderedNav.has(collection.slug))
    .sort((a, b) => a.navigationOrder - b.navigationOrder || a.sortOrder - b.sortOrder)
    .map((collection) => ({
      id: `collection-nav-${collection.id}`,
      label: collection.navigationLabel || collection.title,
      href: `/collections/${collection.slug}`,
      hasDropdown: false,
      visible: true,
    }));

  const navLinks = [...orderedNavLinks, ...collectionNavLinks];
  const customHeaderButtons = headerSettings.customButtons
    .filter((button) => button.visible)
    .filter((button) => button.label.toLowerCase() !== "book demo" && button.label.toLowerCase() !== "signup for free");

  const isExternalHref = (href: string) => /^(https?:\/\/|mailto:|tel:)/i.test(href);

  const renderCustomButton = (button: typeof customHeaderButtons[number], mobile = false) => {
    const variant = button.style === "outline" ? "outline" : button.style === "ghost" ? "ghost" : "default";
    const className = mobile
      ? `w-full justify-center h-9 rounded-xl text-xs font-semibold ${
          button.style === "solid" ? "shadow-sm" : ""
        }`
      : `hidden sm:flex h-9 px-3.5 rounded-xl text-xs font-semibold ${
          button.style === "solid" ? "shadow-sm" : ""
        }`;

    const solidStyle = button.style === "solid"
      ? {
          backgroundColor: headerSettings.solidButtonBg || "#E04040",
          color: headerSettings.solidButtonText || "#FFFFFF",
        }
      : undefined;

    if (isExternalHref(button.href)) {
      return (
        <Button key={button.id} size="sm" variant={variant} className={className} style={solidStyle} asChild>
          <a href={button.href} target={button.newTab ? "_blank" : undefined} rel={button.newTab ? "noreferrer" : undefined}>
            {button.label}
          </a>
        </Button>
      );
    }

    return (
      <Button key={button.id} size="sm" variant={variant} className={className} style={solidStyle} asChild>
        <Link to={button.href}>{button.label}</Link>
      </Button>
    );
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!headerSettings.showSearch && searchOpen) {
      setSearchOpen(false);
    }
  }, [headerSettings.showSearch, searchOpen]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      {/* Top info bar */}
      {headerSettings.topBarVisible && (
      <div className="hidden md:block bg-[rgb(38,72,151)] text-primary-foreground text-[11px] border-b border-primary-foreground/10">
        <div className="container mx-auto px-4 h-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-primary-foreground/85">{headerSettings.topBarPhone}</span>
            <span className="w-px h-3 bg-primary-foreground/25" />
            <span className="text-primary-foreground/85">{headerSettings.topBarEmail}</span>
          </div>
          <div className="flex items-center gap-3 text-primary-foreground/75">
            {headerSettings.topBarPrimaryText && <span>{headerSettings.topBarPrimaryText}</span>}
            {headerSettings.topBarPrimaryText && headerSettings.topBarSecondaryText && <span className="w-px h-3 bg-primary-foreground/30" />}
            {headerSettings.topBarSecondaryText && <span>{headerSettings.topBarSecondaryText}</span>}
          </div>
        </div>
      </div>
      )}

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
            {headerSettings.showBrandText && (
              <div className="hidden sm:block ml-2 leading-tight">
                <p className="text-sm font-bold" style={{ color: headerSettings.navTextColor || "#000000" }}>
                  {headerSettings.brandTitle || "Ednovate"}
                </p>
                {headerSettings.brandSubtitle && (
                  <p className="text-[10px] text-muted-foreground">{headerSettings.brandSubtitle}</p>
                )}
              </div>
            )}
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
                  location.pathname === link.href
                    ? ""
                    : ""
                }`}
                style={{
                  color: headerSettings.navTextColor || "#000000",
                  backgroundColor: location.pathname === link.href
                    ? (headerSettings.navActiveBg || "#0000000d")
                    : "transparent",
                }}
                onMouseEnter={(event) => {
                  if (location.pathname !== link.href) {
                    event.currentTarget.style.backgroundColor = headerSettings.navHoverBg || "#f5f5f5";
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = location.pathname === link.href
                    ? (headerSettings.navActiveBg || "#0000000d")
                    : "transparent";
                }}
              >
                {link.label}
                {link.hasDropdown && <ChevronDown className="w-3 h-3" />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {headerSettings.showSearch && searchOpen ? (
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
            ) : headerSettings.showSearch ? (
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex p-2.5 hover:bg-muted rounded-xl transition-colors border border-transparent hover:border-border"
              >
                <Search className="w-[18px] h-[18px] text-foreground/60" />
              </button>
            ) : null}

            <CartDrawer />

            {customHeaderButtons.map((button) => renderCustomButton(button))}

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
                {headerSettings.showAuthButtons && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden sm:flex text-xs font-semibold h-9 px-3.5 rounded-xl text-[#000000] hover:text-[#000000] hover:bg-muted"
                      onClick={() => { setLoginOpen(true); setSignupMode(false); }}
                    >
                      {headerSettings.loginLabel}
                    </Button>
                    {/* Signup CTA hidden as requested */}
                  </>
                )}
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
                  className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#000000] hover:bg-muted hover:text-[#000000] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {customHeaderButtons.length > 0 && (
                <div className="grid grid-cols-1 gap-2 pt-2">
                  {customHeaderButtons.map((button) => renderCustomButton(button, true))}
                </div>
              )}
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
                    {headerSettings.showAuthButtons && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 h-9 text-xs font-semibold rounded-xl" onClick={() => { setLoginOpen(true); setSignupMode(false); setMobileOpen(false); }}>
                          {headerSettings.loginLabel}
                        </Button>
                        {/* Mobile Signup CTA hidden as requested */}
                      </>
                    )}
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
