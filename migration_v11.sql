-- ============================================================================
-- MIGRATION v11 — Per-user UI preferences (panel positions/sizes, daily goal, revision log)
-- Additive + idempotent. No DROP TABLE / DROP COLUMN. Safe to run more than once.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS upsc_user_ui_prefs (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pref_key    TEXT        NOT NULL,
  value       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, pref_key)
);

ALTER TABLE upsc_user_ui_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own ui prefs" ON upsc_user_ui_prefs;
CREATE POLICY "Users manage own ui prefs" ON upsc_user_ui_prefs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_ui_prefs_updated_at ON upsc_user_ui_prefs;
CREATE TRIGGER trg_user_ui_prefs_updated_at
  BEFORE UPDATE ON upsc_user_ui_prefs FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();

COMMIT;
