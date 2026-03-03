-- ============================================================
-- 00018_quote_orient_link.sql
-- quotes にオリエンシート連携情報を追加
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS origin_brainstorm_id UUID REFERENCES brainstorm_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orient_sheet_markdown TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_quotes_origin_brainstorm
  ON quotes(origin_brainstorm_id);
