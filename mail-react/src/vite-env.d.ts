/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_BASE_URL: string;
  readonly VITE_PWA_NAME: string;
  readonly VITE_STATIC_URL?: string;
  readonly VITE_OUT_DIR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}