-- ============================================================
-- SPIRITUAL MOVEMENT CHATBOT - Members Table
-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

CREATE TABLE IF NOT EXISTS members (
    member_id   INTEGER     PRIMARY KEY,        -- e.g. 1000
    first_name  TEXT        NOT NULL,           -- e.g. Kupakwashe
    surname     TEXT        NOT NULL,           -- e.g. Magamu
    full_name   TEXT        NOT NULL,           -- e.g. Kupakwashe Magamu (pre-computed for fast lookup)
    gender      TEXT        CHECK (gender IN ('Male', 'Female')),
    cluster     TEXT        NOT NULL            -- e.g. Marondera
);

-- Index for fast ID lookups during report submission
CREATE INDEX IF NOT EXISTS idx_members_member_id ON members(member_id);

-- Index for cluster-based queries (e.g. list all Marondera members)
CREATE INDEX IF NOT EXISTS idx_members_cluster ON members(cluster);

-- ============================================================
-- Verify the table was created
-- ============================================================
SELECT member_id, full_name, cluster FROM members ORDER BY member_id LIMIT 5;
