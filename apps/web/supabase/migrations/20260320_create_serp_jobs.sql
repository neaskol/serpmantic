-- Create serp_jobs table for async SERP analysis
CREATE TABLE IF NOT EXISTS serp_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress_step TEXT CHECK (progress_step IN ('fetching', 'crawling', 'nlp', 'saving')),
  error_message TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_serp_jobs_guide_id ON serp_jobs(guide_id);
CREATE INDEX idx_serp_jobs_status ON serp_jobs(status);
CREATE INDEX idx_serp_jobs_created_at ON serp_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE serp_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own jobs
CREATE POLICY "Users can view own serp jobs"
  ON serp_jobs
  FOR SELECT
  USING (
    guide_id IN (
      SELECT id FROM guides WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert jobs for their own guides
CREATE POLICY "Users can create serp jobs for own guides"
  ON serp_jobs
  FOR INSERT
  WITH CHECK (
    guide_id IN (
      SELECT id FROM guides WHERE user_id = auth.uid()
    )
  );

-- Policy: System can update any job (for background worker)
CREATE POLICY "System can update serp jobs"
  ON serp_jobs
  FOR UPDATE
  USING (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_serp_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER serp_jobs_updated_at
  BEFORE UPDATE ON serp_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_serp_jobs_updated_at();

-- Comment
COMMENT ON TABLE serp_jobs IS 'Background jobs for SERP analysis to avoid Vercel timeout';
