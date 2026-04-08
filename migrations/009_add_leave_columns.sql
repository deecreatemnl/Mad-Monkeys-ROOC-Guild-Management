-- 009_add_leave_columns.sql
-- Add leave-related columns to members table for existing installations

ALTER TABLE members ADD COLUMN IF NOT EXISTS leave_reason TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS leave_dates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE members ADD COLUMN IF NOT EXISTS leave_started_at TIMESTAMP WITH TIME ZONE;
