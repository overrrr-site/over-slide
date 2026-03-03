-- ============================================================
-- AI Response Cache: セマンティックキーによるレスポンスキャッシュ
-- ============================================================

CREATE TABLE ai_response_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  response_text TEXT NOT NULL,
  usage JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE UNIQUE INDEX idx_ai_response_cache_unique
  ON ai_response_cache(team_id, endpoint, model, cache_key);

CREATE INDEX idx_ai_response_cache_team_last_hit
  ON ai_response_cache(team_id, last_hit_at DESC);

CREATE INDEX idx_ai_response_cache_expires
  ON ai_response_cache(expires_at);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team access to ai response cache"
  ON ai_response_cache FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team insert ai response cache"
  ON ai_response_cache FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team update ai response cache"
  ON ai_response_cache FOR UPDATE
  USING (team_id = get_user_team_id());

CREATE POLICY "Team delete ai response cache"
  ON ai_response_cache FOR DELETE
  USING (team_id = get_user_team_id());
