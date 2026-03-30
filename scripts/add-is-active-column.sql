-- ============================================================
-- Add soft-disable support to the members table
-- Run this in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Set all existing members to active
UPDATE members SET is_active = true WHERE is_active IS NULL;

-- Verify
SELECT member_id, full_name, is_active FROM members ORDER BY member_id LIMIT 5;
