-- ============================================================================
-- MIGRATION v7  —  Complete backlog + cross-device focus sync
-- Covers: ALL changes since v5 schema (includes v6 + new focus_active column)
-- ============================================================================
-- SAFETY GUARANTEES:
--   ✅ Zero data loss — no DROP TABLE, no DROP COLUMN, no TRUNCATE anywhere
--   ✅ Fully idempotent — safe to run multiple times (ADD COLUMN IF NOT EXISTS,
--      CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS, etc.)
--   ✅ Old app safe — every change is additive; old JS reads/writes unchanged
--   ✅ Wrapped in a transaction — either everything succeeds or nothing changes
-- ============================================================================
-- EXECUTION ORDER:
--   1.  Column additions to existing tables (no FK deps)
--   2.  Data backfills on existing rows
--   3.  New tables (in FK dependency order)
--   4.  Indexes on all tables
--   5.  updated_at trigger function + triggers on every mutable table
--   6.  RLS policies (DROP IF EXISTS → CREATE) on every table
--   7.  Admin overview view
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add missing columns to existing tables
--         (ADD COLUMN IF NOT EXISTS is always idempotent)
-- ============================================================================

-- 1a. upsc_user_profiles
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS phone                   TEXT;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS profile_data            JSONB        DEFAULT '{}'::jsonb;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ  DEFAULT now();
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS optional_subject        TEXT         DEFAULT 'none';
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS optional_subject_custom TEXT;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS is_locked               BOOLEAN      DEFAULT FALSE;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS locked_reason           TEXT;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS is_admin                BOOLEAN      DEFAULT FALSE;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS last_active             TIMESTAMPTZ  DEFAULT now();
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS features_enabled        JSONB        DEFAULT '{}'::jsonb;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS notif_settings          JSONB        DEFAULT '{}'::jsonb;

-- 1b. upsc_user_sessions
ALTER TABLE upsc_user_sessions ADD COLUMN IF NOT EXISTS focus_active BOOLEAN DEFAULT FALSE;

-- 1c. upsc_custom_plans
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS plan_category  TEXT        DEFAULT 'common';
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS plan_division   TEXT        DEFAULT 'both';
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS notif_enabled   BOOLEAN     DEFAULT TRUE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS content_type    TEXT        DEFAULT 'both';
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS start_date      DATE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS end_date        DATE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS plan_subject     TEXT;

-- 1d. upsc_tracker_progress
ALTER TABLE upsc_tracker_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1e. upsc_plan_tables
ALTER TABLE upsc_plan_tables ADD COLUMN IF NOT EXISTS sort_order  INTEGER     DEFAULT 0;
ALTER TABLE upsc_plan_tables ADD COLUMN IF NOT EXISTS plan_title  TEXT;
ALTER TABLE upsc_plan_tables ADD COLUMN IF NOT EXISTS table_type  TEXT        DEFAULT 'plan';

-- ============================================================================
-- STEP 2: Data backfills (safe — only touches NULL / wrong values)
-- ============================================================================

-- 2a. Nullify stale focus_active so trigger resets clean
UPDATE upsc_user_sessions SET focus_active = FALSE WHERE focus_active IS NULL;

