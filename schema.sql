-- Guild Management System Schema
-- Run this in your Supabase SQL Editor or Postgres database

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT,
    ign TEXT,
    uid TEXT,
    discord_id TEXT,
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
    discord_id TEXT,
    status TEXT DEFAULT 'active',
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
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY, -- usually 'guild_settings'
    name TEXT,
    subtitle TEXT,
    timezone TEXT DEFAULT 'UTC',
    logo_url TEXT,
    max_party_size INTEGER DEFAULT 12,
    discord_channel_id TEXT,
    discord_guild_id TEXT,
    discord_announcements_channel_id TEXT,
    discord_absence_channel_id TEXT,
    discord_webhook_url TEXT,
    raffle_winners INTEGER DEFAULT 2,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Raffle Table
CREATE TABLE IF NOT EXISTS raffle (
    id TEXT PRIMARY KEY DEFAULT 'main',
    entries JSONB DEFAULT '[]'::jsonb,
    winners JSONB DEFAULT '[]'::jsonb,
    settings JSONB DEFAULT '{"currentWeek": 1, "currentMonth": 1, "currentYear": 2026, "isOpen": true}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (Row Level Security) - Optional but recommended
-- For simplicity in this initial setup, we'll assume the app handles auth via API
-- but you can add policies here for direct Supabase access.
