-- ============================================================
-- SPIRITUAL MOVEMENT CHATBOT - Admins & Supervisors Tables
-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
--
-- Fixes the production error:
--   "Could not find the table 'public.admins' in the schema cache"
-- These tables are queried by isAdmin()/isSupervisor() in src/database/db.js
-- but were never created (only grants_migration.sql referenced them).
-- ============================================================

-- ── admins ──────────────────────────────────────────────────
-- Columns match src/database/db.js: phone_number (lookup key),
-- name, role. addAdmin() defaults role to 'executor'.
CREATE TABLE IF NOT EXISTS public.admins (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_number TEXT        NOT NULL UNIQUE,     -- digits only, e.g. 263771772984
    name         TEXT,
    role         TEXT        NOT NULL DEFAULT 'executor',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admins_phone_number ON public.admins(phone_number);

-- ── supervisors ─────────────────────────────────────────────
-- Columns match src/database/db.js: phone_number (lookup key),
-- name, branch.
CREATE TABLE IF NOT EXISTS public.supervisors (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_number TEXT        NOT NULL UNIQUE,     -- digits only, e.g. 263771772984
    name         TEXT,
    branch       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supervisors_phone_number ON public.supervisors(phone_number);

-- ── Grants (Supabase Data API) ──────────────────────────────
-- Mirror scripts/grants_migration.sql so this file is self-contained.
GRANT SELECT ON public.admins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO service_role;

GRANT SELECT ON public.supervisors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisors TO service_role;

-- ============================================================
-- Verify the tables were created
-- ============================================================
SELECT 'admins' AS table_name, count(*) AS rows FROM public.admins
UNION ALL
SELECT 'supervisors', count(*) FROM public.supervisors;

-- After running this, seed your admin(s) from .env with:
--   node scripts/seed-admins.js
