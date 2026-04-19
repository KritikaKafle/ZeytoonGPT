/*
  # Fix infinite recursion in profiles RLS policies

  Policies referenced the profiles table from within profiles policies,
  causing recursion. Replace with a SECURITY DEFINER helper function
  that bypasses RLS when checking admin status.

  1. Changes
    - Create is_admin() helper function (SECURITY DEFINER)
    - Recreate profiles policies using is_admin()
    - Recreate dependent policies on other tables using is_admin()
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Users view own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Anyone read active plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins insert plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins update plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins delete plans" ON subscription_plans;

CREATE POLICY "Anyone read active plans"
  ON subscription_plans FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins insert plans"
  ON subscription_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update plans"
  ON subscription_plans FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete plans"
  ON subscription_plans FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone read active tools" ON ai_tools;
DROP POLICY IF EXISTS "Admins insert tools" ON ai_tools;
DROP POLICY IF EXISTS "Admins update tools" ON ai_tools;
DROP POLICY IF EXISTS "Admins delete tools" ON ai_tools;

CREATE POLICY "Anyone read active tools"
  ON ai_tools FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins insert tools"
  ON ai_tools FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update tools"
  ON ai_tools FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete tools"
  ON ai_tools FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert plan limits" ON plan_tool_limits;
DROP POLICY IF EXISTS "Admins update plan limits" ON plan_tool_limits;
DROP POLICY IF EXISTS "Admins delete plan limits" ON plan_tool_limits;

CREATE POLICY "Admins insert plan limits"
  ON plan_tool_limits FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update plan limits"
  ON plan_tool_limits FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete plan limits"
  ON plan_tool_limits FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users view own overrides" ON user_tool_overrides;
DROP POLICY IF EXISTS "Admins insert overrides" ON user_tool_overrides;
DROP POLICY IF EXISTS "Admins update overrides" ON user_tool_overrides;
DROP POLICY IF EXISTS "Admins delete overrides" ON user_tool_overrides;

CREATE POLICY "Users view own overrides"
  ON user_tool_overrides FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins insert overrides"
  ON user_tool_overrides FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update overrides"
  ON user_tool_overrides FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete overrides"
  ON user_tool_overrides FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users view own usage" ON token_usage;
DROP POLICY IF EXISTS "Users update own usage" ON token_usage;

CREATE POLICY "Users view own usage"
  ON token_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users update own usage"
  ON token_usage FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
