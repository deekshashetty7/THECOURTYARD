/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OAUTH_REDIRECT_BASE_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}