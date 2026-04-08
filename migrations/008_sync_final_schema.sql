-- 008_sync_final_schema.sql
-- Ensure all columns from the final schema are present for existing installations

-- 1. Add color to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS color TEXT;

-- 2. Add created_at to member_logs
ALTER TABLE member_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Add vercel_deploy_hook_url to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS vercel_deploy_hook_url TEXT;

-- 4. Ensure status in members
ALTER TABLE members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 5. Ensure raffle_winners in settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS raffle_winners INTEGER DEFAULT 2;

-- 6. Ensure order in events
ALTER TABLE events ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