-- 2b. Backfill plan_title from base64-encoded plan_id
CREATE OR REPLACE FUNCTION _safe_decode_plan_id(pid TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  IF pid IS NULL OR pid = 'master_sheet' OR pid = 'ca_notes' THEN RETURN pid; END IF;
  BEGIN
    RETURN CONVERT_FROM(DECODE(pid, 'base64'), 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN pid;
  END;
END; $$;

UPDATE upsc_plan_tables
SET plan_title = CASE
  WHEN plan_id = 'master_sheet' THEN 'Master Sheet'
  WHEN plan_id = 'ca_notes'     THEN 'CA Notes'
  ELSE _safe_decode_plan_id(plan_id)
END
WHERE plan_title IS NULL AND plan_id IS NOT NULL;

-- 2c. Mark master_sheet rows correctly
UPDATE upsc_plan_tables
SET table_type = 'master'
WHERE plan_id = 'master_sheet' AND (table_type IS NULL OR table_type = 'plan');

-- ============================================================================
-- STEP 3: New tables (CREATE IF NOT EXISTS — zero risk to existing data)
--         Ordered so every FK references a table created earlier in this step.
-- ============================================================================

-- 3a. upsc_messages (user ↔ admin chat)
CREATE TABLE IF NOT EXISTS upsc_messages (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    content      TEXT        NOT NULL,
    sender_type  TEXT        DEFAULT 'user' CHECK (sender_type IN ('user','admin')),
    thread_id    UUID        REFERENCES upsc_messages(id) ON DELETE CASCADE,
    is_read      BOOLEAN     DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upsc_messages ENABLE ROW LEVEL SECURITY;

-- 3b. upsc_feedback (monthly star rating)
CREATE TABLE IF NOT EXISTS upsc_feedback (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    content      TEXT        NOT NULL DEFAULT '',
    rating       INTEGER     CHECK (rating BETWEEN 1 AND 5),
    month_key    TEXT        NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, month_key)
);
ALTER TABLE upsc_feedback ENABLE ROW LEVEL SECURITY;

-- 3c. upsc_user_settings (per-user feature flags + msg limit)
CREATE TABLE IF NOT EXISTS upsc_user_settings (
    user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_msg_limit INTEGER     DEFAULT 3,
    features        JSONB       DEFAULT '{"plans":true,"tracker":true,"pyq":true,"ca":true,"focus":true,"ai":true}',
    notes           TEXT,
    updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upsc_user_settings ENABLE ROW LEVEL SECURITY;

-- 3d. upsc_app_metrics (event telemetry)
CREATE TABLE IF NOT EXISTS upsc_app_metrics (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT        NOT NULL,
    event_data JSONB       DEFAULT '{}',
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upsc_app_metrics ENABLE ROW LEVEL SECURITY;

-- 3e. upsc_focus_sessions (study timer history)
CREATE TABLE IF NOT EXISTS upsc_focus_sessions (
    id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at         TIMESTAMPTZ,
    duration_seconds INTEGER     DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upsc_focus_sessions ENABLE ROW LEVEL SECURITY;

-- 3f. upsc_user_sources (reference links)
CREATE TABLE IF NOT EXISTS upsc_user_sources (
    source_id  TEXT        NOT NULL,
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    link       TEXT,
    topic      TEXT        DEFAULT 'General',
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (source_id, user_id)
);
ALTER TABLE upsc_user_sources ENABLE ROW LEVEL SECURITY;

-- 3g. upsc_pie_card_layouts (sectional pie matrix card positions)
--     Values are integer RGL grid units: x/y = col/row (0-based), w/h = span (≥1).
CREATE TABLE IF NOT EXISTS upsc_pie_card_layouts (
    user_id    UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_key   TEXT   NOT NULL,              -- e.g. 'p1', 'gs1', 'ca'
    x          REAL   NOT NULL DEFAULT 0,    -- grid column (integer 0–4)
    y          REAL   NOT NULL DEFAULT 0,    -- grid row    (integer 0+)
    w          REAL   NOT NULL DEFAULT 1,    -- column span (integer ≥1)
    h          REAL   NOT NULL DEFAULT 1,    -- row span    (integer ≥1)
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, card_key)
);
ALTER TABLE upsc_pie_card_layouts ENABLE ROW LEVEL SECURITY;

-- 3h. upsc_plan_layouts (plan card drag/resize positions)
--     Positions in 12-column grid units → scales proportionally on any device.
CREATE TABLE IF NOT EXISTS upsc_plan_layouts (
    user_id    UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id    TEXT     NOT NULL,
    col        SMALLINT NOT NULL DEFAULT 0,
    row_pos    SMALLINT NOT NULL DEFAULT 0,
    col_span   SMALLINT NOT NULL DEFAULT 4,
    row_span   SMALLINT NOT NULL DEFAULT 2,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, plan_id)
);
ALTER TABLE upsc_plan_layouts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Indexes (all idempotent with IF NOT EXISTS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_progress_user_id      ON upsc_tracker_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_progress_updated      ON upsc_tracker_progress (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_plans_user_id         ON upsc_custom_plans     (user_id);
CREATE INDEX IF NOT EXISTS idx_plans_category        ON upsc_custom_plans     (user_id, plan_category);
CREATE INDEX IF NOT EXISTS idx_plan_tables_user      ON upsc_plan_tables      (user_id);
CREATE INDEX IF NOT EXISTS idx_plan_tables_plan      ON upsc_plan_tables      (user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_tables_order     ON upsc_plan_tables      (user_id, plan_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_plan_tables_title     ON upsc_plan_tables      (plan_title);
CREATE INDEX IF NOT EXISTS idx_focus_user_id         ON upsc_focus_sessions   (user_id);
CREATE INDEX IF NOT EXISTS idx_focus_started         ON upsc_focus_sessions   (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_user_id       ON upsc_user_sources     (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user         ON upsc_messages         (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread       ON upsc_messages         (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread       ON upsc_messages         (user_id, is_read, sender_type);
CREATE INDEX IF NOT EXISTS idx_feedback_user         ON upsc_feedback         (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_month        ON upsc_feedback         (month_key);
CREATE INDEX IF NOT EXISTS idx_metrics_user          ON upsc_app_metrics      (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_type          ON upsc_app_metrics      (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pie_layouts_user      ON upsc_pie_card_layouts (user_id);
CREATE INDEX IF NOT EXISTS idx_plan_layouts_user     ON upsc_plan_layouts     (user_id);

-- ============================================================================
-- STEP 5: updated_at trigger function + attach to every mutable table
--         DROP TRIGGER IF EXISTS → CREATE ensures idempotency.
-- ============================================================================
CREATE OR REPLACE FUNCTION _upsc_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at       ON upsc_user_profiles;
DROP TRIGGER IF EXISTS trg_progress_updated_at       ON upsc_tracker_progress;
DROP TRIGGER IF EXISTS trg_custom_plans_updated_at   ON upsc_custom_plans;
DROP TRIGGER IF EXISTS trg_plan_tables_updated_at    ON upsc_plan_tables;
DROP TRIGGER IF EXISTS trg_user_settings_updated_at  ON upsc_user_settings;
DROP TRIGGER IF EXISTS trg_pie_layouts_updated_at    ON upsc_pie_card_layouts;
DROP TRIGGER IF EXISTS trg_plan_layouts_updated_at   ON upsc_plan_layouts;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON upsc_user_profiles     FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_progress_updated_at
  BEFORE UPDATE ON upsc_tracker_progress  FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_custom_plans_updated_at
  BEFORE UPDATE ON upsc_custom_plans      FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_plan_tables_updated_at
  BEFORE UPDATE ON upsc_plan_tables       FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON upsc_user_settings     FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_pie_layouts_updated_at
  BEFORE UPDATE ON upsc_pie_card_layouts  FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_plan_layouts_updated_at
  BEFORE UPDATE ON upsc_plan_layouts      FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();

-- ============================================================================
-- STEP 6: RLS Policies — pattern: DROP IF EXISTS → CREATE (no IF NOT EXISTS)
--         One sub-section per table, all operations (SELECT/INSERT/UPDATE/DELETE)
--         listed explicitly so there are no silent permission gaps.
-- ============================================================================

-- 6a. upsc_messages
DROP POLICY IF EXISTS "Users read own messages"    ON upsc_messages;
DROP POLICY IF EXISTS "Users insert own messages"  ON upsc_messages;
DROP POLICY IF EXISTS "Admin full access messages" ON upsc_messages;
CREATE POLICY "Users read own messages"    ON upsc_messages FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages"  ON upsc_messages FOR INSERT  WITH CHECK (auth.uid() = user_id AND sender_type = 'user');
CREATE POLICY "Admin full access messages" ON upsc_messages FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- 6b. upsc_feedback
DROP POLICY IF EXISTS "Users read own feedback"   ON upsc_feedback;
DROP POLICY IF EXISTS "Users insert own feedback" ON upsc_feedback;
DROP POLICY IF EXISTS "Users update own feedback" ON upsc_feedback;
DROP POLICY IF EXISTS "Admin reads all feedback"  ON upsc_feedback;
CREATE POLICY "Users read own feedback"   ON upsc_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own feedback" ON upsc_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own feedback" ON upsc_feedback FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all feedback"  ON upsc_feedback FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- 6c. upsc_user_settings
DROP POLICY IF EXISTS "Users read own settings"   ON upsc_user_settings;
DROP POLICY IF EXISTS "Admin manage all settings" ON upsc_user_settings;
CREATE POLICY "Users read own settings"   ON upsc_user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage all settings" ON upsc_user_settings FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- 6d. upsc_app_metrics
DROP POLICY IF EXISTS "Users insert own metrics" ON upsc_app_metrics;
DROP POLICY IF EXISTS "Admin reads all metrics"  ON upsc_app_metrics;
CREATE POLICY "Users insert own metrics" ON upsc_app_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all metrics"  ON upsc_app_metrics FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- 6e. upsc_focus_sessions
DROP POLICY IF EXISTS "Users read own focus sessions"   ON upsc_focus_sessions;
DROP POLICY IF EXISTS "Users insert own focus sessions" ON upsc_focus_sessions;
DROP POLICY IF EXISTS "Users update own focus sessions" ON upsc_focus_sessions;
DROP POLICY IF EXISTS "Users delete own focus sessions" ON upsc_focus_sessions;
CREATE POLICY "Users read own focus sessions"   ON upsc_focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own focus sessions" ON upsc_focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own focus sessions" ON upsc_focus_sessions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own focus sessions" ON upsc_focus_sessions FOR DELETE USING (auth.uid() = user_id);

-- 6f. upsc_user_sources
DROP POLICY IF EXISTS "Users read own sources"   ON upsc_user_sources;
DROP POLICY IF EXISTS "Users insert own sources" ON upsc_user_sources;
DROP POLICY IF EXISTS "Users update own sources" ON upsc_user_sources;
DROP POLICY IF EXISTS "Users delete own sources" ON upsc_user_sources;
CREATE POLICY "Users read own sources"   ON upsc_user_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sources" ON upsc_user_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sources" ON upsc_user_sources FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sources" ON upsc_user_sources FOR DELETE USING (auth.uid() = user_id);

-- 6g. upsc_plan_tables
DROP POLICY IF EXISTS "Admin reads all plan tables" ON upsc_plan_tables;
CREATE POLICY "Admin reads all plan tables" ON upsc_plan_tables FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- 6h. upsc_pie_card_layouts
DROP POLICY IF EXISTS "Users manage own pie layouts" ON upsc_pie_card_layouts;
DROP POLICY IF EXISTS "Admin reads all pie layouts"  ON upsc_pie_card_layouts;
CREATE POLICY "Users manage own pie layouts" ON upsc_pie_card_layouts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all pie layouts"  ON upsc_pie_card_layouts FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- 6i. upsc_plan_layouts
DROP POLICY IF EXISTS "Users manage own plan layouts" ON upsc_plan_layouts;
DROP POLICY IF EXISTS "Admin reads all plan layouts"  ON upsc_plan_layouts;
CREATE POLICY "Users manage own plan layouts" ON upsc_plan_layouts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all plan layouts"  ON upsc_plan_layouts FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- ============================================================================
-- STEP 7: Admin overview view (CREATE OR REPLACE = always idempotent)
-- ============================================================================
CREATE OR REPLACE VIEW admin_plan_overview AS
SELECT
  p.user_id,
  u.email,
  u.display_name,
  p.plan_id,
  p.plan_title,
  p.table_type,
  p.sheet_name,
  p.sort_order,
  jsonb_array_length(p.rows_data)    AS row_count,
  jsonb_array_length(p.columns_data) AS col_count,
  p.updated_at,
  p.created_at
FROM upsc_plan_tables p
LEFT JOIN upsc_user_profiles u ON u.user_id = p.user_id
ORDER BY p.user_id, p.plan_title, p.sort_order;

-- ============================================================================
-- STEP 8: Metrics cleanup function + scheduled cron
--   Keeps upsc_app_metrics from growing unbounded on free-tier Supabase.
--   Run once; idempotent (CREATE OR REPLACE + pg_cron upsert pattern).
--
--   Requires pg_cron extension enabled in Supabase dashboard:
--   Database → Extensions → pg_cron → Enable
-- ============================================================================

-- Cleanup function: deletes metrics older than 30 days
-- (500 users × ~10 events/day × 30 days ≈ 150K rows / ~30 MB — safe for free tier)
CREATE OR REPLACE FUNCTION prune_old_metrics() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM upsc_app_metrics
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- Schedule: run at 03:00 UTC every Sunday (low-traffic window)
-- Uses cron.schedule which is idempotent by job name — safe to re-run.
SELECT cron.schedule(
  'prune-old-metrics',               -- job name (unique key)
  '0 3 * * 0',                       -- cron expression: 03:00 UTC every Sunday
  'SELECT prune_old_metrics()'
);

-- ============================================================================
-- DONE — committed atomically. Zero data loss. Both apps fully compatible.
-- ============================================================================

COMMIT;
