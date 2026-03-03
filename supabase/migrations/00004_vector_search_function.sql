-- ============================================================
-- Vector similarity search function for knowledge base
-- ============================================================

CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  query_embedding text,
  match_team_id uuid,
  match_chunk_types text[] DEFAULT NULL,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  chunk_type text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.chunk_type,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding::vector) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_docs kd ON kd.id = kc.doc_id
  WHERE kd.team_id = match_team_id
    AND (match_chunk_types IS NULL OR kc.chunk_type = ANY(match_chunk_types))
    AND 1 - (kc.embedding <=> query_embedding::vector) > match_threshold
  ORDER BY kc.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;
