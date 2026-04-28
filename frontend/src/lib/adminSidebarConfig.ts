import type { AdminModuleKey } from "@/context/AdminAuthContext";

export type AdminSidebarIconName =
  | "dashboard"
  | "courses"
  | "courseContent"
  | "bunnyVideo"
  | "masters"
  | "coupons"
  | "faculty"
  | "homepage"
  | "header"
  | "users"
  | "orders"
  | "leads"
  | "announcements"
  | "technicalSupport"
  | "marketing"
  | "settings"
  | "subadmins"
  | "logs"
  | "apis"
  | "crackit";

export interface AdminSidebarDefinition {
  id: string;
  to: string;
  defaultLabel: string;
  moduleKey: AdminModuleKey;
  iconName: AdminSidebarIconName;
}

export interface AdminSidebarItemConfig {
  id: string;
  label: string;
  enabled: boolean;
  visible: boolean;
  order: number;
}

export const ADMIN_SIDEBAR_STORAGE_KEY = "ednovate_admin_sidebar_v1";

export const ADMIN_SIDEBAR_DEFINITIONS: AdminSidebarDefinition[] = [
  { id: "dashboard", to: "/admin/dashboard", defaultLabel: "Dashboard", moduleKey: "dashboard", iconName: "dashboard" },
  { id: "homepage", to: "/admin/homepage", defaultLabel: "Home Page", moduleKey: "homepage", iconName: "homepage" },
  { id: "subadmins", to: "/admin/subadmins", defaultLabel: "Admins", moduleKey: "subadmins", iconName: "subadmins" },
  { id: "masters", to: "/admin/masters", defaultLabel: "Masters", moduleKey: "masters", iconName: "masters" },
  { id: "course-content", to: "/admin/course-content", defaultLabel: "Videos", moduleKey: "course-content", iconName: "courseContent" },
  { id: "courses", to: "/admin/courses", defaultLabel: "Courses", moduleKey: "courses", iconName: "courses" },
  { id: "users", to: "/admin/users", defaultLabel: "Users", moduleKey: "users", iconName: "users" },
  { id: "settings", to: "/admin/settings", defaultLabel: "Settings", moduleKey: "settings", iconName: "settings" },
  { id: "packages", to: "/admin/packages", defaultLabel: "Packages", moduleKey: "courses", iconName: "courses" },
  { id: "header", to: "/admin/header", defaultLabel: "Header", moduleKey: "homepage", iconName: "header" },
  { id: "announcements", to: "/admin/announcements", defaultLabel: "Notifications", moduleKey: "announcements", iconName: "announcements" },
  { id: "faculty", to: "/admin/faculty", defaultLabel: "Professors", moduleKey: "faculty", iconName: "faculty" },
  { id: "bunny-video", to: "/admin/bunny-video", defaultLabel: "Bunny Video", moduleKey: "settings", iconName: "bunnyVideo" },
  { id: "coupons", to: "/admin/coupons", defaultLabel: "Coupons", moduleKey: "coupons", iconName: "coupons" },
  { id: "orders", to: "/admin/orders", defaultLabel: "Sales", moduleKey: "orders", iconName: "orders" },
  { id: "leads", to: "/admin/leads", defaultLabel: "Call Requests", moduleKey: "leads", iconName: "leads" },
  { id: "technical-support", to: "/admin/technical-support", defaultLabel: "Technical Support", moduleKey: "technical-support", iconName: "technicalSupport" },
  { id: "marketing", to: "/admin/marketing", defaultLabel: "Marketing", moduleKey: "marketing", iconName: "marketing" },
  { id: "logs", to: "/admin/logs", defaultLabel: "Reports", moduleKey: "logs", iconName: "logs" },
  { id: "apis", to: "/admin/apis", defaultLabel: "API Module", moduleKey: "settings", iconName: "apis" },
  { id: "crackit", to: "/admin/crackit/questions", defaultLabel: "Crack It", moduleKey: "crackit", iconName: "crackit" },
  { id: "crackit-questions", to: "/admin/crackit/questions", defaultLabel: "Question Bank", moduleKey: "crackit", iconName: "crackit" },
  { id: "crackit-papers", to: "/admin/crackit/papers", defaultLabel: "Create Paper", moduleKey: "crackit", iconName: "crackit" },
];

