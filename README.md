# UPSC Command Center — Tracker Pro

A full-featured UPSC CSE preparation tracker with syllabus progress, PYQ practice, current affairs, AI assistant, focus mode, and personalized strengths & weaknesses tracking.

**Live**: https://tracker-pro-9gf.pages.dev  
**Stack**: Vanilla JS · Tailwind CSS v4 CDN · Supabase (Auth + PostgreSQL) · Cloudflare Pages

---

## Project Structure

```
/
├── index.html          # Single-page app shell
├── env.js              # Environment config (not committed — set via Cloudflare)
├── css/
│   └── main.css        # Custom CSS (themes, animations, components)
├── js/
│   ├── app.js          # Root: tab routing, progress, countdowns
│   ├── auth.js         # Supabase auth (email + Google OAuth)
│   ├── profile.js      # User profile modal, feature gates
│   ├── tracker.js      # Syllabus checkboxes, progress sync
│   ├── pyq.js          # PYQ rendering + optional subject guard
│   ├── sw.js           # Strengths & Weaknesses CRUD + widget
│   ├── plans.js        # Strategy planner
│   ├── assignments.js  # Custom topic modal
│   ├── tabs.js         # Tab activation + lazy rendering
│   ├── sources.js      # Study sources
│   ├── trends.js       # Progress trends
│   ├── ai-chat.js      # Gemini AI chat panel
│   └── ...
├── PYQ/                # Raw extracted PYQ data files
└── scripts/            # Python data extraction scripts
```

---

## Cloudflare Pages Setup

### Build Settings (Dashboard → Settings → Builds)
| Field | Value |
|---|---|
| Build command | *(leave blank — static site, no build)* |
| Build output directory | `/` |
| Root directory | `/` |
| Node version | `18` |

### Environment Variables (Dashboard → Settings → Environment Variables)
Add these for **Production** and **Preview**:

```
SUPABASE_URL        = https://wdbwnutkomemrciybezz.supabase.co
SUPABASE_ANON_KEY   = sb_publishable_...your_key...
GEMINI_API_KEY      = ...your_gemini_key...
SUPERUSER_EMAIL     = sanit@upsc-nishant.me
```

> ⚠️ `env.js` is gitignored — these values are injected at runtime via the `env.js` file served locally or via Cloudflare. Do NOT commit `env.js`.

### Custom Domain (optional)
1. Cloudflare Pages → Custom Domains → Add domain
2. Point your domain's CNAME to `tracker-pro-9gf.pages.dev`

---

## Supabase Setup — Full SQL (run in Supabase SQL Editor)

### Step 1 — Enable Row Level Security on all user tables

```sql
-- Profiles
ALTER TABLE upsc_user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_profile" ON upsc_user_profiles;
CREATE POLICY "users_own_profile" ON upsc_user_profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Custom plans
ALTER TABLE upsc_custom_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_plans" ON upsc_custom_plans;
CREATE POLICY "users_own_plans" ON upsc_custom_plans
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Plan tables
ALTER TABLE upsc_plan_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_plan_tables" ON upsc_plan_tables;
CREATE POLICY "users_own_plan_tables" ON upsc_plan_tables
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Focus sessions
ALTER TABLE upsc_focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_focus" ON upsc_focus_sessions;
CREATE POLICY "users_own_focus" ON upsc_focus_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tracker progress
ALTER TABLE upsc_tracker_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_progress" ON upsc_tracker_progress;
CREATE POLICY "users_own_progress" ON upsc_tracker_progress
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notification prefs
ALTER TABLE upsc_notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_notif_prefs" ON upsc_notification_prefs;
CREATE POLICY "users_own_notif_prefs" ON upsc_notification_prefs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User sessions
ALTER TABLE upsc_user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_sessions" ON upsc_user_sessions;
CREATE POLICY "users_own_sessions" ON upsc_user_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Focus year data
ALTER TABLE upsc_focus_year_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_year_data" ON upsc_focus_year_data;
CREATE POLICY "users_own_year_data" ON upsc_focus_year_data
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin audit log: admins insert, no user reads
ALTER TABLE upsc_admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_insert" ON upsc_admin_audit_log;
CREATE POLICY "admin_audit_insert" ON upsc_admin_audit_log
  FOR INSERT WITH CHECK (true);
```

### Step 2 — Add performance indexes

