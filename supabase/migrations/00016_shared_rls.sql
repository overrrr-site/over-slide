-- ============================================================
-- 00016_shared_rls.sql
-- Purpose: Replace team-scoped RLS policies with simple
--   "any authenticated user" checks (auth.uid() IS NOT NULL).
--
-- This migration:
--   1. DROPs every team-scoped policy across all tables
--   2. Recreates them with auth.uid() IS NOT NULL
--
-- Exceptions preserved as-is:
--   - style_guide policies      (user_id = auth.uid())
--   - profiles INSERT / UPDATE  (id = auth.uid())
--   - ai_usage_logs INSERT      (user_id = auth.uid())
--   - get_user_team_id() function is NOT dropped
-- ============================================================

-- ============================================================
-- DROP existing policies (grouped by table)
-- ============================================================

-- teams
DROP POLICY IF EXISTS "Team members can view their team" ON teams;

-- profiles (SELECT only — INSERT/UPDATE stay as-is)
DROP POLICY IF EXISTS "Team members can view profiles" ON profiles;

-- invitations
DROP POLICY IF EXISTS "Admins can view invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON invitations;

-- projects
DROP POLICY IF EXISTS "Team members can view projects" ON projects;
DROP POLICY IF EXISTS "Team members can create projects" ON projects;
DROP POLICY IF EXISTS "Team members can update projects" ON projects;
DROP POLICY IF EXISTS "Team members can delete projects" ON projects;

-- brief_sheets
DROP POLICY IF EXISTS "Team access to brief sheets" ON brief_sheets;
DROP POLICY IF EXISTS "Team insert brief sheets" ON brief_sheets;
DROP POLICY IF EXISTS "Team update brief sheets" ON brief_sheets;
DROP POLICY IF EXISTS "Team delete brief sheets" ON brief_sheets;

-- uploaded_files
DROP POLICY IF EXISTS "Team access to uploaded files" ON uploaded_files;
DROP POLICY IF EXISTS "Team insert uploaded files" ON uploaded_files;
DROP POLICY IF EXISTS "Team delete uploaded files" ON uploaded_files;

-- research_memos
DROP POLICY IF EXISTS "Team access to research memos" ON research_memos;
DROP POLICY IF EXISTS "Team insert research memos" ON research_memos;
DROP POLICY IF EXISTS "Team update research memos" ON research_memos;

-- structures
DROP POLICY IF EXISTS "Team access to structures" ON structures;
DROP POLICY IF EXISTS "Team insert structures" ON structures;
DROP POLICY IF EXISTS "Team update structures" ON structures;

-- page_contents
DROP POLICY IF EXISTS "Team access to page contents" ON page_contents;
DROP POLICY IF EXISTS "Team insert page contents" ON page_contents;
DROP POLICY IF EXISTS "Team update page contents" ON page_contents;
DROP POLICY IF EXISTS "Team delete page contents" ON page_contents;

-- generated_files
DROP POLICY IF EXISTS "Team access to generated files" ON generated_files;
DROP POLICY IF EXISTS "Team insert generated files" ON generated_files;

-- reviews
DROP POLICY IF EXISTS "Team access to reviews" ON reviews;
DROP POLICY IF EXISTS "Team insert reviews" ON reviews;
DROP POLICY IF EXISTS "Team update reviews" ON reviews;

-- knowledge_docs
DROP POLICY IF EXISTS "Team access to knowledge docs" ON knowledge_docs;
DROP POLICY IF EXISTS "Team insert knowledge docs" ON knowledge_docs;
DROP POLICY IF EXISTS "Team update knowledge docs" ON knowledge_docs;
DROP POLICY IF EXISTS "Team delete knowledge docs" ON knowledge_docs;

-- knowledge_chunks
DROP POLICY IF EXISTS "Team access to knowledge chunks" ON knowledge_chunks;
DROP POLICY IF EXISTS "Team insert knowledge chunks" ON knowledge_chunks;
DROP POLICY IF EXISTS "Team delete knowledge chunks" ON knowledge_chunks;

-- template_settings
DROP POLICY IF EXISTS "Team access to template settings" ON template_settings;
DROP POLICY IF EXISTS "Team insert template settings" ON template_settings;
DROP POLICY IF EXISTS "Team update template settings" ON template_settings;

