-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 1. teams
-- ============================================================
CREATE TABLE teams (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. profiles (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. invitations
-- ============================================================
CREATE TABLE invitations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  token      TEXT NOT NULL UNIQUE,
  accepted   BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. projects
-- ============================================================
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES profiles(id),
  title         TEXT NOT NULL,
  client_name   TEXT,
  description   TEXT,
  current_step  INTEGER NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 6),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'review', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================
-- 5. brief_sheets (工程0 output)
-- ============================================================
CREATE TABLE brief_sheets (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_info      TEXT,
  background       TEXT,
  hypothesis       TEXT,
  goal             TEXT,
  constraints      TEXT,
  research_topics  TEXT,
  structure_draft  TEXT,
  chat_history     JSONB NOT NULL DEFAULT '[]',
  raw_markdown     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_brief_sheets_project ON brief_sheets(project_id);

-- ============================================================
-- 6. uploaded_files
-- ============================================================
CREATE TABLE uploaded_files (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID REFERENCES projects(id) ON DELETE CASCADE,
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  uploaded_by    UUID NOT NULL REFERENCES profiles(id),
  file_name      TEXT NOT NULL,
  file_type      TEXT NOT NULL,
  file_size      BIGINT NOT NULL,
  storage_path   TEXT NOT NULL,
  extracted_text TEXT,
  purpose        TEXT NOT NULL DEFAULT 'research' CHECK (purpose IN ('research', 'knowledge', 'discussion')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uploaded_files_project ON uploaded_files(project_id);

-- ============================================================
-- 7. research_memos (工程1 output)
-- ============================================================
CREATE TABLE research_memos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  theme_keywords   TEXT NOT NULL DEFAULT '',
  direction        TEXT,
  search_queries   JSONB NOT NULL DEFAULT '[]',
  search_results   JSONB NOT NULL DEFAULT '[]',
  uploaded_file_ids TEXT[] DEFAULT '{}',
  content          JSONB NOT NULL DEFAULT '{}',
  raw_markdown     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_research_memos_project ON research_memos(project_id);

-- ============================================================
-- 8. structures (工程2 output)
-- ============================================================
CREATE TABLE structures (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL DEFAULT 1,
  pages        JSONB NOT NULL DEFAULT '[]',
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_structures_project ON structures(project_id);

-- ============================================================
-- 9. page_contents (工程3 output)
-- ============================================================
CREATE TABLE page_contents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  structure_id  UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  page_number   INTEGER NOT NULL,
  content       JSONB NOT NULL DEFAULT '{}',
  svg_data      TEXT,
  is_confirmed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_page_contents_structure ON page_contents(structure_id);
CREATE UNIQUE INDEX idx_page_contents_unique ON page_contents(structure_id, page_number);

-- ============================================================
-- 10. generated_files (工程4 output)
-- ============================================================
CREATE TABLE generated_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_type     TEXT NOT NULL DEFAULT 'pptx' CHECK (file_type IN ('pptx', 'pdf')),
  storage_path  TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  slide_data    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_files_project ON generated_files(project_id);

-- ============================================================
-- 11. reviews (工程5 output)
-- ============================================================
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL DEFAULT 1,
  review_data   JSONB NOT NULL DEFAULT '{}',
  decisions     JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'decided', 'applied')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_project ON reviews(project_id);

-- ============================================================
-- 12. knowledge_docs
-- ============================================================
CREATE TABLE knowledge_docs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('pptx', 'pdf', 'other')),
  tags            JSONB DEFAULT '[]',
  analysis        JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_docs_team ON knowledge_docs(team_id);

-- ============================================================
-- 13. knowledge_chunks (vector embeddings for RAG)
-- ============================================================
CREATE TABLE knowledge_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id        UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  chunk_type    TEXT NOT NULL CHECK (chunk_type IN ('composition', 'page', 'style', 'expression')),
  content       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  embedding     VECTOR(1024) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_chunks_doc ON knowledge_chunks(doc_id);
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- ============================================================
-- 14. template_settings
-- ============================================================
CREATE TABLE template_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  color_scheme    JSONB NOT NULL DEFAULT '{
    "navy": "1A2B4A",
    "green": "6B8E7F",
    "beige": "E8D5C4",
    "offWhite": "F9F7F4",
    "textPrimary": "2A2A2A",
    "textSecondary": "666666",
    "white": "FFFFFF"
  }',
  font_settings   JSONB NOT NULL DEFAULT '{
    "japanese": "Zen Kaku Gothic New",
    "english": "Montserrat",
    "fallback": "Arial"
  }',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_template_settings_team ON template_settings(team_id);

-- ============================================================
-- Trigger: auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger will need team_id to be set after profile creation.
-- For invitation-based signup, we'll handle team assignment in the application layer.

-- ============================================================
-- Helper function for RLS
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