```sql
CREATE INDEX IF NOT EXISTS idx_profiles_id
  ON upsc_user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_custom_plans_user
  ON upsc_custom_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_plan_tables_user
  ON upsc_plan_tables(user_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user
  ON upsc_focus_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_tracker_progress_user
  ON upsc_tracker_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_focus_year_user
  ON upsc_focus_year_data(user_id);
```

### Step 3 — Verify RLS is working

```sql
-- Should return 0 rows when run as anon (unauthenticated)
SELECT count(*) FROM upsc_user_profiles;

-- Check RLS status on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Step 4 — Google OAuth (Supabase Dashboard)

1. Go to **Authentication → Providers → Google**
2. Enable Google provider
3. Add authorized redirect URIs in Google Cloud Console:
   - `https://wdbwnutkomemrciybezz.supabase.co/auth/v1/callback`
4. Copy Client ID + Secret into Supabase dashboard
5. Set **Site URL** in Supabase → Authentication → URL Configuration:
   - `https://tracker-pro-9gf.pages.dev`
6. Add **Redirect URLs**:
   - `https://tracker-pro-9gf.pages.dev/`
   - `http://localhost:3000/` (for local dev)

### Step 5 — Email Auth Settings

1. Supabase → Authentication → Email → **Disable email confirmation** (for dev/early users)
   - OR set up a custom SMTP server (Resend/Brevo free tier) for production
2. Set password min length to 8

---

## Local Development

```bash
# Option 1: Python simple server
python -m http.server 3000

# Option 2: VS Code Live Server extension
# Right-click index.html → Open with Live Server

# Option 3: npx
npx serve . -p 3000
```

Create a local `env.js` (never commit this):
```js
const ENV = Object.freeze({
  SUPABASE_URL: 'https://wdbwnutkomemrciybezz.supabase.co',
  SUPABASE_ANON_KEY: 'your_anon_key',
  GEMINI_API_KEY: 'your_gemini_key',
  SUPERUSER_EMAIL: 'sanit@upsc-nishant.me'
});
```

---

## Deployment

```bash
# Standard deploy — push to main, Cloudflare auto-deploys
git add .
git commit -m "feat: your message"
git push origin main
```

Cloudflare Pages picks up every push to `main` and deploys within ~30 seconds.

---

## Free Tier Limits & Survival

| Service | Free Limit | Current Usage Risk |
|---|---|---|
| Supabase MAU | 50,000/month | ✅ Safe for 1000 users |
| Supabase DB | 500MB | ⚠️ Watch if PYQ moved to DB |
| Supabase Bandwidth | 5GB/month | ⚠️ PYQ JS files are large |
| Cloudflare Pages Requests | Unlimited | ✅ No risk |
| Cloudflare Builds | 500/month | ✅ Safe |

**Critical**: Supabase free tier **pauses after 1 week of inactivity**. The app includes a daily keep-alive ping to prevent this.

---

## Key Architecture Decisions

- **No build step** — pure static files, instant deploys to Cloudflare Pages
- **localStorage as L1 cache** — instant UI on repeat visits, DB as source of truth
- **`_activeProfile` module var** — single source of truth for current user profile, prevents sync bugs
- **RLS on all tables** — users can only access their own data, no server-side auth middleware needed
- **Debounced sync** — all DB writes are debounced (800ms) to minimize Supabase API calls
- **Optional subject guard** — PYQ module checks `_activeProfile.optional_subject` before rendering Anthropology data

---

## Adding New Users / Admin

1. Users self-register via the app (email or Google)
2. Admin (`SUPERUSER_EMAIL`) has all features enabled by default
3. To enable features for a user (e.g., AI chat):

```sql
UPDATE upsc_user_profiles
SET features_enabled = '{"focus": true, "plans": true, "ai_chat": true, "pyq": true, "sources": true}'::jsonb
WHERE id = 'USER_UUID_HERE';
```

4. To lock an account:

```sql
UPDATE upsc_user_profiles
SET is_locked = true,
    locked_reason = 'Reason here',
    locked_at = now()
WHERE id = 'USER_UUID_HERE';
```

---

## Tech Stack Details

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES6), Tailwind CSS v4 CDN |
| Auth | Supabase Auth (email + Google OAuth) |
| Database | Supabase PostgreSQL |
| Hosting | Cloudflare Pages (static) |
| AI | Google Gemini API |
| Fonts | Cabinet Grotesk, JetBrains Mono (Google Fonts) |
