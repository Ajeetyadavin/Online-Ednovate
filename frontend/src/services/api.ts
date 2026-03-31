import { getLegacyPortalApiBases } from "@/lib/runtimeUrls";

type ApiMethod = "GET" | "POST";
type ApiParams = Record<string, string | number | boolean | null | undefined>;

const REMOTE_API_BASES = getLegacyPortalApiBases();

const DEV_PROXY_BASE = "/portal-api";

const isLocalhostEnv = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
};

const getApiBases = () => {
  if (isLocalhostEnv()) {
    return [DEV_PROXY_BASE, ...REMOTE_API_BASES];
  }

  return REMOTE_API_BASES;
};

const toQueryString = (params: ApiParams = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
};

async function callApi(endpoint: string, method: ApiMethod = "POST", params: ApiParams = {}) {
  let lastError = "Unknown error";

  // Keep the same fallback behavior used by the old edge function.
  for (const base of getApiBases()) {
    try {
      const url = `${base}/${endpoint}`;
      const query = toQueryString(params);

      const response = method === "POST"
        ? await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: query,
          })
        : await fetch(query ? `${url}?${query}` : url, {
            method: "GET",
          });

      const text = await response.text();

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 2000) };
      }

      return {
        upstream_status: response.status,
        base_used: base,
        data,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { error: `All bases failed. Last error: ${lastError}`, endpoint };
}

export const api = {
  get: (endpoint: string, params?: ApiParams) => callApi(endpoint, "GET", params),
  post: (endpoint: string, params?: ApiParams) => callApi(endpoint, "POST", params),
};

const TEST_ENDPOINTS = [
  // Working with data
  "banner", "testimonial", "master_data", "get_subject",
  "why_ednovate", "six_pillar", "our_course",
  "about_us", "our_ceo", "leadership_team", "learn_with_ednovate",
  "top_ranker", "student_feedback", "achievers", "demo_lecture",
  "landing_header", "get_community", "event_category",
  "branch_state", "get_states", "get_city",
  // May need params
  "popular_course", "announcement", "login", "contact_us",
];

export const testAllEndpoints = async (
  onProgress: (done: number, total: number, endpoint: string) => void
) => {
  const results: Record<string, any> = {};
  const total = TEST_ENDPOINTS.length;

  for (let i = 0; i < total; i++) {
    const ep = TEST_ENDPOINTS[i];
    onProgress(i + 1, total, ep);
    
    // Try POST first
    const result = await callApi(ep, "POST");
    if (result && !result.error) {
      results[ep] = { ...result, method: "POST" };
    } else {
      // Try GET
      const getResult = await callApi(ep, "GET");
      if (getResult && !getResult.error) {
        results[ep] = { ...getResult, method: "GET" };
      } else {
        results[ep] = { error: result?.error || getResult?.error || "Unknown", method: "both failed" };
      }
    }
  }

  return results;
};

export { TEST_ENDPOINTS };
