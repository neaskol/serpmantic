-- Create prompt_contexts table
CREATE TABLE prompt_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  audience TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  brief TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prompt_contexts ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only manage their own contexts
CREATE POLICY "Users can view own contexts"
  ON prompt_contexts FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own contexts"
  ON prompt_contexts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own contexts"
  ON prompt_contexts FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own contexts"
  ON prompt_contexts FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Add FK on guides to reference active context
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS active_context_id UUID REFERENCES prompt_contexts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_prompt_contexts_user ON prompt_contexts (user_id);
CREATE INDEX idx_guides_active_context ON guides (active_context_id);
