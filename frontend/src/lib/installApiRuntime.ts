import { resolveRuntimeUrl } from "@/lib/runtimeUrls";

let isInstalled = false;

const rewriteRequestInput = (input: RequestInfo | URL): RequestInfo | URL => {
  if (typeof input === "string") {
    return resolveRuntimeUrl(input);
  }

  if (input instanceof URL) {
    return new URL(resolveRuntimeUrl(input.toString()));
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    const nextUrl = resolveRuntimeUrl(input.url);
    if (nextUrl === input.url) return input;
    return new Request(nextUrl, input);
  }

  return input;
};

export const installApiRuntime = () => {
  if (isInstalled || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    return nativeFetch(rewriteRequestInput(input), init);
  }) as typeof window.fetch;

  isInstalled = true;
};