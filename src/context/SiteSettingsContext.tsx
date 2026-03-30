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

export interface HeaderCourseCollection {
  id: string;
  slug: string;
  title: string;
  description: string;
  badge: string;
  heroImageUrl: string;
  ctaLabel: string;
  visible: boolean;
  sortOrder: number;
  courseIds: string[];
  enableSearch: boolean;
  searchPlaceholder: string;
  enableCategoryFilter: boolean;
  categoryFilterLabel: string;
  categoryIds: string[];
  emptyStateText: string;
  showInNavigation: boolean;
  navigationLabel: string;
  navigationOrder: number;
  enableCourseSelector: boolean;
  enableCourseSchedule: boolean;
  courseVisibleFrom: string;
  courseVisibleUntil: string;
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

export interface FloatingContactActionSettings {
  label: string;
  color: string;
  visible: boolean;
}

export interface FloatingContactChannelSettings extends FloatingContactActionSettings {
  value: string;
}

export interface PaymentGatewaySettings {
  cod: {
    enabled: boolean;
  };
  payu: {
    enabled: boolean;
    merchantKey: string;
    merchantSalt: string;
    merchantId: string;
    apiBaseUrl: string;
  };
  hdfc: {
    enabled: boolean;
    merchantId: string;
    accessCode: string;
    workingKey: string;
    apiBaseUrl: string;
  };
}

export interface HomepageFaqItem {
  question: string;
  answer: string;
}

export interface HomepageStatItem {
  label: string;
  value: number;
  suffix: string;
}

export interface HomepageHowItWorksStep {
  title: string;
  desc: string;
  icon?: string;
}

export interface HomepageWhyChooseItem {
  icon?: string;
  title: string;
  description: string;
}

export const HOMEPAGE_SECTION_ANCHORS = [
  "before-hero",
  "heroBanner",
  "announcementBar",
  "statsCounter",
  "howItWorks",
  "popularCourses",
  "whyChooseUs",
  "testimonials",
  "faculty",
  "faq",
  "ctaBand",
] as const;

export type HomepageSectionAnchor = (typeof HOMEPAGE_SECTION_ANCHORS)[number];

export interface HomepageSection {
  id: string;
  type: "hero" | "text" | "courses" | "features" | "banner" | "cta" | "custom";
  title: string;
  subtitle?: string;
  content?: string;
  imageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  fontFamily?: string;
  order: number;
  insertAfter?: HomepageSectionAnchor;
  visible: boolean;
  customSettings?: Record<string, unknown>;
}

export interface SiteSettings {
  maintenanceMode: boolean;
  security: {
    antiInspectEnabled: boolean;
    disableCopyPaste: boolean;
  };
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
    baseSizePx: number;
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
    faculty: boolean;
    faq: boolean;
    ctaBand: boolean;
  };
  layout: {
    sectionGapPx: number;
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
    showBrandText: boolean;
    brandTitle: string;
    brandSubtitle: string;
    navTextColor: string;
    navHoverBg: string;
    navActiveBg: string;
    solidButtonBg: string;
    solidButtonText: string;
    navLinks: HeaderNavLink[];
    customButtons: HeaderQuickButton[];
    courseCollections: HeaderCourseCollection[];
  };
  mobileFooter: {
    visible: boolean;
    buttons: MobileFooterButton[];
  };
  floatingContact: {
    visible: boolean;
    toggleColor: string;
    enquiry: FloatingContactActionSettings;
    call: FloatingContactChannelSettings;
    whatsapp: FloatingContactChannelSettings;
  };
  paymentGateways: PaymentGatewaySettings;
  animations: {
    enabled: boolean;
    type: AnimationType;
    speed: AnimationSpeed;
  };
  bunnyStreamApi: {
    enabled: boolean;
    libraryId: string;
    apiKey: string;
    cdnHostname: string;
    pullZone: string;
  };
  homepageContent: {
    faq: {
      title: string;
      subtitle: string;
      backgroundColor: string;
      textColor: string;
      items: HomepageFaqItem[];
    };
    stats: {
      backgroundColor: string;
      textColor: string;
      iconColor: string;
      items: HomepageStatItem[];
    };
    howItWorks: {
      title: string;
      subtitle: string;
      backgroundColor: string;
      textColor: string;
      steps: HomepageHowItWorksStep[];
    };
    whyChooseUs: {
      title: string;
      subtitle: string;
      backgroundColor: string;
      textColor: string;
      items: HomepageWhyChooseItem[];
    };
    faculty: {
      title: string;
      subtitle: string;
      backgroundColor: string;
      textColor: string;
    };
  };
  exploreCategoryIds: string[];
  customHomepageSections: HomepageSection[];
}

