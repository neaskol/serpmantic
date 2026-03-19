-- Add headings column to serp_pages table
-- Stores structured heading data extracted from SERP competitor pages
-- Used by AI Outline Generation API to analyze common heading patterns

ALTER TABLE public.serp_pages
ADD COLUMN headings JSONB DEFAULT '[]' NOT NULL;

COMMENT ON COLUMN public.serp_pages.headings IS
'Extracted H2/H3 headings from competitor pages. Structure: [{"level": 2, "text": "Heading text", "position": 0}]';
