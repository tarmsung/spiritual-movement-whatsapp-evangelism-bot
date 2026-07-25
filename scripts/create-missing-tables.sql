-- ============================================================
-- SPIRITUAL MOVEMENT CHATBOT — Create all missing tables
-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
--
-- Supersedes create-admins-table.sql (which covered only 2 of the 4).
-- Every statement is IF NOT EXISTS, so this is safe to run against the
-- live database — existing tables (assemblies, reports, members) are
-- left completely untouched.
--
-- Fixes these production errors:
--   "Could not find the table 'public.admins' in the schema cache"
--   "Could not find the table 'public.users' in the schema cache"
-- ============================================================

-- ── users — DM menu state (CRITICAL) ────────────────────────
-- Read/written on EVERY menu interaction by getUserFormState /
-- saveUserFormState / clearUserFormState in src/database/db.js.
-- Without this table the Executor and Member menus cannot open at all.
--
-- `phone` MUST be the primary key: saveUserFormState() calls .upsert()
-- without an explicit onConflict, so Postgres resolves the conflict
-- target to the PK. A non-unique phone column would cause the upsert to
-- insert duplicate rows instead of updating the existing session.
CREATE TABLE IF NOT EXISTS public.users (
    phone             TEXT        PRIMARY KEY,          -- digits only, e.g. 263779439277
    current_form_step INTEGER,                          -- MENU_STEPS value (see utils/constants.js)
    form_data         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── admins — Executor privileges ────────────────────────────
-- Queried by isAdmin() as the fallback after ADMIN_NUMBERS / ADMIN_LIDS.
CREATE TABLE IF NOT EXISTS public.admins (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_number TEXT        NOT NULL UNIQUE,           -- digits only
    name         TEXT,
    role         TEXT        NOT NULL DEFAULT 'executor',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admins_phone_number ON public.admins(phone_number);

-- ── supervisors ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supervisors (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_number TEXT        NOT NULL UNIQUE,           -- digits only
    name         TEXT,
    branch       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supervisors_phone_number ON public.supervisors(phone_number);

-- ── events — church calendar ────────────────────────────────
-- Used by getUpcomingEvents / getNextEvent / getEventsInDays and the
-- !events and !next commands. Columns match scripts/seedEvents.js.
CREATE TABLE IF NOT EXISTS public.events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT        NOT NULL,
    day_of_week TEXT,
    event_date  DATE        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);

-- ── Grants (Supabase Data API) ──────────────────────────────
-- The bot connects with the anon key, so anon needs write access on the
-- tables it mutates (users session state, admin/member management).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisors TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO anon, authenticated, service_role;

-- ============================================================
-- Verify — all four should be listed
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'admins', 'supervisors', 'events')
ORDER BY table_name;

-- Optional: seed admins from ADMIN_NUMBERS in .env
--   node scripts/seed-admins.js
