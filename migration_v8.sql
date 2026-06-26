-- ============================================================================
-- MIGRATION v8  —  Source card layouts (drag/resize all sides, DB-persisted)
-- ============================================================================
-- SAFETY GUARANTEES:
--   ✅ Zero data loss — additive only, no DROP TABLE / DROP COLUMN
--   ✅ Fully idempotent — safe to run multiple times
--   ✅ Wrapped in a transaction
-- ============================================================================

BEGIN;

-- ── New table: upsc_source_layouts ──────────────────────────────────────────
-- Stores per-user drag/resize positions for source cards (react-grid-layout).
-- col_span / row_span are grid units (proportional, device-agnostic).
CREATE TABLE IF NOT EXISTS upsc_source_layouts (
    user_id    UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id  TEXT     NOT NULL,
    col        SMALLINT NOT NULL DEFAULT 0,
    row_pos    SMALLINT NOT NULL DEFAULT 0,
    col_span   SMALLINT NOT NULL DEFAULT 3,
    row_span   SMALLINT NOT NULL DEFAULT 3,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, source_id)
);
ALTER TABLE upsc_source_layouts ENABLE ROW LEVEL SECURITY;

-- ── Index ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_source_layouts_user ON upsc_source_layouts (user_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_source_layouts_updated_at ON upsc_source_layouts;
CREATE TRIGGER trg_source_layouts_updated_at
  BEFORE UPDATE ON upsc_source_layouts
  FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();

-- ── RLS Policies ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own source layouts" ON upsc_source_layouts;
DROP POLICY IF EXISTS "Admin reads all source layouts"  ON upsc_source_layouts;
CREATE POLICY "Users manage own source layouts" ON upsc_source_layouts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all source layouts"  ON upsc_source_layouts FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- ============================================================================
-- DONE
-- ============================================================================
COMMIT;
