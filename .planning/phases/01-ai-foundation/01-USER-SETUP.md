# Phase 01-01: AI Foundation User Setup

This plan requires configuration of external AI services before the application can execute AI prompts.

## Required Services

### 1. Anthropic (Claude Models)

**Why:** AI prompt execution via Claude Sonnet 4/4.5 for planning and analysis tasks

**Get API Key:**
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create account
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the API key (starts with `sk-ant-...`)

**Set Environment Variable:**

```bash
# Add to apps/web/.env.local
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx...
```

**Verify:**
```bash
# Check API key is loaded (run from apps/web/)
node -e "console.log(process.env.ANTHROPIC_API_KEY ? 'Anthropic API key configured' : 'ERROR: Missing key')"
```

---

### 2. OpenAI (GPT Models)

**Why:** AI prompt execution via GPT-4o/GPT-4o-mini for editing, grammar, and cost-sensitive tasks

**Get API Key:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Click **Create new secret key**
4. Name it (e.g., "SERPmantics Dev")
5. Copy the API key (starts with `sk-proj-...` or `sk-...`)

**Set Environment Variable:**

```bash
# Add to apps/web/.env.local
OPENAI_API_KEY=sk-proj-xxxxx...
```

**Verify:**
```bash
# Check API key is loaded (run from apps/web/)
node -e "console.log(process.env.OPENAI_API_KEY ? 'OpenAI API key configured' : 'ERROR: Missing key')"
```

---

## Environment File Template

Create or update `apps/web/.env.local`:

```bash
# AI Providers (Phase 01-01)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx...
OPENAI_API_KEY=sk-proj-xxxxx...

# Add your existing environment variables below
# (Supabase, Redis, etc.)
```

**Security:**
- `.env.local` is gitignored by default in Next.js
- Never commit API keys to version control
- Use different keys for development and production

---

## Cost Monitoring

**Anthropic:**
- View usage: [Anthropic Console - Usage](https://console.anthropic.com/settings/usage)
- Set up billing alerts in console

**OpenAI:**
- View usage: [OpenAI Platform - Usage](https://platform.openai.com/usage)
- Set up billing limits in console (recommended: $50/month soft limit)

**Estimated Costs (Phase 1):**
- Development/testing: ~$5-10/month
- Production (100 users × 10 guides/mo): ~$50/month
- Cost tracking will be implemented in Phase 01-03 (ai_requests table)

---

## Verification

After setting both API keys, verify the AI SDK can load:

```bash
cd apps/web
node -e "require('ai'); console.log('AI SDK loaded successfully')"
```

Expected output: `AI SDK loaded successfully`

If you see errors, check:
1. Both environment variables are set in `.env.local`
2. Restart your development server after adding env vars
3. API keys are valid (test in respective consoles)

---

## Next Steps

Once both API keys are configured:
1. Restart your Next.js dev server: `pnpm dev`
2. Phase 01-02 (Prompt Executor) can now execute AI requests
3. Monitor costs in both provider consoles during development

---

*Setup required for: Phase 01-ai-foundation, Plan 01-01*
*Created: 2026-03-19*
