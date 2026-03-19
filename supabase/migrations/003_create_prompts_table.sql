CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  llm_provider TEXT NOT NULL CHECK (llm_provider IN ('anthropic', 'openai')),
  model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  system_prompt TEXT,
  scope TEXT NOT NULL DEFAULT 'document' CHECK (scope IN ('selection', 'document', 'full')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public prompts visible to authenticated users"
  ON prompts FOR SELECT
  TO authenticated
  USING (is_public = true OR owner_id = (SELECT auth.uid()));

CREATE POLICY "Owners can modify their prompts"
  ON prompts FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE INDEX idx_prompts_public ON prompts (is_public) WHERE is_public = true;
CREATE INDEX idx_prompts_owner ON prompts (owner_id);
CREATE INDEX idx_prompts_category ON prompts (category);
