/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __SF_LOGIN_URL__: string
declare const __SF_CLIENT_ID__: string
declare const __SF_REDIRECT_URI__: string
declare const __SF_SCOPES__: string
declare const __SF_ALIAS_NAME__: string