-- revision_instructions (00007)
DROP POLICY IF EXISTS "Team access to revision instructions" ON revision_instructions;
DROP POLICY IF EXISTS "Team insert revision instructions" ON revision_instructions;
DROP POLICY IF EXISTS "Team update revision instructions" ON revision_instructions;

-- ai_usage_logs (00011)
DROP POLICY IF EXISTS "Team access to ai usage logs" ON ai_usage_logs;
DROP POLICY IF EXISTS "Team insert ai usage logs" ON ai_usage_logs;

-- ai_response_cache (00012)
DROP POLICY IF EXISTS "Team access to ai response cache" ON ai_response_cache;
DROP POLICY IF EXISTS "Team insert ai response cache" ON ai_response_cache;
DROP POLICY IF EXISTS "Team update ai response cache" ON ai_response_cache;
DROP POLICY IF EXISTS "Team delete ai response cache" ON ai_response_cache;

-- quotes (00012_quotes)
DROP POLICY IF EXISTS "Team members can view quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can create quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can update quotes" ON quotes;
DROP POLICY IF EXISTS "Team members can delete quotes" ON quotes;

-- quote_items (00012_quotes)
DROP POLICY IF EXISTS "Team access to quote items" ON quote_items;
DROP POLICY IF EXISTS "Team insert quote items" ON quote_items;
DROP POLICY IF EXISTS "Team update quote items" ON quote_items;
DROP POLICY IF EXISTS "Team delete quote items" ON quote_items;

-- brainstorm_sessions (00015)
DROP POLICY IF EXISTS "Team members can view brainstorm sessions" ON brainstorm_sessions;
DROP POLICY IF EXISTS "Team members can create brainstorm sessions" ON brainstorm_sessions;
DROP POLICY IF EXISTS "Team members can update brainstorm sessions" ON brainstorm_sessions;
DROP POLICY IF EXISTS "Team members can delete brainstorm sessions" ON brainstorm_sessions;

-- brainstorm_uploaded_files (00015)
DROP POLICY IF EXISTS "Team access to brainstorm uploaded files" ON brainstorm_uploaded_files;
DROP POLICY IF EXISTS "Team insert brainstorm uploaded files" ON brainstorm_uploaded_files;
DROP POLICY IF EXISTS "Team delete brainstorm uploaded files" ON brainstorm_uploaded_files;

-- brainstorm_exports (00015)
DROP POLICY IF EXISTS "Team access to brainstorm exports" ON brainstorm_exports;
DROP POLICY IF EXISTS "Team insert brainstorm exports" ON brainstorm_exports;
DROP POLICY IF EXISTS "Team delete brainstorm exports" ON brainstorm_exports;

-- storage.objects (00003)
DROP POLICY IF EXISTS "Team members can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Team members can view uploaded files" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete uploaded files" ON storage.objects;
DROP POLICY IF EXISTS "Team members can create generated files" ON storage.objects;
DROP POLICY IF EXISTS "Team members can view generated files" ON storage.objects;


-- ============================================================
-- RECREATE policies with auth.uid() IS NOT NULL
-- (grouped by table)
-- ============================================================

-- ----------------------------------------------------------
-- teams
-- ----------------------------------------------------------
CREATE POLICY "Team members can view their team"
  ON teams FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- profiles (SELECT only — INSERT/UPDATE keep id = auth.uid())
-- ----------------------------------------------------------
CREATE POLICY "Team members can view profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- invitations (keep admin role check, remove team_id check)
-- ----------------------------------------------------------
CREATE POLICY "Admins can view invitations"
  ON invitations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ----------------------------------------------------------
-- projects
-- ----------------------------------------------------------
CREATE POLICY "Team members can view projects"
  ON projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can update projects"
  ON projects FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can delete projects"
  ON projects FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- brief_sheets
-- ----------------------------------------------------------
CREATE POLICY "Team access to brief sheets"
  ON brief_sheets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert brief sheets"
  ON brief_sheets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update brief sheets"
  ON brief_sheets FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete brief sheets"
  ON brief_sheets FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- uploaded_files
