const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getBrowserOrigin = () => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const joinBaseAndPath = (base: string, path: string) => {
  if (!base) return path;
  const normalizedBase = trimTrailingSlash(base);
  return `${normalizedBase}${path}`;
};

const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || "");
const UPLOADS_BASE_URL = trimTrailingSlash(import.meta.env.VITE_UPLOADS_BASE_URL || API_BASE_URL);
const LEGACY_PORTAL_API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_LEGACY_PORTAL_API_BASE_URL || "");
const LEGACY_PORTAL_API_FALLBACK_URLS = String(import.meta.env.VITE_LEGACY_PORTAL_API_FALLBACK_URLS || "")
  .split(",")
  .map((item) => trimTrailingSlash(item.trim()))
  .filter(Boolean);

const buildSameOriginReplacement = (value: string) => {
  if (!isHttpUrl(value)) return value;

  try {
    const browserOrigin = getBrowserOrigin();
    if (!browserOrigin) return value;

    const parsed = new URL(value);
    if (parsed.origin !== browserOrigin) return value;

    const nextPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return resolveRuntimeUrl(nextPath);
  } catch {
    return value;
  }
};

export const resolveApiUrl = (path: string) => {
  if (!path) return path;
  if (isHttpUrl(path)) return buildSameOriginReplacement(path);
  if (path === "/api" || path.startsWith("/api/")) {
    return joinBaseAndPath(API_BASE_URL, path);
  }
  return path;
};

export const resolveUploadsUrl = (path: string) => {
  if (!path) return path;
  if (isHttpUrl(path)) return buildSameOriginReplacement(path);

  if (path === "/uploads" || path.startsWith("/uploads/")) {
    return joinBaseAndPath(UPLOADS_BASE_URL, path);
  }

  if (path === "/api/uploads" || path.startsWith("/api/uploads/")) {
    const normalizedPath = path.replace(/^\/api/, "");
    return joinBaseAndPath(UPLOADS_BASE_URL, normalizedPath);
  }

  return path;
};

export const resolveRuntimeUrl = (value: string) => {
  if (!value) return value;
  if (isHttpUrl(value)) return buildSameOriginReplacement(value);
  if (value === "/api" || value.startsWith("/api/")) return resolveApiUrl(value);
  if (value === "/uploads" || value.startsWith("/uploads/")) return resolveUploadsUrl(value);
  if (value === "/api/uploads" || value.startsWith("/api/uploads/")) return resolveUploadsUrl(value);
  return value;
};

export const resolveUploadAssetUrl = (value?: string, fallback = "") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return fallback;
  if (isHttpUrl(normalizedValue)) return normalizedValue;

  // Database-backed image uploads are served via API route, not /uploads static path.
  if (normalizedValue.startsWith("api/uploads/storage/")) return resolveApiUrl(`/${normalizedValue}`);
  if (normalizedValue.startsWith("/api/uploads/storage/")) return resolveApiUrl(normalizedValue);

  if (normalizedValue.startsWith("uploads/")) return resolveUploadsUrl(`/${normalizedValue}`);
  if (normalizedValue.startsWith("/uploads/")) return resolveUploadsUrl(normalizedValue);

  if (normalizedValue.startsWith("api/uploads/storage?")) {
    const query = normalizedValue.split("?")[1] || "";
    const storagePath = new URLSearchParams(query).get("path");
    if (!storagePath) return resolveApiUrl(`/${normalizedValue}`);
    const localPath = storagePath.replace(/^images\//, "");
    return resolveUploadsUrl(`/uploads/${localPath}`);
  }

  if (normalizedValue.startsWith("/api/uploads/storage?")) {
    const query = normalizedValue.split("?")[1] || "";
    const storagePath = new URLSearchParams(query).get("path");
    if (!storagePath) return resolveApiUrl(normalizedValue);
    const localPath = storagePath.replace(/^images\//, "");
    return resolveUploadsUrl(`/uploads/${localPath}`);
  }

  if (normalizedValue.startsWith("api/uploads/")) return resolveUploadsUrl(`/${normalizedValue}`);
  if (normalizedValue.startsWith("/api/uploads/")) return resolveUploadsUrl(normalizedValue);
  return normalizedValue;
};

export const getLegacyPortalApiBases = () => {
  if (LEGACY_PORTAL_API_BASE_URL) {
    return [LEGACY_PORTAL_API_BASE_URL, ...LEGACY_PORTAL_API_FALLBACK_URLS];
  }

  return [
    "https://letsednovate.com/Portal/apiweb",
    "http://letsednovate.com/Portal/apiweb",
    ...LEGACY_PORTAL_API_FALLBACK_URLS,
  ];
};