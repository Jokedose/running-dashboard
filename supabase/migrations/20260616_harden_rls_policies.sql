-- Migration: harden_rls_policies
-- Applied: 2026-06-16
-- Purpose: Fix 3 RLS issues found in security review
--   (2) Remove duplicate SELECT policy on training_plan
--   (3) Change body_composition policies from role=public → authenticated
--   (4) Add WITH CHECK on body_composition UPDATE to prevent user_id reassignment

-- (2) Remove duplicate SELECT policy on training_plan
DROP POLICY IF EXISTS "read training plan" ON public.training_plan;

-- (3)+(4) Recreate body_composition policies
DROP POLICY IF EXISTS "read own body composition" ON public.body_composition;
DROP POLICY IF EXISTS "insert own body composition" ON public.body_composition;
DROP POLICY IF EXISTS "update own body composition" ON public.body_composition;

CREATE POLICY "read own body composition" ON public.body_composition
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert own body composition" ON public.body_composition
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own body composition" ON public.body_composition
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTE: training_plan has no user_id column (global table synced from Markdown).
-- Access control for training_plan relies on disabling public signup in
-- Supabase Dashboard → Authentication → Email → "Allow new users to sign up" OFF.
