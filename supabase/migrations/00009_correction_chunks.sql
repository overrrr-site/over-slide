-- ============================================================
-- Correction Learning: 修正パターンをRAGで蓄積
-- chunk_type に 'correction' を追加
-- doc_type に 'correction' を追加（仮ドキュメント用）
-- ============================================================

-- 1. knowledge_chunks の chunk_type CHECK を更新
ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_chunk_type_check;
ALTER TABLE knowledge_chunks ADD CONSTRAINT knowledge_chunks_chunk_type_check
  CHECK (chunk_type IN ('composition', 'page', 'style', 'expression', 'correction'));

-- 2. knowledge_docs の doc_type CHECK を更新（修正学習用仮ドキュメント対応）
ALTER TABLE knowledge_docs DROP CONSTRAINT IF EXISTS knowledge_docs_doc_type_check;
ALTER TABLE knowledge_docs ADD CONSTRAINT knowledge_docs_doc_type_check
  CHECK (doc_type IN ('pptx', 'pdf', 'other', 'correction'));

-- 3. analysis_status にも 'vectorized' を追加（vectorize APIが使用）
ALTER TABLE knowledge_docs DROP CONSTRAINT IF EXISTS knowledge_docs_analysis_status_check;
ALTER TABLE knowledge_docs ADD CONSTRAINT knowledge_docs_analysis_status_check
  CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed', 'vectorized'));
