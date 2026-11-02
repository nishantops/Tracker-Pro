-- ============================================================================
-- MIGRATION v10 — Strengths & Weaknesses dedicated table
-- Additive + idempotent; no DROP TABLE / DROP COLUMN. Old app keeps working
-- (it still reads upsc_user_profiles.profile_data, which is left untouched).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS upsc_user_sw (
  user_id     UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  strengths   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  weaknesses  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  show_sw     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE upsc_user_sw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sw" ON upsc_user_sw;
DROP POLICY IF EXISTS "Admin reads all sw"  ON upsc_user_sw;
CREATE POLICY "Users manage own sw" ON upsc_user_sw FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all sw"  ON upsc_user_sw FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

DROP TRIGGER IF EXISTS trg_user_sw_updated_at ON upsc_user_sw;
CREATE TRIGGER trg_user_sw_updated_at
  BEFORE UPDATE ON upsc_user_sw FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();

-- Backfill from legacy profile_data JSONB (copy only; source left intact)
INSERT INTO upsc_user_sw (user_id, strengths, weaknesses, show_sw)
SELECT user_id,
       COALESCE(profile_data -> 'strengths',  '[]'::jsonb),
       COALESCE(profile_data -> 'weaknesses', '[]'::jsonb),
       COALESCE((profile_data ->> 'show_sw')::boolean, TRUE)
FROM upsc_user_profiles
WHERE profile_data ? 'strengths' OR profile_data ? 'weaknesses'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
