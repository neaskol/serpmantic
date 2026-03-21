-- Allow anonymous users to read public prompts
-- Fixes: IAssistant tab showing no prompts when auth session not refreshed on API routes
CREATE POLICY "Public prompts visible to everyone"
  ON prompts FOR SELECT
  TO anon
  USING (is_public = true);
