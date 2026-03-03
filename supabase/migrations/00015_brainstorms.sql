-- ============================================================
-- Brainstorm feature split + project workflow update
-- ============================================================

-- 1) brainstorm_sessions
CREATE TABLE brainstorm_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL DEFAULT '新しいブレスト',
  client_name     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'completed', 'archived')),
  brief_tone      TEXT NOT NULL DEFAULT 'hybrid'
                   CHECK (brief_tone IN ('logical', 'emotional', 'hybrid')),
  client_info     TEXT NOT NULL DEFAULT '',
  background      TEXT NOT NULL DEFAULT '',
  hypothesis      TEXT NOT NULL DEFAULT '',
  goal            TEXT NOT NULL DEFAULT '',
  constraints     TEXT NOT NULL DEFAULT '',
  research_topics TEXT NOT NULL DEFAULT '',
  structure_draft TEXT NOT NULL DEFAULT '',
  raw_markdown    TEXT NOT NULL DEFAULT '',
  chat_history    JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brainstorm_sessions_team_updated
  ON brainstorm_sessions(team_id, updated_at DESC);
CREATE INDEX idx_brainstorm_sessions_team_status
  ON brainstorm_sessions(team_id, status);

-- 2) brainstorm_uploaded_files
CREATE TABLE brainstorm_uploaded_files (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brainstorm_id  UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  uploaded_by    UUID NOT NULL REFERENCES profiles(id),
  file_name      TEXT NOT NULL,
  file_type      TEXT NOT NULL,
  file_size      BIGINT NOT NULL,
  storage_path   TEXT NOT NULL,
  extracted_text TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brainstorm_uploaded_files_session
  ON brainstorm_uploaded_files(brainstorm_id, created_at ASC);
CREATE INDEX idx_brainstorm_uploaded_files_team
  ON brainstorm_uploaded_files(team_id, created_at DESC);

-- 3) brainstorm_exports
CREATE TABLE brainstorm_exports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brainstorm_id UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  exported_by   UUID NOT NULL REFERENCES profiles(id),
  file_type     TEXT NOT NULL CHECK (file_type IN ('md', 'docx')),
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brainstorm_exports_session_created
  ON brainstorm_exports(brainstorm_id, created_at DESC);
CREATE INDEX idx_brainstorm_exports_team_created
  ON brainstorm_exports(team_id, created_at DESC);

-- 4) projects: add origin link and remove step0
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS origin_brainstorm_id UUID REFERENCES brainstorm_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_origin_brainstorm
  ON projects(origin_brainstorm_id);

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_current_step_check;
ALTER TABLE projects ADD CONSTRAINT projects_current_step_check
  CHECK (current_step BETWEEN 1 AND 7);
ALTER TABLE projects ALTER COLUMN current_step SET DEFAULT 1;

-- 5) data migration: move step0 to step1
UPDATE projects
SET current_step = 1
WHERE current_step = 0;

-- 6) backfill placeholder brief_sheets for projects without one
INSERT INTO brief_sheets (
  project_id,
  client_info,
  background,
  hypothesis,
  goal,
  constraints,
  research_topics,
  structure_draft,
  raw_markdown,
  chat_history
)
SELECT
  p.id,
  COALESCE(NULLIF(p.client_name, ''), '（未定）') AS client_info,
  '（未定）' AS background,
  '（未定）' AS hypothesis,
  '（未定）' AS goal,
  '（未定）' AS constraints,
  '（未定）' AS research_topics,
  '（未定）' AS structure_draft,
  '■ ブリーフシート\n──────────────────────────\nクライアント：' || COALESCE(NULLIF(p.client_name, ''), '（未定）') ||
    '\n背景・課題：（未定）\n提案の方向性：（未定）\nゴール：（未定）\n制約条件：（未定）\nリサーチで確認すべきこと：（未定）\n構成の骨格案：（未定）\n──────────────────────────' AS raw_markdown,
  '[]'::jsonb AS chat_history
FROM projects p
LEFT JOIN brief_sheets bs ON bs.project_id = p.id
WHERE bs.project_id IS NULL
ON CONFLICT (project_id) DO NOTHING;

-- 7) RLS for new tables
ALTER TABLE brainstorm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brainstorm_uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE brainstorm_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view brainstorm sessions"
  ON brainstorm_sessions FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team members can create brainstorm sessions"
  ON brainstorm_sessions FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team members can update brainstorm sessions"
  ON brainstorm_sessions FOR UPDATE
  USING (team_id = get_user_team_id());

CREATE POLICY "Team members can delete brainstorm sessions"
  ON brainstorm_sessions FOR DELETE
  USING (team_id = get_user_team_id());

CREATE POLICY "Team access to brainstorm uploaded files"
  ON brainstorm_uploaded_files FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team insert brainstorm uploaded files"
  ON brainstorm_uploaded_files FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team delete brainstorm uploaded files"
  ON brainstorm_uploaded_files FOR DELETE
  USING (team_id = get_user_team_id());

CREATE POLICY "Team access to brainstorm exports"
  ON brainstorm_exports FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team insert brainstorm exports"
  ON brainstorm_exports FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team delete brainstorm exports"
  ON brainstorm_exports FOR DELETE
  USING (team_id = get_user_team_id());
