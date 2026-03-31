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
  | "studentAccess"
  | "orders"
  | "leads"
  | "announcements"
  | "technicalSupport"
  | "marketing"
  | "settings"
  | "subadmins"
  | "logs"
  | "apis";

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
  { id: "courses", to: "/admin/courses", defaultLabel: "Courses", moduleKey: "courses", iconName: "courses" },
  { id: "course-content", to: "/admin/course-content", defaultLabel: "Video", moduleKey: "course-content", iconName: "courseContent" },
  { id: "bunny-video", to: "/admin/bunny-video", defaultLabel: "Bunny Video", moduleKey: "settings", iconName: "bunnyVideo" },
  { id: "masters", to: "/admin/masters", defaultLabel: "Master", moduleKey: "masters", iconName: "masters" },
  { id: "coupons", to: "/admin/coupons", defaultLabel: "Coupons", moduleKey: "coupons", iconName: "coupons" },
  { id: "faculty", to: "/admin/faculty", defaultLabel: "Faculty", moduleKey: "faculty", iconName: "faculty" },
  { id: "homepage", to: "/admin/homepage", defaultLabel: "Homepage", moduleKey: "homepage", iconName: "homepage" },
  { id: "header", to: "/admin/header", defaultLabel: "Header Module", moduleKey: "homepage", iconName: "header" },
  { id: "users", to: "/admin/users", defaultLabel: "Students", moduleKey: "users", iconName: "users" },
  { id: "student-access", to: "/admin/student-access", defaultLabel: "Student Access", moduleKey: "users", iconName: "studentAccess" },
  { id: "orders", to: "/admin/orders", defaultLabel: "Orders", moduleKey: "orders", iconName: "orders" },
  { id: "leads", to: "/admin/leads", defaultLabel: "Leads", moduleKey: "leads", iconName: "leads" },
  { id: "announcements", to: "/admin/announcements", defaultLabel: "Announcements", moduleKey: "announcements", iconName: "announcements" },
  { id: "technical-support", to: "/admin/technical-support", defaultLabel: "Technical Support", moduleKey: "technical-support", iconName: "technicalSupport" },
  { id: "marketing", to: "/admin/marketing", defaultLabel: "Marketing", moduleKey: "marketing", iconName: "marketing" },
  { id: "settings", to: "/admin/settings", defaultLabel: "Settings", moduleKey: "settings", iconName: "settings" },
  { id: "subadmins", to: "/admin/subadmins", defaultLabel: "Sub Admins", moduleKey: "subadmins", iconName: "subadmins" },
  { id: "logs", to: "/admin/logs", defaultLabel: "Activity Logs", moduleKey: "logs", iconName: "logs" },
  { id: "apis", to: "/admin/apis", defaultLabel: "API Module", moduleKey: "settings", iconName: "apis" },
];

const withSortedOrder = (items: AdminSidebarItemConfig[]): AdminSidebarItemConfig[] =>
  [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

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
        return "Video";
      }
      if (base.id === "homepage" && incomingLabel === "Homepage Content") {
        return "Homepage";
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

  return withSortedOrder(merged);
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
