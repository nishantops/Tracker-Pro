-- ============================================================================
-- UPSC TRACKER: Complete Multi-User Schema
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- STEP 1: Drop old table (if exists) and create new multi-user table
-- ⚠️ This will DELETE all existing data. If you want to keep it, skip this DROP.
DROP TABLE IF EXISTS nishant_upsc_tracker;

CREATE TABLE nishant_upsc_tracker (
    id TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    is_checked BOOLEAN NOT NULL DEFAULT FALSE,
    topic_note TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);

-- STEP 2: Create index for fast user-specific lookups
CREATE INDEX idx_tracker_user_id ON nishant_upsc_tracker(user_id);

-- STEP 3: Enable Row Level Security (RLS)
ALTER TABLE nishant_upsc_tracker ENABLE ROW LEVEL SECURITY;

-- STEP 4: RLS Policy — each user can ONLY see/modify their own rows
-- SELECT: users read only their own data
CREATE POLICY "Users read own data"
    ON nishant_upsc_tracker
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: users can only insert rows for themselves
CREATE POLICY "Users insert own data"
    ON nishant_upsc_tracker
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own rows
CREATE POLICY "Users update own data"
    ON nishant_upsc_tracker
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own rows
CREATE POLICY "Users delete own data"
    ON nishant_upsc_tracker
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- DONE! Each user now gets isolated data.
-- The app sends user_id on every write, RLS filters reads automatically.
-- ============================================================================
