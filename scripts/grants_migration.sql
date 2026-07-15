-- ============================================================
-- SPIRITUAL MOVEMENT CHATBOT — Supabase Data API GRANT Migration
-- Required by Supabase change effective May 30 / Oct 30, 2026
-- Run this ONCE in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. assemblies ───────────────────────────────────────────
GRANT SELECT ON public.assemblies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assemblies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assemblies TO service_role;

-- ── 2. admins ───────────────────────────────────────────────
GRANT SELECT ON public.admins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO service_role;

-- ── 3. supervisors ──────────────────────────────────────────
GRANT SELECT ON public.supervisors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisors TO service_role;

-- ── 4. reports ──────────────────────────────────────────────
GRANT SELECT ON public.reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO service_role;

-- ── 5. users ────────────────────────────────────────────────
GRANT SELECT ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;

-- ── 6. events ───────────────────────────────────────────────
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO service_role;

-- ── 7. members ──────────────────────────────────────────────
GRANT SELECT ON public.members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO service_role;

-- ============================================================
-- ✅ Done. All 7 tables now have explicit grants.
-- ============================================================
-- Note: If your bot uses the 'anon' key to insert data, you may
-- need to add INSERT/UPDATE/DELETE permissions for the 'anon' role:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO anon;
-- Or use the 'service_role' key in your .env file instead.
