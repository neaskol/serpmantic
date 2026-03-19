-- ============================================================================
-- Performance Optimization Indexes
-- Sprint 2 - Phase 3: Query Optimization
-- ============================================================================

-- Guides table indexes
-- Most common query: SELECT * FROM guides WHERE user_id = ? ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_guides_user_id ON public.guides(user_id);
CREATE INDEX IF NOT EXISTS idx_guides_user_id_updated_at ON public.guides(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_guides_keyword ON public.guides(keyword);
CREATE INDEX IF NOT EXISTS idx_guides_created_at ON public.guides(created_at DESC);

-- SERP analyses indexes
-- Common join: serp_analyses.guide_id = guides.id
CREATE INDEX IF NOT EXISTS idx_serp_analyses_guide_id ON public.serp_analyses(guide_id);
CREATE INDEX IF NOT EXISTS idx_serp_analyses_keyword_language ON public.serp_analyses(keyword, language);

-- SERP pages indexes
-- Common join through serp_analysis_id
CREATE INDEX IF NOT EXISTS idx_serp_pages_serp_analysis_id ON public.serp_pages(serp_analysis_id);
CREATE INDEX IF NOT EXISTS idx_serp_pages_position ON public.serp_pages(serp_analysis_id, position);

-- Semantic terms indexes
-- Common join and filtering
CREATE INDEX IF NOT EXISTS idx_semantic_terms_serp_analysis_id ON public.semantic_terms(serp_analysis_id);
CREATE INDEX IF NOT EXISTS idx_semantic_terms_is_to_avoid ON public.semantic_terms(serp_analysis_id, is_to_avoid);
CREATE INDEX IF NOT EXISTS idx_semantic_terms_is_main_keyword ON public.semantic_terms(serp_analysis_id, is_main_keyword);

-- Guide groups indexes
CREATE INDEX IF NOT EXISTS idx_guide_groups_user_id ON public.guide_groups(user_id);

-- ============================================================================
-- Query Performance Analysis
-- ============================================================================

-- Before indexes:
-- Query: SELECT * FROM guides WHERE user_id = ? ORDER BY updated_at DESC
-- Expected improvement: ~10x faster (sequential scan → index scan)
--
-- Query: SELECT * FROM guides WHERE user_id = ? AND keyword = ?
-- Expected improvement: ~5x faster (composite index covers both columns)
--
-- RLS policy subqueries (serp_analyses, serp_pages, semantic_terms):
-- Expected improvement: ~3-5x faster (index on guide_id enables efficient joins)

-- ============================================================================
-- Verification Queries (run these to test performance)
-- ============================================================================

-- 1. Verify index usage for main guides query
-- EXPLAIN ANALYZE SELECT * FROM guides WHERE user_id = 'some-uuid' ORDER BY updated_at DESC;

-- 2. Verify serp_analyses join performance
-- EXPLAIN ANALYZE
-- SELECT sa.* FROM serp_analyses sa
-- JOIN guides g ON sa.guide_id = g.id
-- WHERE g.user_id = 'some-uuid';

-- 3. Check index sizes
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;
