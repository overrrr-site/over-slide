-- ============================================================
-- v3.0 Schema Changes
-- ============================================================

-- 1. projects に output_type を追加（スライド / ドキュメント 選択）
ALTER TABLE projects ADD COLUMN output_type TEXT NOT NULL DEFAULT 'slide'
  CHECK (output_type IN ('slide', 'document'));

-- 2. generated_files の file_type に 'docx' を追加
ALTER TABLE generated_files DROP CONSTRAINT IF EXISTS generated_files_file_type_check;
ALTER TABLE generated_files ADD CONSTRAINT generated_files_file_type_check
  CHECK (file_type IN ('pptx', 'pdf', 'docx'));

-- 3. knowledge_docs に purpose カラムを追加（モードA: style / モードB: content）
ALTER TABLE knowledge_docs ADD COLUMN purpose TEXT NOT NULL DEFAULT 'style'
  CHECK (purpose IN ('style', 'content'));

-- 4. knowledge_docs の doc_type を拡張
ALTER TABLE knowledge_docs DROP CONSTRAINT IF EXISTS knowledge_docs_doc_type_check;
ALTER TABLE knowledge_docs ADD CONSTRAINT knowledge_docs_doc_type_check
  CHECK (doc_type IN ('pptx', 'pdf', 'docx', 'xlsx', 'csv', 'text', 'markdown', 'other'));

-- 5. knowledge_chunks の chunk_type を拡張
ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_chunk_type_check;
ALTER TABLE knowledge_chunks ADD CONSTRAINT knowledge_chunks_chunk_type_check
  CHECK (chunk_type IN ('composition', 'page', 'style', 'expression', 'reviewer_profile', 'content'));

-- 6. style_guide テーブルを新規作成
CREATE TABLE style_guide (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  composition_patterns JSONB,
  tone       JSONB,
  information_density  JSONB,
  phrases    JSONB,
  custom_rules JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_style_guide_user ON style_guide(user_id);

-- 7. style_guide の RLS
ALTER TABLE style_guide ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own style guide"
  ON style_guide FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own style guide"
  ON style_guide FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own style guide"
  ON style_guide FOR UPDATE
  USING (user_id = auth.uid());
