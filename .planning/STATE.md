# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Real-time semantic scoring (0-120) that compares user content against SERP benchmarks and provides actionable term-by-term recommendations.
**Current focus:** Phase 2 - Module IAssistant

## Current Position

Phase: 4 of 6 (Modules Intention & Meta)
Plan: 02 of 02 completed
Status: Phase 4 complete
Last activity: 2026-03-19 — Completed Phase 4 verification (passed 10/10 must-haves)

Progress: [███████░░░] 70% (7/10 total plans across Phases 1-4)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 6.1 min
- Total execution time: 0.72 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-ai-foundation | 3/3 | 22 min | 7.3 min |
| 02-module-iassistant | 2/2 | 17 min | 8.5 min |
| 04-modules-intention-meta | 2/2 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 02-01 (5min), 02-02 (12min), 04-01 (3min), 04-02 (4min)
- Trend: Excellent velocity (Phase 4 avg 3.5 min, best performance yet)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

**Phase 04-02 (Meta Generation & Panel Fixes):**
- GPT-4o Mini for meta generation — Cost efficiency for frequent meta tag operations
- Server-side validation before returning — Filter suggestions with title 30-70 chars, description 80-200 chars
- Disable suggest button when content insufficient — Added plainText.trim().length < 10 to disabled condition
- Comprehensive error handling — All error paths show toast notifications, no silent catch blocks

**Phase 04-01 (Intention Module API):**
- Non-streaming approach for JSON responses — Standard streaming doesn't work for JSON endpoints, need full response before parsing
- extractJSON with 3 fallback strategies — Handles LLM output variations (direct JSON, markdown-wrapped, embedded)
- Content truncated to 2000 chars for analysis — Balances context quality vs token cost
- Intent descriptions hardcoded in analyze route — Provides clear guidance to LLM for French SEO context
- Error handling with toast notifications — Replaced silent failures with user-friendly messages

**Phase 02-02 (IAssistant UI Integration):**
- Removed hard-coded PUBLIC_PROMPTS in favor of database fetch — AssistantPanel now uses GET /api/prompts
- Captured selection before execution to preserve range after Dialog steals focus — Dialog.open resets editor selection
- AI SDK v5 compatibility: model type cast via unknown, usage property fallback (promptTokens/inputTokens) — streamText API differences from v4
- Removed maxTokens parameter (not supported in AI SDK v5 streamText API) — Model-specific defaults used instead

**Phase 02-01 (IAssistant Infrastructure):**
- Editor instance stored in Zustand for global access — Needed by AssistantPanel for selection detection
- 15 public prompts seeded with NULL owner_id — Shared across all users
- Prompt templates use context variables matching context-builder.ts pattern — {keyword}, {semantic_terms}, {selected_text}, {content}, {audience}, {tone}
- ON CONFLICT DO NOTHING in migration — Allows safe re-runs

**Phase 01-02 (Prompt Executor & API):**
- toTextStreamResponse() for raw text (not chat protocol) — Single-prompt execution, not multi-turn chat
- Caller-injectable onFinish callback — Route handler owns DB writes, executor stays generic
- maxDuration=30 prevents timeout — AI responses can take 15-30s
- Supabase client captured in closure — onFinish runs async, needs access to client and user.id
- Hard-coded pricing in executor — Current as of 2026-03, easy to update

**Phase 01-03 (AI Data Layer):**
- AiStatus lifecycle: 'idle' | 'loading' | 'streaming' | 'success' | 'error' — Full execution flow tracking
- acceptResult returns string | null — UI component needs result text for editor insertion
- streamedText reset before each execution — Prevents result bleeding
- ai_requests.prompt_id ON DELETE SET NULL — Preserves cost history if prompt deleted
- prompt_context JSONB on guides — Flexible schema for user-defined context

**Phase 01-01 (AI Infrastructure):**
- AI SDK v5 provider pattern instead of createProviderRegistry — Compatibility with v5 API
- Task-type to model mapping (8 types) — Claude for planning/analysis, GPT for editing/cost
- Start with gpt-4o/gpt-4o-mini (not GPT-5) — De-risk initial implementation, enable gradual upgrades
- Separate system prompts from user content — Security (prevent prompt injection, OWASP LLM01)
- Top 20 terms in templates, top 10 in system messages — Balance detail vs token usage

**Previous decisions:**
- Sprint 3: Multi-LLM routing (Claude + GPT) — Redundancy, cost optimization, use best model for each task
- Sprint 2: ioredis vs Upstash REST — ioredis unified client for better performance (already implemented)
- Sprint 1: TipTap vs Slate/Lexical — TipTap has excellent ProseMirror foundation (working well)

### Pending Todos

None yet.

### Blockers/Concerns

**Database Setup Required (01-03, 02-01):**
- ⚠️ Supabase environment not configured yet
- Migrations 003, 004, 005, 006 ready to apply (prompts, ai_requests, prompt_context, seed prompts)
- Run `supabase db push` when Supabase project is linked
- Migration 006 seeds 15 public prompts for IAssistant

**API Keys Required (01-01):**
- ✅ AI SDK packages installed
- ⚠️ Anthropic API key must be configured (see .env.example)
- ⚠️ OpenAI API key must be configured (see .env.example)
- Required for POST /api/ai/execute endpoint

**Cost Monitoring:**
- ✅ ai_requests table created (tracks tokens and estimated costs)
- ✅ POST /api/ai/execute endpoint logs all requests via onFinish callback
- ✅ estimateCost() utility calculates USD cost from token usage

**Prompt Quality:**
- Initial prompt templates are hypotheses — Phase 2 should include A/B testing
- Monitor user satisfaction (thumbs up/down), edit rate, retry rate

**AI SDK v5 Compatibility (02-02):**
- ✅ Fixed model type incompatibility (LanguageModelV3 → LanguageModel union)
- ✅ Fixed usage property names (promptTokens/inputTokens fallback)
- ✅ Removed unsupported maxTokens parameter
- Build now passes with AI SDK v5

## Session Continuity

Last session: 2026-03-19 19:52 — Phase 4 execution
Stopped at: Completed 04-02-PLAN.md (Meta Generation & Panel Fixes)
Resume file: None

Next step: Begin Phase 5 - Context System (user-defined context for AI prompts)
