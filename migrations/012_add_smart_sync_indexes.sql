-- Migration: Add indexes for smart sync performance
-- This adds indexes on job and role columns in the members table
-- to speed up case-insensitive searches (ilike) used in smart sync logic.

-- Note: pg_trgm extension is required for gin_trgm_ops.
-- It is usually enabled by default in Supabase, but let's ensure it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_members_job_trgm ON members USING gin (job gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_members_role_trgm ON members USING gin (role gin_trgm_ops);
