-- ============================================================
-- AI Usage Logs: AI API呼び出しごとのトークン利用を記録
-- ============================================================

CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('generateText', 'streamText')),
  model TEXT NOT NULL,
  provider TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  prompt_chars INTEGER,
  completion_chars INTEGER,
  request_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_team_created
  ON ai_usage_logs(team_id, created_at);
CREATE INDEX idx_ai_usage_logs_project_created
  ON ai_usage_logs(project_id, created_at);
CREATE INDEX idx_ai_usage_logs_user_created
  ON ai_usage_logs(user_id, created_at);
CREATE INDEX idx_ai_usage_logs_endpoint_created
  ON ai_usage_logs(endpoint, created_at);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team access to ai usage logs"
  ON ai_usage_logs FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team insert ai usage logs"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (
    team_id = get_user_team_id()
    AND user_id = auth.uid()
  );
