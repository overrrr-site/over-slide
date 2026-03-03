-- ============================================================
-- Revision Instructions: 修正指示の履歴を保存
-- 構成・詳細・デザインの各工程でのAI再生成指示を記録
-- ============================================================
CREATE TABLE revision_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL CHECK (step_type IN ('structure', 'details', 'design')),
  page_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  original_content JSONB NOT NULL,
  revised_content JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revision_instructions_project ON revision_instructions(project_id);

-- ============================================================
-- RLS: Enable and add policies (project -> team)
-- ============================================================
ALTER TABLE revision_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team access to revision instructions"
  ON revision_instructions FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert revision instructions"
  ON revision_instructions FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));

CREATE POLICY "Team update revision instructions"
  ON revision_instructions FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE team_id = get_user_team_id()));
