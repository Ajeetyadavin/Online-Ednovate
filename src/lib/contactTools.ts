export interface EnquiryLead {
  id: string;
  name: string;
  location: string;
  mobile: string;
  createdAt: string;
}

export const ENQUIRY_LEADS_STORAGE_KEY = "ednovate_enquiry_leads";
export const ENQUIRY_LEADS_UPDATED_EVENT = "ednovate:enquiry-leads-updated";

const isBrowser = () => typeof window !== "undefined";

const notifyLeadListeners = () => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(ENQUIRY_LEADS_UPDATED_EVENT));
};

const readStoredLeads = (): EnquiryLead[] => {
  if (!isBrowser()) {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(ENQUIRY_LEADS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Partial<EnquiryLead> => Boolean(item && typeof item === "object"))
      .map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || ""),
        location: String(item.location || ""),
        mobile: String(item.mobile || ""),
        createdAt: String(item.createdAt || ""),
      }))
      .filter((item) => item.id && item.name && item.mobile && item.createdAt);
  } catch {
    return [];
  }
};

const writeStoredLeads = (leads: EnquiryLead[]) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(ENQUIRY_LEADS_STORAGE_KEY, JSON.stringify(leads));
  notifyLeadListeners();
};

export const getEnquiryLeads = () =>
  readStoredLeads().sort(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );

export const createEnquiryLead = (lead: Omit<EnquiryLead, "id" | "createdAt">) => {
  const nextLead: EnquiryLead = {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `lead-${Date.now()}`,
    name: lead.name.trim(),
    location: lead.location.trim(),
    mobile: lead.mobile.trim(),
    createdAt: new Date().toISOString(),
  };

  writeStoredLeads([nextLead, ...getEnquiryLeads()]);
  return nextLead;
};

export const deleteEnquiryLead = (id: string) => {
  writeStoredLeads(getEnquiryLeads().filter((lead) => lead.id !== id));
};

export const clearEnquiryLeads = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(ENQUIRY_LEADS_STORAGE_KEY);
  notifyLeadListeners();
};

export const normalizePhoneDigits = (value: string) => value.replace(/\D/g, "");

export const sanitizeHexColor = (value: string, fallback: string) => {
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
};

export const getReadableTextColor = (value: string) => {
  const hex = sanitizeHexColor(value, "#1E3A5F").replace("#", "");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#0F172A" : "#FFFFFF";
};

export const formatEnquiryLeadDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};