-- ----------------------------------------------------------
CREATE POLICY "Team access to uploaded files"
  ON uploaded_files FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert uploaded files"
  ON uploaded_files FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete uploaded files"
  ON uploaded_files FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- research_memos
-- ----------------------------------------------------------
CREATE POLICY "Team access to research memos"
  ON research_memos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert research memos"
  ON research_memos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update research memos"
  ON research_memos FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- structures
-- ----------------------------------------------------------
CREATE POLICY "Team access to structures"
  ON structures FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert structures"
  ON structures FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update structures"
  ON structures FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- page_contents
-- ----------------------------------------------------------
CREATE POLICY "Team access to page contents"
  ON page_contents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert page contents"
  ON page_contents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update page contents"
  ON page_contents FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete page contents"
  ON page_contents FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- generated_files
-- ----------------------------------------------------------
CREATE POLICY "Team access to generated files"
  ON generated_files FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert generated files"
  ON generated_files FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- reviews
-- ----------------------------------------------------------
CREATE POLICY "Team access to reviews"
  ON reviews FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- knowledge_docs
-- ----------------------------------------------------------
CREATE POLICY "Team access to knowledge docs"
  ON knowledge_docs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert knowledge docs"
  ON knowledge_docs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update knowledge docs"
  ON knowledge_docs FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete knowledge docs"
  ON knowledge_docs FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- knowledge_chunks
-- ----------------------------------------------------------
CREATE POLICY "Team access to knowledge chunks"
  ON knowledge_chunks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert knowledge chunks"
  ON knowledge_chunks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete knowledge chunks"
  ON knowledge_chunks FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- template_settings
-- ----------------------------------------------------------
CREATE POLICY "Team access to template settings"
  ON template_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert template settings"
  ON template_settings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update template settings"
  ON template_settings FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- revision_instructions
-- ----------------------------------------------------------
CREATE POLICY "Team access to revision instructions"
  ON revision_instructions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert revision instructions"
  ON revision_instructions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update revision instructions"
  ON revision_instructions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- ai_usage_logs (INSERT keeps user_id = auth.uid() check)
-- ----------------------------------------------------------
CREATE POLICY "Team access to ai usage logs"
  ON ai_usage_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert ai usage logs"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- ----------------------------------------------------------
-- ai_response_cache
-- ----------------------------------------------------------
CREATE POLICY "Team access to ai response cache"
  ON ai_response_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert ai response cache"
  ON ai_response_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update ai response cache"
  ON ai_response_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete ai response cache"
  ON ai_response_cache FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- quotes
-- ----------------------------------------------------------
CREATE POLICY "Team members can view quotes"
  ON quotes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can create quotes"
  ON quotes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can update quotes"
  ON quotes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can delete quotes"
  ON quotes FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- quote_items
-- ----------------------------------------------------------
CREATE POLICY "Team access to quote items"
  ON quote_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert quote items"
  ON quote_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team update quote items"
  ON quote_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete quote items"
  ON quote_items FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- brainstorm_sessions
-- ----------------------------------------------------------
CREATE POLICY "Team members can view brainstorm sessions"
  ON brainstorm_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can create brainstorm sessions"
  ON brainstorm_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can update brainstorm sessions"
  ON brainstorm_sessions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can delete brainstorm sessions"
  ON brainstorm_sessions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- brainstorm_uploaded_files
-- ----------------------------------------------------------
CREATE POLICY "Team access to brainstorm uploaded files"
  ON brainstorm_uploaded_files FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert brainstorm uploaded files"
  ON brainstorm_uploaded_files FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete brainstorm uploaded files"
  ON brainstorm_uploaded_files FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- brainstorm_exports
-- ----------------------------------------------------------
CREATE POLICY "Team access to brainstorm exports"
  ON brainstorm_exports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team insert brainstorm exports"
  ON brainstorm_exports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team delete brainstorm exports"
  ON brainstorm_exports FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
-- storage.objects (replace folder path checks with auth check)
-- ----------------------------------------------------------
CREATE POLICY "Team members can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Team members can view uploaded files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'uploads'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Team members can delete uploaded files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Team members can create generated files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Team members can view generated files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generated'
    AND auth.uid() IS NOT NULL
  );
