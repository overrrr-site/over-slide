-- ブリーフシート拡張: 思考の流れ・却下案・キーフレーズ・議論ノート
ALTER TABLE brainstorm_sessions
  ADD COLUMN IF NOT EXISTS reasoning_chain TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rejected_alternatives TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS key_expressions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discussion_note TEXT NOT NULL DEFAULT '';

ALTER TABLE brief_sheets
  ADD COLUMN IF NOT EXISTS reasoning_chain TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rejected_alternatives TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS key_expressions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discussion_note TEXT NOT NULL DEFAULT '';
