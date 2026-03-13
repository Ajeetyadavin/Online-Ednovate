import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type HeaderButtonStyle = "solid" | "outline" | "ghost";

export interface HeaderNavLink {
  id: string;
  label: string;
  href: string;
  hasDropdown: boolean;
  visible: boolean;
}

export interface HeaderQuickButton {
  id: string;
  label: string;
  href: string;
  style: HeaderButtonStyle;
  visible: boolean;
  newTab: boolean;
}

export type MobileFooterAction = "link" | "tel" | "login" | "dashboard";
export type MobileFooterIcon = "home" | "courses" | "phone" | "profile" | "login" | "support" | "settings";

export type AnimationType = "up" | "down" | "left" | "right" | "scale" | "fade" | "zoom" | "bounce";
export type AnimationSpeed = "slow" | "normal" | "fast";

export interface MobileFooterButton {
  id: string;
  label: string;
  href: string;
  action: MobileFooterAction;
  icon: MobileFooterIcon;
  visible: boolean;
}

export interface SiteSettings {
  colors: {
    primary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    card: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  logo: string;
  sections: {
    heroBanner: boolean;
    announcementBar: boolean;
    statsCounter: boolean;
    howItWorks: boolean;
    popularCourses: boolean;
    whyChooseUs: boolean;
    testimonials: boolean;
    faq: boolean;
    ctaBand: boolean;
  };
  header: {
    topBarVisible: boolean;
    topBarPhone: string;
    topBarEmail: string;
    topBarPrimaryText: string;
    topBarSecondaryText: string;
    showSearch: boolean;
    showAuthButtons: boolean;
    loginLabel: string;
    signupLabel: string;
    announcementSpeedSeconds: number;
    navLinks: HeaderNavLink[];
    customButtons: HeaderQuickButton[];
  };
  mobileFooter: {
    visible: boolean;
    buttons: MobileFooterButton[];
  };
  animations: {
    enabled: boolean;
    type: AnimationType;
    speed: AnimationSpeed;
  };
}

const createDefaultSettings = (): SiteSettings => ({
  colors: {
    primary: "#1E3A5F",
    accent: "#E04040",
    background: "#FFFFFF",
    foreground: "#1A2332",
    muted: "#F5F5F7",
    card: "#FFFFFF",
  },
  fonts: {
    heading: "Plus Jakarta Sans",
    body: "Inter",
  },
  logo: "/ednovate-logo.svg",
  sections: {
    heroBanner: true,
    announcementBar: true,
    statsCounter: true,
    howItWorks: true,
    popularCourses: true,
    whyChooseUs: true,
    testimonials: true,
    faq: true,
    ctaBand: true,
  },
  header: {
    topBarVisible: true,
    topBarPhone: "+91 98765 43210",
    topBarEmail: "info@ednovate.in",
    topBarPrimaryText: "Download App",
    topBarSecondaryText: "Demo Classes Available",
    showSearch: true,
    showAuthButtons: true,
    loginLabel: "Login",
    signupLabel: "Sign Up Free",
    announcementSpeedSeconds: 28,
    navLinks: [
      {
        id: "nav-courses",
        label: "Courses",
        href: "/packages",
        hasDropdown: true,
        visible: true,
      },
      {
        id: "nav-new-releases",
        label: "New Releases",
        href: "/#courses",
        hasDropdown: false,
        visible: true,
      },
      {
        id: "nav-most-popular",
        label: "Most Popular",
        href: "/#courses",
        hasDropdown: false,
        visible: true,
      },
      {
        id: "nav-about",
        label: "About Us",
        href: "/#why-choose",
        hasDropdown: false,
        visible: true,
      },
      {
        id: "nav-contact",
        label: "Contact Us",
        href: "/#footer",
        hasDropdown: false,
        visible: true,
      },
    ],
    customButtons: [
      {
        id: "header-btn-1",
        label: "Book Demo",
        href: "/packages",
        style: "outline",
        visible: true,
        newTab: false,
      },
    ],
  },
  mobileFooter: {
    visible: true,
    buttons: [
      {
        id: "mobile-btn-home",
        label: "Home",
        href: "/",
        action: "link",
        icon: "home",
        visible: true,
      },
      {
        id: "mobile-btn-courses",
        label: "Courses",
        href: "/packages",
        action: "link",
        icon: "courses",
        visible: true,
      },
      {
        id: "mobile-btn-phone",
        label: "Call Us",
        href: "+919876543210",
        action: "tel",
        icon: "phone",
        visible: true,
      },
      {
        id: "mobile-btn-account",
        label: "Account",
        href: "/dashboard",
        action: "login",
        icon: "login",
        visible: true,
      },
    ],
  },
  animations: {
    enabled: true,
    type: "up",
    speed: "normal",
  },
});

const defaultSettings: SiteSettings = createDefaultSettings();

const normalizeHeaderButton = (
  button: Partial<HeaderQuickButton>,
  index: number,
): HeaderQuickButton => {
  const style: HeaderButtonStyle =
    button.style === "outline" || button.style === "ghost" ? button.style : "solid";

  return {
    id: button.id || `header-btn-${index + 1}`,
    label: button.label || `Button ${index + 1}`,
    href: button.href || "/",
    style,
    visible: button.visible !== false,
    newTab: Boolean(button.newTab),
  };
};

const normalizeHeaderNavLink = (
  link: Partial<HeaderNavLink>,
  index: number,
): HeaderNavLink => {
  return {
    id: link.id || `nav-link-${index + 1}`,
    label: link.label || `Menu ${index + 1}`,
    href: link.href || "/",
    hasDropdown: Boolean(link.hasDropdown),
    visible: link.visible !== false,
  };
};

const normalizeMobileFooterButton = (
  button: Partial<MobileFooterButton>,
  index: number,
): MobileFooterButton => {
  const action: MobileFooterAction =
    button.action === "tel" || button.action === "login" || button.action === "dashboard"
      ? button.action
      : "link";
  const icon: MobileFooterIcon =
    button.icon === "courses" ||
    button.icon === "phone" ||
    button.icon === "profile" ||
    button.icon === "login" ||
    button.icon === "support" ||
    button.icon === "settings"
      ? button.icon
      : "home";

  return {
    id: button.id || `mobile-btn-${index + 1}`,
    label: button.label || `Button ${index + 1}`,
    href: button.href || "/",
    action,
    icon,
    visible: button.visible !== false,
  };
};

const mergeStoredSettings = (stored: Partial<SiteSettings>): SiteSettings => {
  const base = createDefaultSettings();

  return {
    ...base,
    ...stored,
    colors: {
      ...base.colors,
      ...(stored.colors || {}),
    },
    fonts: {
      ...base.fonts,
      ...(stored.fonts || {}),
    },
    sections: {
      ...base.sections,
      ...(stored.sections || {}),
    },
    header: {
      ...base.header,
      ...(stored.header || {}),
      navLinks: Array.isArray(stored.header?.navLinks)
        ? stored.header!.navLinks.map((link, index) => normalizeHeaderNavLink(link, index))
        : base.header.navLinks,
      customButtons: Array.isArray(stored.header?.customButtons)
        ? stored.header!.customButtons.map((button, index) => normalizeHeaderButton(button, index))
        : base.header.customButtons,
    },
    mobileFooter: {
      ...base.mobileFooter,
      ...(stored.mobileFooter || {}),
      buttons: Array.isArray(stored.mobileFooter?.buttons)
        ? stored.mobileFooter!.buttons.map((button, index) => normalizeMobileFooterButton(button, index))
        : base.mobileFooter.buttons,
    },
    animations: {
      ...base.animations,
      ...(stored.animations || {}),
    },
  };
};

function hexToHSL(hex: string): string {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface SiteSettingsContextType {
  settings: SiteSettings;
  updateSettings: (newSettings: Partial<SiteSettings>) => void;
  updateColors: (colors: Partial<SiteSettings["colors"]>) => void;
  updateFonts: (fonts: Partial<SiteSettings["fonts"]>) => void;
  updateSections: (sections: Partial<SiteSettings["sections"]>) => void;
  updateHeader: (header: Partial<SiteSettings["header"]>) => void;
  updateMobileFooter: (mobileFooter: Partial<SiteSettings["mobileFooter"]>) => void;
  updateAnimations: (animations: Partial<SiteSettings["animations"]>) => void;
  updateLogo: (logo: string) => void;
  resetSettings: () => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextType | null>(null);

const STORAGE_KEY = "ednovate_site_settings";

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return mergeStoredSettings(JSON.parse(stored) as Partial<SiteSettings>);
    } catch {}
    return createDefaultSettings();
  });

  // Apply CSS variables whenever colors change
  useEffect(() => {
    const root = document.documentElement;
    const { colors } = settings;

    root.style.setProperty("--primary", hexToHSL(colors.primary));
    root.style.setProperty("--accent", hexToHSL(colors.accent));
    root.style.setProperty("--background", hexToHSL(colors.background));
    root.style.setProperty("--foreground", hexToHSL(colors.foreground));
    root.style.setProperty("--muted", hexToHSL(colors.muted));
    root.style.setProperty("--card", hexToHSL(colors.card));
    root.style.setProperty("--card-foreground", hexToHSL(colors.foreground));
    root.style.setProperty("--popover", hexToHSL(colors.card));
    root.style.setProperty("--popover-foreground", hexToHSL(colors.foreground));

    // Persist
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Apply fonts
  useEffect(() => {
    document.documentElement.style.setProperty("--font-heading", `'${settings.fonts.heading}', sans-serif`);
    document.documentElement.style.setProperty("--font-body", `'${settings.fonts.body}', sans-serif`);
    document.body.style.fontFamily = `'${settings.fonts.body}', sans-serif`;
  }, [settings.fonts]);

  // Apply animation settings
  useEffect(() => {
    const root = document.documentElement;
    const speedMap: Record<string, string> = { slow: "1s", normal: "0.6s", fast: "0.28s" };
    root.style.setProperty("--anim-duration", speedMap[settings.animations.speed] || "0.6s");
    if (!settings.animations.enabled) {
      root.classList.add("animations-disabled");
    } else {
      root.classList.remove("animations-disabled");
    }
    root.setAttribute("data-anim-type", settings.animations.type);
  }, [settings.animations]);

  const updateSettings = (newSettings: Partial<SiteSettings>) => {
    setSettings((prev) => mergeStoredSettings({ ...prev, ...newSettings }));
  };

  const updateColors = (colors: Partial<SiteSettings["colors"]>) => {
    setSettings((prev) => ({ ...prev, colors: { ...prev.colors, ...colors } }));
  };

  const updateFonts = (fonts: Partial<SiteSettings["fonts"]>) => {
    setSettings((prev) => ({ ...prev, fonts: { ...prev.fonts, ...fonts } }));
  };

  const updateSections = (sections: Partial<SiteSettings["sections"]>) => {
    setSettings((prev) => ({ ...prev, sections: { ...prev.sections, ...sections } }));
  };

  const updateHeader = (header: Partial<SiteSettings["header"]>) => {
    setSettings((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        ...header,
        navLinks: header.navLinks
          ? header.navLinks.map((link, index) => normalizeHeaderNavLink(link, index))
          : prev.header.navLinks,
        customButtons: header.customButtons
          ? header.customButtons.map((button, index) => normalizeHeaderButton(button, index))
          : prev.header.customButtons,
      },
    }));
  };

  const updateMobileFooter = (mobileFooter: Partial<SiteSettings["mobileFooter"]>) => {
    setSettings((prev) => ({
      ...prev,
      mobileFooter: {
        ...prev.mobileFooter,
        ...mobileFooter,
        buttons: mobileFooter.buttons
          ? mobileFooter.buttons.map((button, index) => normalizeMobileFooterButton(button, index))
          : prev.mobileFooter.buttons,
      },
    }));
  };

  const updateLogo = (logo: string) => {
    setSettings((prev) => ({ ...prev, logo }));
  };

  const updateAnimations = (animations: Partial<SiteSettings["animations"]>) => {
    setSettings((prev) => ({ ...prev, animations: { ...prev.animations, ...animations } }));
  };

  const resetSettings = () => {
    setSettings(createDefaultSettings());
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <SiteSettingsContext.Provider value={{ settings, updateSettings, updateColors, updateFonts, updateSections, updateHeader, updateMobileFooter, updateAnimations, updateLogo, resetSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  return ctx;
}
