-- ============================================================
-- Fix: Add missing DELETE policy for page_contents
-- Without this, RLS silently blocks DELETE operations,
-- causing the details API onFinish callback to fail.
-- ============================================================
CREATE POLICY "Team delete page contents"
  ON page_contents FOR DELETE
  USING (structure_id IN (
    SELECT s.id FROM structures s
    JOIN projects p ON s.project_id = p.id
    WHERE p.team_id = get_user_team_id()
  ));
