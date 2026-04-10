-- Migration 010: Add raffle_stats and page_views tables, and new columns to members and settings

-- 1. Add return_date to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE;

-- 2. Add discord_default_role_to_tag to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS discord_default_role_to_tag TEXT;

-- 3. Create raffle_stats table
CREATE TABLE IF NOT EXISTS raffle_stats (
    id SERIAL PRIMARY KEY,
    week INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    entry_count INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create page_views table
CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    page TEXT NOT NULL,
    member_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
