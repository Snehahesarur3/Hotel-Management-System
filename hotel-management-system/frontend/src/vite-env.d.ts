/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_MOCK_API_ENABLED: string
  readonly VITE_MOCK_LATENCY_MS?: string
  /** IANA zone of the hotel, e.g. Asia/Kolkata; must match the backend's app.timezone. */
  readonly VITE_HOTEL_TIMEZONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
