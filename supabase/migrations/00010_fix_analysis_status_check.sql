-- Fix: analysis_status CHECK constraint mismatch
-- Old: ('pending', 'analyzing', 'completed', 'failed')
-- New: ('pending', 'analyzing', 'analyzed', 'vectorized', 'error')

ALTER TABLE knowledge_docs DROP CONSTRAINT IF EXISTS knowledge_docs_analysis_status_check;
ALTER TABLE knowledge_docs ADD CONSTRAINT knowledge_docs_analysis_status_check
  CHECK (analysis_status IN ('pending', 'analyzing', 'analyzed', 'vectorized', 'error'));

-- Fix any existing rows with old status values
UPDATE knowledge_docs SET analysis_status = 'analyzed' WHERE analysis_status = 'completed';
UPDATE knowledge_docs SET analysis_status = 'error' WHERE analysis_status = 'failed';
