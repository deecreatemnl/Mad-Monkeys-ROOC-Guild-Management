-- 006_add_event_order.sql
-- Add order column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
