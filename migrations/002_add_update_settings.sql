-- Add update settings columns to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS github_repo TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS vercel_deploy_hook_url TEXT;
