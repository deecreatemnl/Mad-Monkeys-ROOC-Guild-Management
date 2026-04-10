-- Migration: Remove 'inactive' status
-- This migration converts all members with 'inactive' status to 'active'
-- as the 'inactive' status is being removed from the application.

UPDATE members SET status = 'active' WHERE status = 'inactive';
