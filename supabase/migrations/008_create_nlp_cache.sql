-- NLP result cache: stores per-URL TextRazor analysis results (7-day TTL)
-- Reduces TextRazor API calls by reusing results for URLs that appear across multiple SERP analyses

CREATE TABLE IF NOT EXISTS nlp_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash TEXT NOT NULL,
  url TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('fr', 'en', 'it', 'de', 'es')),
  lemmas JSONB NOT NULL DEFAULT '[]',
  entities JSONB NOT NULL DEFAULT '[]',
  topics JSONB NOT NULL DEFAULT '[]',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(url_hash, language)
);

-- Fast lookup by URL hash + language (primary access pattern)
CREATE INDEX idx_nlp_cache_lookup ON nlp_cache(url_hash, language);

-- For cleanup queries: find entries older than 7 days
CREATE INDEX idx_nlp_cache_expiry ON nlp_cache(analyzed_at);
