/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional demo key baked into the service worker at build time (from the git-ignored `.env.local`).
   * Anyone who has the built extension can read it — see docs/06 "Demo key".
   */
  readonly VITE_EMBEDDED_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
