-- ============================================================
-- Storage Buckets
-- ============================================================

-- Bucket for user-uploaded files (research + knowledge + discussion)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket for generated PPTX files
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated', 'generated', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage RLS Policies
-- ============================================================

-- Upload bucket: team members can read/write their team's files
CREATE POLICY "Team members can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = get_user_team_id()::text
  );

CREATE POLICY "Team members can view uploaded files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = get_user_team_id()::text
  );

CREATE POLICY "Team members can delete uploaded files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = get_user_team_id()::text
  );

-- Generated bucket: team members can read/write their team's files
CREATE POLICY "Team members can create generated files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated'
    AND (storage.foldername(name))[1] = get_user_team_id()::text
  );

CREATE POLICY "Team members can view generated files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generated'
    AND (storage.foldername(name))[1] = get_user_team_id()::text
  );
