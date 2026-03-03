-- ============================================================
-- Two-Stage Review: 7ステップワークフロー対応
-- 内容レビュー(step 4) + デザインレビュー(step 6) の2段階構造
-- ============================================================

-- 1. current_step の CHECK 制約を拡大 (0-6 → 0-7)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_current_step_check;

-- 2. 既存プロジェクトの step 番号をシフト (4以上を+1)
--    旧: 0=discussion, 1=research, 2=structure, 3=details, 4=design, 5=review
--    新: 0=discussion, 1=research, 2=structure, 3=details, 4=content-review, 5=design, 6=design-review
--    降順で更新して衝突を回避
UPDATE projects SET current_step = 6 WHERE current_step = 5;
UPDATE projects SET current_step = 5 WHERE current_step = 4;

-- 3. 新しい制約を追加
ALTER TABLE projects ADD CONSTRAINT projects_current_step_check CHECK (current_step BETWEEN 0 AND 7);

-- 4. reviews テーブルに review_type カラムを追加
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_type TEXT NOT NULL DEFAULT 'design'
  CHECK (review_type IN ('content', 'design'));