const createDefaultSettings = (): SiteSettings => ({
  maintenanceMode: false,
  security: {
    antiInspectEnabled: false,
    disableCopyPaste: false,
  },
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
    baseSizePx: 16,
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
    faculty: true,
    faq: true,
    ctaBand: true,
  },
  layout: {
    sectionGapPx: 0,
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
    showBrandText: false,
    brandTitle: "Ednovate",
    brandSubtitle: "Exam Ready Learning",
    navTextColor: "#000000",
    navHoverBg: "#f5f5f5",
    navActiveBg: "#0000000d",
    solidButtonBg: "#E04040",
    solidButtonText: "#FFFFFF",
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
        href: "/collections/new-releases",
        hasDropdown: false,
        visible: true,
      },
      {
        id: "nav-most-popular",
        label: "Most Popular",
        href: "/collections/most-popular",
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
        href: "/contact-us",
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
    courseCollections: [
      {
        id: "collection-new-releases",
        slug: "new-releases",
        title: "New Releases",
        description: "Freshly launched courses with the latest updates and exam-focused strategy.",
        badge: "Just Launched",
        heroImageUrl: "",
        ctaLabel: "Explore New Courses",
        visible: true,
        sortOrder: 1,
        courseIds: [],
        enableSearch: true,
        searchPlaceholder: "Search in new releases...",
        enableCategoryFilter: true,
        categoryFilterLabel: "Browse by Category",
        categoryIds: [],
        emptyStateText: "No courses found for selected filters.",
        showInNavigation: true,
        navigationLabel: "New Releases",
        navigationOrder: 1,
        enableCourseSelector: true,
        enableCourseSchedule: false,
        courseVisibleFrom: "",
        courseVisibleUntil: "",
      },
      {
        id: "collection-most-popular",
        slug: "most-popular",
        title: "Most Popular",
        description: "Top-picked programs trusted by students for consistent exam performance.",
        badge: "Top Picks",
        heroImageUrl: "",
        ctaLabel: "View Popular Courses",
        visible: true,
        sortOrder: 2,
        courseIds: [],
        enableSearch: true,
        searchPlaceholder: "Search in most popular...",
        enableCategoryFilter: true,
        categoryFilterLabel: "Filter by Category",
        categoryIds: [],
        emptyStateText: "No popular courses found for selected filters.",
        showInNavigation: true,
        navigationLabel: "Most Popular",
        navigationOrder: 2,
        enableCourseSelector: true,
        enableCourseSchedule: false,
        courseVisibleFrom: "",
        courseVisibleUntil: "",
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
  floatingContact: {
    visible: true,
    toggleColor: "#1E3A5F",
    enquiry: {
      label: "Enquire Now",
      color: "#FFFFFF",
      visible: true,
    },
    call: {
      label: "Call Us",
      color: "#2563EB",
      value: "+91 98765 43210",
      visible: true,
    },
    whatsapp: {
      label: "WhatsApp",
      color: "#22C55E",
      value: "+91 98765 43210",
      visible: true,
    },
  },
  paymentGateways: {
    cod: {
      enabled: true,
    },
    payu: {
      enabled: false,
      merchantKey: "",
      merchantSalt: "",
      merchantId: "",
      apiBaseUrl: "",
    },
    hdfc: {
      enabled: false,
      merchantId: "",
      accessCode: "",
      workingKey: "",
      apiBaseUrl: "",
    },
  },
  animations: {
    enabled: true,
    type: "up",
    speed: "normal",
  },
  bunnyStreamApi: {
    enabled: false,
    libraryId: "",
    apiKey: "",
    cdnHostname: "",
    pullZone: "",
  },
  homepageContent: {
    faq: {
      title: "Frequently Asked Questions",
      subtitle: "Answers to your most common questions",
      backgroundColor: "#F8FAFC",
      textColor: "#0F172A",
      items: [
        {
          question: "How long can I access the courses?",
          answer: "You can access your enrolled courses unlimited times until the validity period ends. Most courses are valid until the exam date.",
        },
        {
          question: "Are demo classes available?",
          answer: "Yes! Free demo lectures are available for every course. Visit the course details page to watch the demo.",
        },
        {
          question: "What payment options are available?",
          answer: "We accept UPI, Credit/Debit Cards, Net Banking, and EMI options. All payments are secure and encrypted.",
        },
        {
          question: "Will the courses work on mobile?",
          answer: "Absolutely! All courses run smoothly on mobile, tablet, and desktop. Learn anytime, anywhere.",
        },
      ],
    },
    stats: {
      backgroundColor: "#264897",
      textColor: "#FFFFFF",
      iconColor: "#E04040",
      items: [
        { label: "Courses Purchased", value: 15000, suffix: "+" },
        { label: "Students Enrolled", value: 50000, suffix: "+" },
        { label: "Uploaded Videos", value: 25000, suffix: "+" },
        { label: "Listed Courses", value: 500, suffix: "+" },
      ],
    },
    howItWorks: {
      title: "How It Works",
      subtitle: "Start your learning journey in 4 simple steps",
      backgroundColor: "#FFFFFF",
      textColor: "#0F172A",
      steps: [
        { title: "Browse Courses", desc: "Explore our wide range of CA, CS & CMA courses", icon: "Search" },
        { title: "Enroll Instantly", desc: "Quick checkout with secure payment options", icon: "ShoppingCart" },
        { title: "Start Learning", desc: "Access video lectures, notes & materials anytime", icon: "PlayCircle" },
        { title: "Ace Your Exams", desc: "Clear exams with confidence & top ranks", icon: "Award" },
      ],
    },
    whyChooseUs: {
      title: "Everything You Need to Succeed",
      subtitle: "A complete learning ecosystem built for serious students",
      backgroundColor: "#F8FAFC",
      textColor: "#0F172A",
      items: [
        { icon: "BookOpen", title: "All Subjects Under One Roof", description: "Complete course coverage for CA, CS, CMA and more" },
        { icon: "Monitor", title: "HD Recorded Lectures", description: "Crystal clear video quality for the best learning experience" },
        { icon: "Users", title: "Choice of Professor", description: "Learn from your preferred faculty members" },
      ],
    },
    faculty: {
      title: "Meet Our Expert Instructors",
      subtitle: "Learn from industry professionals with years of experience and passion for education",
      backgroundColor: "#F8FAFC",
      textColor: "#0F172A",
    },
  },
  exploreCategoryIds: [],
  customHomepageSections: [],
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

const normalizeHeaderCollection = (
  collection: Partial<HeaderCourseCollection>,
  index: number,
): HeaderCourseCollection => {
  const fallbackSlug = `collection-${index + 1}`;
  const slug = String(collection.slug || fallbackSlug)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || fallbackSlug;

  const nextCourseIds = Array.isArray(collection.courseIds)
    ? collection.courseIds.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    id: collection.id || `collection-${index + 1}`,
    slug,
    title: String(collection.title || `Collection ${index + 1}`),
    description: String(collection.description || ""),
    badge: String(collection.badge || ""),
    heroImageUrl: String(collection.heroImageUrl || ""),
    ctaLabel: String(collection.ctaLabel || "Explore Courses"),
    visible: collection.visible !== false,
    sortOrder: Number(collection.sortOrder || index + 1),
    courseIds: nextCourseIds,
    enableSearch: collection.enableSearch !== false,
    searchPlaceholder: String(collection.searchPlaceholder || "Search courses..."),
    enableCategoryFilter: collection.enableCategoryFilter !== false,
    categoryFilterLabel: String(collection.categoryFilterLabel || "Filter by Category"),
    categoryIds: Array.isArray(collection.categoryIds)
      ? collection.categoryIds.map((item) => String(item).trim()).filter(Boolean)
      : [],
    emptyStateText: String(collection.emptyStateText || "No courses found for selected filters."),
    showInNavigation: collection.showInNavigation !== false,
    navigationLabel: String(collection.navigationLabel || collection.title || `Collection ${index + 1}`),
    navigationOrder: Number(collection.navigationOrder || index + 1),
    enableCourseSelector: collection.enableCourseSelector !== false,
    enableCourseSchedule: collection.enableCourseSchedule === true,
    courseVisibleFrom: String(collection.courseVisibleFrom || ""),
    courseVisibleUntil: String(collection.courseVisibleUntil || ""),
  };
};

const normalizeHeaderNavLink = (
  link: Partial<HeaderNavLink>,
  index: number,
): HeaderNavLink => {
  const normalizedId = link.id || `nav-link-${index + 1}`;
  const normalizedLabel = link.label || `Menu ${index + 1}`;
  const rawHref = link.href || "/";
  const shouldMigrateNewReleaseHref =
    (normalizedId === "nav-new-releases" || normalizedLabel.toLowerCase() === "new releases") &&
    (rawHref === "/#courses" || rawHref === "#courses");
  const shouldMigrateMostPopularHref =
    (normalizedId === "nav-most-popular" || normalizedLabel.toLowerCase() === "most popular") &&
    (rawHref === "/#courses" || rawHref === "#courses");
  const shouldMigrateContactHref =
    (normalizedId === "nav-contact" || normalizedLabel.toLowerCase() === "contact us") &&
    (rawHref === "/#footer" || rawHref === "#footer");

  return {
    id: normalizedId,
    label: normalizedLabel,
    href: shouldMigrateContactHref
      ? "/contact-us"
      : shouldMigrateNewReleaseHref
        ? "/collections/new-releases"
        : shouldMigrateMostPopularHref
          ? "/collections/most-popular"
          : rawHref,
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

const normalizeFloatingContactAction = (
  action: Partial<FloatingContactActionSettings> | undefined,
  fallback: FloatingContactActionSettings,
): FloatingContactActionSettings => {
  return {
    label: action?.label || fallback.label,
    color: action?.color || fallback.color,
    visible: action?.visible !== false,
  };
};

const normalizeFloatingContactChannel = (
  action: Partial<FloatingContactChannelSettings> | undefined,
  fallback: FloatingContactChannelSettings,
): FloatingContactChannelSettings => {
  return {
    ...normalizeFloatingContactAction(action, fallback),
    value: action?.value || fallback.value,
  };
};

const mergeStoredSettings = (stored: Partial<SiteSettings>): SiteSettings => {
  const base = createDefaultSettings();

  return {
    ...base,
    ...stored,
    logo: String(stored.logo || base.logo),
    maintenanceMode: stored.maintenanceMode === true,
    security: {
      antiInspectEnabled: stored.security?.antiInspectEnabled === true,
      disableCopyPaste: stored.security?.disableCopyPaste === true,
    },
    colors: {
      ...base.colors,
      ...(stored.colors || {}),
    },
    fonts: {
      ...base.fonts,
      ...(stored.fonts || {}),
      baseSizePx:
        typeof stored.fonts?.baseSizePx === "number" && Number.isFinite(stored.fonts.baseSizePx)
          ? stored.fonts.baseSizePx
          : base.fonts.baseSizePx,
    },
    sections: {
      ...base.sections,
      ...(stored.sections || {}),
    },
    layout: {
      ...base.layout,
      ...(stored.layout || {}),
      sectionGapPx:
        typeof stored.layout?.sectionGapPx === "number" && Number.isFinite(stored.layout.sectionGapPx)
          ? Math.min(120, Math.max(-64, stored.layout.sectionGapPx))
          : base.layout.sectionGapPx,
    },
    header: {
      ...base.header,
      ...(stored.header || {}),
      showBrandText:
        typeof stored.header?.showBrandText === "boolean"
          ? stored.header.showBrandText
          : base.header.showBrandText,
      brandTitle: String(stored.header?.brandTitle || base.header.brandTitle),
      brandSubtitle: String(stored.header?.brandSubtitle || base.header.brandSubtitle),
      navTextColor: String(stored.header?.navTextColor || base.header.navTextColor),
      navHoverBg: String(stored.header?.navHoverBg || base.header.navHoverBg),
      navActiveBg: String(stored.header?.navActiveBg || base.header.navActiveBg),
      solidButtonBg: String(stored.header?.solidButtonBg || base.header.solidButtonBg),
      solidButtonText: String(stored.header?.solidButtonText || base.header.solidButtonText),
      navLinks: Array.isArray(stored.header?.navLinks)
        ? stored.header!.navLinks.map((link, index) => normalizeHeaderNavLink(link, index))
        : base.header.navLinks,
      customButtons: Array.isArray(stored.header?.customButtons)
        ? stored.header!.customButtons.map((button, index) => normalizeHeaderButton(button, index))
        : base.header.customButtons,
      courseCollections: Array.isArray(stored.header?.courseCollections)
        ? stored.header!.courseCollections.map((collection, index) => normalizeHeaderCollection(collection, index))
        : base.header.courseCollections,
    },
    mobileFooter: {
      ...base.mobileFooter,
      ...(stored.mobileFooter || {}),
      buttons: Array.isArray(stored.mobileFooter?.buttons)
        ? stored.mobileFooter!.buttons.map((button, index) => normalizeMobileFooterButton(button, index))
        : base.mobileFooter.buttons,
    },
    floatingContact: {
      ...base.floatingContact,
      ...(stored.floatingContact || {}),
      enquiry: normalizeFloatingContactAction(stored.floatingContact?.enquiry, base.floatingContact.enquiry),
      call: normalizeFloatingContactChannel(stored.floatingContact?.call, base.floatingContact.call),
      whatsapp: normalizeFloatingContactChannel(stored.floatingContact?.whatsapp, base.floatingContact.whatsapp),
    },
    paymentGateways: {
      cod: {
        enabled: stored.paymentGateways?.cod?.enabled !== false,
      },
      payu: {
        enabled: stored.paymentGateways?.payu?.enabled === true,
        merchantKey: String(stored.paymentGateways?.payu?.merchantKey || base.paymentGateways.payu.merchantKey),
        merchantSalt: String(stored.paymentGateways?.payu?.merchantSalt || base.paymentGateways.payu.merchantSalt),
        merchantId: String(stored.paymentGateways?.payu?.merchantId || base.paymentGateways.payu.merchantId),
        apiBaseUrl: String(stored.paymentGateways?.payu?.apiBaseUrl || base.paymentGateways.payu.apiBaseUrl),
      },
      hdfc: {
        enabled: stored.paymentGateways?.hdfc?.enabled === true,
        merchantId: String(stored.paymentGateways?.hdfc?.merchantId || base.paymentGateways.hdfc.merchantId),
        accessCode: String(stored.paymentGateways?.hdfc?.accessCode || base.paymentGateways.hdfc.accessCode),
        workingKey: String(stored.paymentGateways?.hdfc?.workingKey || base.paymentGateways.hdfc.workingKey),
        apiBaseUrl: String(stored.paymentGateways?.hdfc?.apiBaseUrl || base.paymentGateways.hdfc.apiBaseUrl),
      },
    },
    animations: {
      ...base.animations,
      ...(stored.animations || {}),
    },
    homepageContent: {
      faq: {
        title: String(stored.homepageContent?.faq?.title || base.homepageContent.faq.title),
        subtitle: String(stored.homepageContent?.faq?.subtitle || base.homepageContent.faq.subtitle),
        backgroundColor: String(stored.homepageContent?.faq?.backgroundColor || base.homepageContent.faq.backgroundColor),
        textColor: String(stored.homepageContent?.faq?.textColor || base.homepageContent.faq.textColor),
        items: Array.isArray(stored.homepageContent?.faq?.items)
          ? stored.homepageContent!.faq!.items
              .map((item) => ({
                question: String(item?.question || ""),
                answer: String(item?.answer || ""),
              }))
              .filter((item) => item.question || item.answer)
          : base.homepageContent.faq.items,
      },
      stats: {
        backgroundColor: String(stored.homepageContent?.stats?.backgroundColor || base.homepageContent.stats.backgroundColor),
        textColor: String(stored.homepageContent?.stats?.textColor || base.homepageContent.stats.textColor),
        iconColor: String(stored.homepageContent?.stats?.iconColor || base.homepageContent.stats.iconColor),
        items: Array.isArray(stored.homepageContent?.stats?.items)
          ? stored.homepageContent!.stats!.items
              .map((item) => ({
                label: String(item?.label || ""),
                value: Number(item?.value || 0),
                suffix: String(item?.suffix || ""),
              }))
              .filter((item) => item.label)
          : base.homepageContent.stats.items,
      },
      howItWorks: {
        title: String(stored.homepageContent?.howItWorks?.title || base.homepageContent.howItWorks.title),
        subtitle: String(stored.homepageContent?.howItWorks?.subtitle || base.homepageContent.howItWorks.subtitle),
        backgroundColor: String(stored.homepageContent?.howItWorks?.backgroundColor || base.homepageContent.howItWorks.backgroundColor),
        textColor: String(stored.homepageContent?.howItWorks?.textColor || base.homepageContent.howItWorks.textColor),
        steps: Array.isArray(stored.homepageContent?.howItWorks?.steps)
          ? stored.homepageContent!.howItWorks!.steps
              .map((step) => ({
                title: String(step?.title || ""),
                desc: String(step?.desc || ""),
                icon: String(step?.icon || ""),
              }))
              .filter((step) => step.title || step.desc)
          : base.homepageContent.howItWorks.steps,
      },
      whyChooseUs: {
        title: String(stored.homepageContent?.whyChooseUs?.title || base.homepageContent.whyChooseUs.title),
        subtitle: String(stored.homepageContent?.whyChooseUs?.subtitle || base.homepageContent.whyChooseUs.subtitle),
        backgroundColor: String(stored.homepageContent?.whyChooseUs?.backgroundColor || base.homepageContent.whyChooseUs.backgroundColor),
        textColor: String(stored.homepageContent?.whyChooseUs?.textColor || base.homepageContent.whyChooseUs.textColor),
        items: Array.isArray(stored.homepageContent?.whyChooseUs?.items)
          ? stored.homepageContent!.whyChooseUs!.items
              .map((item) => ({
                icon: String(item?.icon || ""),
                title: String(item?.title || ""),
                description: String(item?.description || ""),
              }))
              .filter((item) => item.title || item.description)
          : base.homepageContent.whyChooseUs.items,
      },
      faculty: {
        title: String(stored.homepageContent?.faculty?.title || base.homepageContent.faculty.title),
        subtitle: String(stored.homepageContent?.faculty?.subtitle || base.homepageContent.faculty.subtitle),
        backgroundColor: String(stored.homepageContent?.faculty?.backgroundColor || base.homepageContent.faculty.backgroundColor),
        textColor: String(stored.homepageContent?.faculty?.textColor || base.homepageContent.faculty.textColor),
      },
    },
    exploreCategoryIds: Array.isArray(stored.exploreCategoryIds)
      ? stored.exploreCategoryIds.map((item) => String(item).trim()).filter(Boolean)
      : base.exploreCategoryIds,
    customHomepageSections: Array.isArray(stored.customHomepageSections)
      ? stored.customHomepageSections.map((section: unknown) => {
          const s = section as Partial<HomepageSection> | undefined;
          return {
            id: s?.id || `section-${Date.now()}`,
            type: (["hero", "text", "courses", "features", "banner", "cta", "custom"].includes(String(s?.type)) ? s?.type : "text") as HomepageSection["type"],
            title: String(s?.title || "Untitled Section"),
            subtitle: String(s?.subtitle || ""),
            content: String(s?.content || ""),
            imageUrl: String(s?.imageUrl || ""),
            backgroundColor: String(s?.backgroundColor || "#FFFFFF"),
            textColor: String(s?.textColor || "#000000"),
            fontSize: String(s?.fontSize || "16"),
            fontFamily: String(s?.fontFamily || "sans-serif"),
            order: Number(s?.order || 0),
            insertAfter: HOMEPAGE_SECTION_ANCHORS.includes(String(s?.insertAfter) as HomepageSectionAnchor)
              ? (String(s?.insertAfter) as HomepageSectionAnchor)
              : "faq",
            visible: s?.visible !== false,
            customSettings: (s?.customSettings && typeof s.customSettings === "object") ? s.customSettings : {},
          } as HomepageSection;
        })
      : base.customHomepageSections,
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
  updateFloatingContact: (floatingContact: Partial<SiteSettings["floatingContact"]>) => void;
  updateAnimations: (animations: Partial<SiteSettings["animations"]>) => void;
  updateLogo: (logo: string) => void;
  resetSettings: () => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextType | null>(null);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(() => createDefaultSettings());

  useEffect(() => {
    let mounted = true;

    const loadFromBackend = async () => {
      try {
        const response = await fetch("/api/platform-settings");
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        const backendSettings = payload?.settings?.siteSettings;
        const backendBunny = payload?.settings?.bunnyStreamApi;
        const backendExploreIds = Array.isArray(payload?.settings?.homepage?.exploreCategoryIds)
          ? payload.settings.homepage.exploreCategoryIds.map((item: unknown) => String(item).trim()).filter(Boolean)
          : undefined;

        if (!mounted) return;

        if (!backendSettings || typeof backendSettings !== "object") {
          if (backendExploreIds || (backendBunny && typeof backendBunny === "object")) {
            setSettings((prev) =>
              mergeStoredSettings({
                ...prev,
                bunnyStreamApi: (backendBunny && typeof backendBunny === "object")
                  ? {
                      ...prev.bunnyStreamApi,
                      ...backendBunny,
                    }
                  : prev.bunnyStreamApi,
                exploreCategoryIds: backendExploreIds || prev.exploreCategoryIds,
              }),
            );
          }
          return;
        }

        setSettings((prev) =>
          mergeStoredSettings({
            ...prev,
            ...(backendSettings as Partial<SiteSettings>),
            paymentGateways: ((backendSettings as Partial<SiteSettings>)?.paymentGateways
              || (backendSettings as { paymentGatewaySettings?: PaymentGatewaySettings })?.paymentGatewaySettings
              || prev.paymentGateways) as PaymentGatewaySettings,
            bunnyStreamApi: (backendBunny && typeof backendBunny === "object")
              ? {
                  ...prev.bunnyStreamApi,
                  ...backendBunny,
                }
              : (backendSettings as Partial<SiteSettings>).bunnyStreamApi,
            exploreCategoryIds: backendExploreIds || (backendSettings as Partial<SiteSettings>).exploreCategoryIds,
          }),
        );
      } catch {
        // Keep local settings when backend endpoint is unavailable.
      }
    };

    loadFromBackend();

    return () => {
      mounted = false;
    };
  }, []);

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

  }, [settings]);

  // Apply fonts
  useEffect(() => {
    document.documentElement.style.setProperty("--font-heading", `'${settings.fonts.heading}', sans-serif`);
    document.documentElement.style.setProperty("--font-body", `'${settings.fonts.body}', sans-serif`);
    document.documentElement.style.fontSize = `${settings.fonts.baseSizePx || 16}px`;
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
        showBrandText: header.showBrandText ?? prev.header.showBrandText,
        brandTitle: header.brandTitle ?? prev.header.brandTitle,
        brandSubtitle: header.brandSubtitle ?? prev.header.brandSubtitle,
        navTextColor: header.navTextColor ?? prev.header.navTextColor,
        navHoverBg: header.navHoverBg ?? prev.header.navHoverBg,
        navActiveBg: header.navActiveBg ?? prev.header.navActiveBg,
        solidButtonBg: header.solidButtonBg ?? prev.header.solidButtonBg,
        solidButtonText: header.solidButtonText ?? prev.header.solidButtonText,
        navLinks: header.navLinks
          ? header.navLinks.map((link, index) => normalizeHeaderNavLink(link, index))
          : prev.header.navLinks,
        customButtons: header.customButtons
          ? header.customButtons.map((button, index) => normalizeHeaderButton(button, index))
          : prev.header.customButtons,
        courseCollections: header.courseCollections
          ? header.courseCollections.map((collection, index) => normalizeHeaderCollection(collection, index))
          : prev.header.courseCollections,
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

  const updateFloatingContact = (floatingContact: Partial<SiteSettings["floatingContact"]>) => {
    setSettings((prev) => ({
      ...prev,
      floatingContact: {
        ...prev.floatingContact,
        ...floatingContact,
        enquiry: floatingContact.enquiry
          ? { ...prev.floatingContact.enquiry, ...floatingContact.enquiry }
          : prev.floatingContact.enquiry,
        call: floatingContact.call
          ? { ...prev.floatingContact.call, ...floatingContact.call }
          : prev.floatingContact.call,
        whatsapp: floatingContact.whatsapp
          ? { ...prev.floatingContact.whatsapp, ...floatingContact.whatsapp }
          : prev.floatingContact.whatsapp,
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
  };

  return (
    <SiteSettingsContext.Provider value={{ settings, updateSettings, updateColors, updateFonts, updateSections, updateHeader, updateMobileFooter, updateFloatingContact, updateAnimations, updateLogo, resetSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  return ctx;
}
