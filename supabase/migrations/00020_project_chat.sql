-- ============================================================
-- Project Chat: messages & summaries for AI chat panel
-- ============================================================

-- Per-step chat messages
CREATE TABLE project_chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step        INTEGER NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pcm_project_step
  ON project_chat_messages(project_id, step, created_at);

-- Per-step conversation summaries (for cross-step context)
CREATE TABLE project_chat_summaries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step        INTEGER NOT NULL,
  summary     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, step)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE project_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_chat_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team access project_chat_messages (select)"
  ON project_chat_messages FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE team_id = get_user_team_id()
  ));

CREATE POLICY "Team access project_chat_messages (insert)"
  ON project_chat_messages FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE team_id = get_user_team_id()
  ));

CREATE POLICY "Team access project_chat_summaries (select)"
  ON project_chat_summaries FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE team_id = get_user_team_id()
  ));

CREATE POLICY "Team access project_chat_summaries (insert)"
  ON project_chat_summaries FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE team_id = get_user_team_id()
  ));

CREATE POLICY "Team access project_chat_summaries (update)"
  ON project_chat_summaries FOR UPDATE
  USING (project_id IN (
    SELECT id FROM projects WHERE team_id = get_user_team_id()
  ));
