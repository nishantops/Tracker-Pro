-- ============================================================================
-- MIGRATION v12 — Focus time: append-only session log + atomic add
-- Additive + idempotent. No DROP TABLE / DROP COLUMN. Safe to run more than once.
--   1. upsc_focus_log      : one row per saved session / manual correction (audit trail, never edited)
--   2. upsc_focus_add()    : adds (or subtracts) seconds on a day in ONE statement, so two devices
--                            writing at the same moment cannot overwrite each other
-- The app works without this (it falls back to read-then-write and skips the log).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS upsc_focus_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_date     DATE        NOT NULL,                       -- IST day the time is credited to
  seconds        INTEGER     NOT NULL,                       -- positive for time added, negative for a subtraction
  source         TEXT        NOT NULL CHECK (source IN ('timer', 'manual_add', 'manual_subtract', 'recovered')),
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_log_user_date ON upsc_focus_log (user_id, focus_date DESC, created_at DESC);

ALTER TABLE upsc_focus_log ENABLE ROW LEVEL SECURITY;

-- Read and insert only: nobody can edit or delete log rows from the app.
DROP POLICY IF EXISTS "Users read own focus log"   ON upsc_focus_log;
DROP POLICY IF EXISTS "Users insert own focus log" ON upsc_focus_log;
CREATE POLICY "Users read own focus log"   ON upsc_focus_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own focus log" ON upsc_focus_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Atomic add/subtract on one day. Runs as the caller, so row-level security still applies.
CREATE OR REPLACE FUNCTION upsc_focus_add(p_date DATE, p_secs INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO upsc_focus_daily (user_id, focus_date, total_seconds, updated_at)
  VALUES (auth.uid(), p_date, GREATEST(0, p_secs), now())
  ON CONFLICT (user_id, focus_date)
  DO UPDATE SET total_seconds = GREATEST(0, upsc_focus_daily.total_seconds + p_secs),
                updated_at    = now()
  RETURNING total_seconds;
$$;

REVOKE ALL ON FUNCTION upsc_focus_add(DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsc_focus_add(DATE, INTEGER) TO authenticated;

COMMIT;
