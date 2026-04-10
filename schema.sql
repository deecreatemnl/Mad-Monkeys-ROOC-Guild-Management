-- Guild Management System Schema
-- Run this in your Supabase SQL Editor or Postgres database

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT,
    ign TEXT,
    uid TEXT,
    role TEXT DEFAULT 'user',
    is_approved BOOLEAN DEFAULT false,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Members Table
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    ign TEXT NOT NULL,
    job TEXT,
    role TEXT,
    date_joined TEXT,
    uid TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'busy', 'on-leave', 'left the guild'
    leave_reason TEXT,
    leave_dates JSONB DEFAULT '[]'::jsonb,
    leave_started_at TIMESTAMP WITH TIME ZONE,
    return_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.1 Member Logs Table
CREATE TABLE IF NOT EXISTS member_logs (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.1 Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Events Table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    schedule JSONB DEFAULT '[]'::jsonb,
    absences JSONB DEFAULT '[]'::jsonb,
    subevents JSONB DEFAULT '[]'::jsonb,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY, -- usually 'guild_settings'
    name TEXT,
    timezone TEXT DEFAULT 'UTC',
    logo_url TEXT,
    max_party_size INTEGER DEFAULT 12,
    discord_guild_id TEXT,
    discord_announcements_channel_id TEXT,
    discord_absence_channel_id TEXT,
    discord_default_role_to_tag TEXT,
    github_repo TEXT,
    vercel_deploy_hook_url TEXT,
    disable_signups BOOLEAN DEFAULT false,
    raffle_winners INTEGER DEFAULT 2,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Raffle Table
CREATE TABLE IF NOT EXISTS raffle (
    id TEXT PRIMARY KEY DEFAULT 'main',
    entries JSONB DEFAULT '[]'::jsonb,
    winners JSONB DEFAULT '[]'::jsonb,
    settings JSONB DEFAULT '{"currentWeek": 1, "currentMonth": 1, "currentYear": 2026, "isOpen": true, "prizes": []}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Event Share Links Table
CREATE TABLE IF NOT EXISTS event_share_links (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 8. Raffle Stats Table
CREATE TABLE IF NOT EXISTS raffle_stats (
    id SERIAL PRIMARY KEY,
    week INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    entry_count INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Page Views Table
CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    page TEXT NOT NULL,
    member_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (Row Level Security) - Optional but recommended
-- For simplicity in this initial setup, we'll assume the app handles auth via API
-- but you can add policies here for direct Supabase access.

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_uid ON members(uid);
CREATE INDEX IF NOT EXISTS idx_member_logs_member_id ON member_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_event_share_links_event_id ON event_share_links(event_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_raffle_stats_date ON raffle_stats(year, month, week);

-- 11. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 12. Trigram Indexes
CREATE INDEX IF NOT EXISTS idx_members_job_trgm ON members USING gin (job gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_members_role_trgm ON members USING gin (role gin_trgm_ops);
