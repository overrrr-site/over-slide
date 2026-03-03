-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- teams: members can view their own team
-- ============================================================
CREATE POLICY "Team members can view their team"
  ON teams FOR SELECT
  USING (id = get_user_team_id());

-- ============================================================
-- profiles: team members can view profiles, update own
-- ============================================================
CREATE POLICY "Team members can view profiles"
  ON profiles FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================
-- invitations: admins can manage
-- ============================================================
CREATE POLICY "Admins can view invitations"
  ON invitations FOR SELECT
  USING (
    team_id = get_user_team_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    team_id = get_user_team_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE
  USING (
    team_id = get_user_team_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- projects: team CRUD
-- ============================================================
CREATE POLICY "Team members can view projects"
  ON projects FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team members can create projects"
  ON projects FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team members can update projects"
  ON projects FOR UPDATE
  USING (team_id = get_user_team_id());

CREATE POLICY "Team members can delete projects"
  ON projects FOR DELETE
  USING (team_id = get_user_team_id());

-- ============================================================
-- brief_sheets: access via project -> team
-- ============================================================
CREATE POLICY "Team access to brief sheets"
  ON brief_sheets FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert brief sheets"
  ON brief_sheets FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team update brief sheets"
  ON brief_sheets FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team delete brief sheets"
  ON brief_sheets FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

-- ============================================================
-- uploaded_files: team access
-- ============================================================
CREATE POLICY "Team access to uploaded files"
  ON uploaded_files FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team insert uploaded files"
  ON uploaded_files FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team delete uploaded files"
  ON uploaded_files FOR DELETE
  USING (team_id = get_user_team_id());

-- ============================================================
-- research_memos: access via project -> team
-- ============================================================
CREATE POLICY "Team access to research memos"
  ON research_memos FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert research memos"
  ON research_memos FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team update research memos"
  ON research_memos FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

-- ============================================================
-- structures: access via project -> team
-- ============================================================
CREATE POLICY "Team access to structures"
  ON structures FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert structures"
  ON structures FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team update structures"
  ON structures FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

-- ============================================================
-- page_contents: access via structure -> project -> team
-- ============================================================
CREATE POLICY "Team access to page contents"
  ON page_contents FOR SELECT
  USING (structure_id IN (
    SELECT s.id FROM structures s
    JOIN projects p ON s.project_id = p.id
    WHERE p.team_id = get_user_team_id()
  ));

CREATE POLICY "Team insert page contents"
  ON page_contents FOR INSERT
  WITH CHECK (structure_id IN (
    SELECT s.id FROM structures s
    JOIN projects p ON s.project_id = p.id
    WHERE p.team_id = get_user_team_id()
  ));

CREATE POLICY "Team update page contents"
  ON page_contents FOR UPDATE
  USING (structure_id IN (
    SELECT s.id FROM structures s
    JOIN projects p ON s.project_id = p.id
    WHERE p.team_id = get_user_team_id()
  ));

-- ============================================================
-- generated_files: access via project -> team
-- ============================================================
CREATE POLICY "Team access to generated files"
  ON generated_files FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert generated files"
  ON generated_files FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

-- ============================================================
-- reviews: access via project -> team
-- ============================================================
CREATE POLICY "Team access to reviews"
  ON reviews FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert reviews"
  ON reviews FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team update reviews"
  ON reviews FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

-- ============================================================
-- knowledge_docs: direct team_id check
-- ============================================================
CREATE POLICY "Team access to knowledge docs"
  ON knowledge_docs FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team insert knowledge docs"
  ON knowledge_docs FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team update knowledge docs"
  ON knowledge_docs FOR UPDATE
  USING (team_id = get_user_team_id());

CREATE POLICY "Team delete knowledge docs"
  ON knowledge_docs FOR DELETE
  USING (team_id = get_user_team_id());

-- ============================================================
-- knowledge_chunks: access via doc -> team
-- ============================================================
CREATE POLICY "Team access to knowledge chunks"
  ON knowledge_chunks FOR SELECT
  USING (doc_id IN (SELECT id FROM knowledge_docs WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert knowledge chunks"
  ON knowledge_chunks FOR INSERT
  WITH CHECK (doc_id IN (SELECT id FROM knowledge_docs WHERE team_id = get_user_team_id()));

CREATE POLICY "Team delete knowledge chunks"
  ON knowledge_chunks FOR DELETE
  USING (doc_id IN (SELECT id FROM knowledge_docs WHERE team_id = get_user_team_id()));

-- ============================================================
-- template_settings: team access
-- ============================================================
CREATE POLICY "Team access to template settings"
  ON template_settings FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team insert template settings"
  ON template_settings FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team update template settings"
  ON template_settings FOR UPDATE
  USING (team_id = get_user_team_id());
