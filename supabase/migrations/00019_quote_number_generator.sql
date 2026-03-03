-- ============================================================
-- 00019_quote_number_generator.sql
-- 見積番号を原子的に採番するRPC
-- ============================================================

CREATE OR REPLACE FUNCTION generate_quote_number(
  p_team_id UUID,
  p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_last_seq INTEGER;
BEGIN
  IF p_team_id IS NULL THEN
    RAISE EXCEPTION 'p_team_id is required';
  END IF;

  v_prefix := to_char(p_target_date, 'YYYYMMDD');

  -- 同一チーム・同一日付の採番を直列化
  PERFORM pg_advisory_xact_lock(hashtext(p_team_id::TEXT || ':' || v_prefix));

  SELECT
    MAX(
      CASE
        WHEN split_part(quote_number, '-', 2) ~ '^[0-9]+$'
          THEN split_part(quote_number, '-', 2)::INTEGER
        ELSE NULL
      END
    )
  INTO v_last_seq
  FROM quotes
  WHERE team_id = p_team_id
    AND quote_number LIKE v_prefix || '-%';

  RETURN v_prefix || '-' || lpad((COALESCE(v_last_seq, 0) + 1)::TEXT, 2, '0');
END;
$$;
