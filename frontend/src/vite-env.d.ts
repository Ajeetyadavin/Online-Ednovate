/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_UPLOADS_BASE_URL?: string;
	readonly VITE_LEGACY_PORTAL_API_BASE_URL?: string;
	readonly VITE_LEGACY_PORTAL_API_FALLBACK_URLS?: string;
	readonly VITE_DEV_API_PROXY_TARGET?: string;
	readonly VITE_DEV_UPLOADS_PROXY_TARGET?: string;
	readonly VITE_LEGACY_PORTAL_PROXY_TARGET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
