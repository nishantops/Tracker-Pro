/// <reference types="vite/client" />

interface ImportMetaEnv {
  // App Identity
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_TAGLINE: string;
  readonly VITE_DEVELOPER_NAME: string;
  readonly VITE_HEADER_AVATAR: string;

  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Admin / Auth
  readonly VITE_ADMIN_EMAIL: string;
  readonly VITE_SUPERUSER_EMAIL: string;
  readonly VITE_SUPERUSER_ALIAS: string;

  // Session
  readonly VITE_AUTO_LOGOUT_MS: string;
  readonly VITE_SESSION_CHECK_INTERVAL_MS: string;

  // Messaging
  readonly VITE_DEFAULT_DAILY_MSG_LIMIT: string;
  readonly VITE_WEEKLY_FEEDBACK_DAYS: string;
  readonly VITE_MSG_UNREAD_POLL_MS: string;

  // Plan Table
  readonly VITE_PT_DEBOUNCE_MS: string;
  readonly VITE_PT_MAX_ZOOM: string;
  readonly VITE_PT_MIN_ZOOM: string;

  // Gantt
  readonly VITE_GANTT_MAX_UNITS: string;

  // Metrics
  readonly VITE_METRICS_FLUSH_MS: string;

  // AI
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_GEMINI_MODEL: string;
  readonly VITE_GEMINI_BASE_URL: string;
  readonly VITE_AI_HISTORY_LIMIT: string;
  readonly VITE_AI_CONTEXT_WINDOW: string;
  readonly VITE_AI_MAX_OUTPUT_TOKENS: string;
  readonly VITE_AI_TEMPERATURE: string;

  // Plan Grid
  readonly VITE_PLAN_GRID_COLS: string;
  readonly VITE_PLAN_CARD_DEFAULT_W: string;
  readonly VITE_PLAN_CARD_DEFAULT_H: string;
  readonly VITE_PLAN_CARD_MIN_W: string;
  readonly VITE_PLAN_CARD_MIN_H: string;
  readonly VITE_PLAN_ROW_HEIGHT: string;
  readonly VITE_PLAN_GRID_MARGIN: string;
  readonly VITE_PLAN_LAYOUT_DEBOUNCE_MS: string;

  // Source Grid
  readonly VITE_SOURCE_GRID_COLS: string;
  readonly VITE_SOURCE_CARD_DEFAULT_W: string;
  readonly VITE_SOURCE_CARD_DEFAULT_H: string;
  readonly VITE_SOURCE_CARD_MIN_W: string;
  readonly VITE_SOURCE_CARD_MIN_H: string;
  readonly VITE_SOURCE_ROW_HEIGHT: string;
  readonly VITE_SOURCE_GRID_MARGIN: string;
  readonly VITE_SOURCE_LAYOUT_DEBOUNCE_MS: string;

  // Cache TTLs
  readonly VITE_TRACKER_CACHE_TTL_MS: string;
  readonly VITE_PLANS_CACHE_TTL_MS: string;

  // Exam Dates
  readonly VITE_PRELIMS_DATE: string;
  readonly VITE_MAINS_DATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
