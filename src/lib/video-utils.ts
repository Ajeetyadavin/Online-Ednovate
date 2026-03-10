export type LessonVideoSource = "direct" | "youtube" | "upload";

const VIDEO_CIPHER_PREFIX = "encv1:";

const encodeToBase64 = (value: string): string => {
  if (typeof window === "undefined") return value;

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const decodeFromBase64 = (value: string): string => {
  if (typeof window === "undefined") return value;

  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeVideoUrl = (value: string): string => {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.startsWith(VIDEO_CIPHER_PREFIX)) return clean;

  try {
    return `${VIDEO_CIPHER_PREFIX}${encodeToBase64(clean)}`;
  } catch {
    return clean;
  }
};

export const decodeVideoUrl = (value: string): string => {
  const clean = value.trim();
  if (!clean) return "";
  if (!clean.startsWith(VIDEO_CIPHER_PREFIX)) return clean;

  const payload = clean.slice(VIDEO_CIPHER_PREFIX.length);
  try {
    return decodeFromBase64(payload);
  } catch {
    return "";
  }
};

export const isEncodedVideoUrl = (value: string): boolean =>
  value.trim().startsWith(VIDEO_CIPHER_PREFIX);

export const extractYouTubeVideoId = (input: string): string | null => {
  const clean = input.trim();
  if (!clean) return null;

  // If direct video id is provided
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  try {
    const url = new URL(clean);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && id.length >= 11 ? id.slice(0, 11) : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (watchId && watchId.length >= 11) return watchId.slice(0, 11);

      const parts = url.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
      if (embedIndex !== -1) {
        const id = parts[embedIndex + 1];
        if (id && id.length >= 11) return id.slice(0, 11);
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const getYouTubeEmbedUrl = (input: string): string | null => {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
};

export const detectVideoSource = (input: string): LessonVideoSource => {
  const decoded = decodeVideoUrl(input);
  if (!decoded) return "direct";

  if (extractYouTubeVideoId(decoded)) return "youtube";
  if (decoded.startsWith("data:video/")) return "upload";
  return "direct";
};
