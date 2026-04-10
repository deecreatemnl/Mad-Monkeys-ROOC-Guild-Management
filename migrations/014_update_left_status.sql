-- Migration: Update 'left' status to 'left the guild'
-- This migration converts all members with 'left' status to 'left the guild'
-- as the status is being renamed for clarity.

UPDATE members SET status = 'left the guild' WHERE status = 'left';
