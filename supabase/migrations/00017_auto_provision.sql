-- ============================================================
-- 00017_auto_provision.sql
-- Purpose: Auto-provision team + profile for authenticated users
--
-- After supabase db reset, profiles/teams are empty.
-- This migration:
--   1. Adds INSERT policy for teams (was missing)
--   2. Re-creates handle_new_user trigger (dropped in 00005)
--   3. Creates ensure_user_profile() RPC for existing sessions
-- ============================================================

-- ----------------------------------------------------------
-- 1. Teams INSERT policy (allow authenticated users to create)
-- ----------------------------------------------------------
CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- 2. Re-create handle_new_user trigger for new signups
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_team_id UUID;
BEGIN
  INSERT INTO teams (name) VALUES ('Default Team')
  RETURNING id INTO new_team_id;

  INSERT INTO profiles (id, email, display_name, role, team_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, ''),
    'admin',
    new_team_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ----------------------------------------------------------
-- 3. RPC: ensure_user_profile()
--    Returns team_id. Creates team + profile if missing.
--    SECURITY DEFINER bypasses RLS for safe self-provisioning.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  existing_team_id UUID;
  new_team_id UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check existing profile
  SELECT team_id INTO existing_team_id
  FROM profiles
  WHERE id = uid;

  IF existing_team_id IS NOT NULL THEN
    RETURN existing_team_id;
  END IF;

  -- Create default team
  INSERT INTO teams (name) VALUES ('Default Team')
  RETURNING id INTO new_team_id;

  -- Create profile from auth.users metadata
  INSERT INTO profiles (id, email, display_name, role, team_id)
  SELECT
    uid,
    COALESCE(u.email, ''),
    COALESCE(u.raw_user_meta_data->>'display_name', u.email, ''),
    'admin',
    new_team_id
  FROM auth.users u
  WHERE u.id = uid;

  RETURN new_team_id;
END;
$$;
