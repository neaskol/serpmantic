ALTER TABLE guides
ADD COLUMN IF NOT EXISTS prompt_context JSONB DEFAULT '{}';

COMMENT ON COLUMN guides.prompt_context IS 'User-defined context for AI prompt enrichment (audience, tone, sector, brief)';
