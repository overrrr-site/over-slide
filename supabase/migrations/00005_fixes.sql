-- ============================================================
-- Fix 1: Drop unused handle_new_user trigger function
-- Profile creation is handled in the application layer (invitation-based signup)
-- ============================================================
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- ============================================================
-- Fix 2: Add unique index on structures(project_id, version)
-- Required for upsert with onConflict: "project_id,version"
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_structures_project_version
  ON structures(project_id, version);