const withSortedOrder = (items: AdminSidebarItemConfig[]): AdminSidebarItemConfig[] =>
  [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

const SIDEBAR_SEQUENCE_PRIORITY = new Map(
  ADMIN_SIDEBAR_DEFINITIONS.map((definition, index) => [definition.id, index]),
);

export const buildDefaultAdminSidebarConfig = (): AdminSidebarItemConfig[] =>
  ADMIN_SIDEBAR_DEFINITIONS.map((definition, index) => ({
    id: definition.id,
    label: definition.defaultLabel,
    enabled: true,
    visible: true,
    order: index,
  }));

export const normalizeAdminSidebarConfig = (raw: unknown): AdminSidebarItemConfig[] => {
  const defaults = buildDefaultAdminSidebarConfig();

  if (!Array.isArray(raw)) {
    return defaults;
  }

  const incomingMap = new Map<string, AdminSidebarItemConfig>();
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const next = item as Partial<AdminSidebarItemConfig>;
    const id = String(next.id || "").trim();
    if (!id) return;
    incomingMap.set(id, {
      id,
      label: String(next.label || "").trim(),
      enabled: next.enabled !== false,
      visible: next.visible !== false,
      order: Number.isFinite(Number(next.order)) ? Number(next.order) : index,
    });
  });

  const merged = defaults.map((base, index) => {
    const incoming = incomingMap.get(base.id);
    if (!incoming) return base;

    const isProtectedSettings = base.id === "settings";
    const incomingLabel = incoming.label || "";
    const migratedLabel = (() => {
      if (base.id === "course-content" && incomingLabel === "Course Content") {
        return "Videos";
      }
      if (base.id === "homepage" && (incomingLabel === "Homepage Content" || incomingLabel === "Homepage")) {
        return "Home Page";
      }
      if (base.id === "orders" && incomingLabel === "Orders") {
        return "Sales";
      }
      if (base.id === "subadmins" && incomingLabel === "Sub Admins") {
        return "Admins";
      }
      if (base.id === "users" && incomingLabel === "Students") {
        return "Users";
      }
      if (base.id === "logs" && incomingLabel === "Activity Logs") {
        return "Reports";
      }
      if (base.id === "leads" && incomingLabel === "Leads") {
        return "Call Requests";
      }
      if (base.id === "announcements" && incomingLabel === "Announcements") {
        return "Notifications";
      }
      if (base.id === "header" && incomingLabel === "Header Module") {
        return "Header";
      }
      if (base.id === "faculty" && incomingLabel === "Faculty") {
        return "Professors";
      }
      if (base.id === "masters" && incomingLabel === "Master") {
        return "Masters";
      }
      return incomingLabel;
    })();

    return {
      ...base,
      label: migratedLabel || base.label,
      enabled: isProtectedSettings ? true : incoming.enabled,
      visible: isProtectedSettings ? true : incoming.visible,
      order: Number.isFinite(incoming.order) ? incoming.order : index,
    };
  });

  const sequenced = [...merged].sort((a, b) => {
    const priorityA = SIDEBAR_SEQUENCE_PRIORITY.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const priorityB = SIDEBAR_SEQUENCE_PRIORITY.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.order - b.order;
  });

  return withSortedOrder(sequenced);
};

export const getConfiguredAdminSidebarItems = (config: AdminSidebarItemConfig[]) => {
  const normalized = normalizeAdminSidebarConfig(config);
  const configMap = new Map(normalized.map((item) => [item.id, item]));

  return ADMIN_SIDEBAR_DEFINITIONS.map((definition, index) => {
    const pref = configMap.get(definition.id);
    const isProtectedSettings = definition.id === "settings";
    return {
      ...definition,
      label: pref?.label || definition.defaultLabel,
      enabled: isProtectedSettings ? true : pref?.enabled !== false,
      visible: isProtectedSettings ? true : pref?.visible !== false,
      order: Number.isFinite(pref?.order) ? Number(pref?.order) : index,
    };
  }).sort((a, b) => a.order - b.order);
};

export const reorderAdminSidebarConfig = (items: AdminSidebarItemConfig[]): AdminSidebarItemConfig[] =>
  withSortedOrder(items);
