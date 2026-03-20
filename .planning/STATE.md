# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Real-time semantic scoring (0-120) that compares user content against SERP benchmarks and provides actionable term-by-term recommendations.
**Current focus:** Phase 2 - Module IAssistant

## Current Position

Phase: 6 of 6 (Testing & Quality)
Plan: 03 of 03 completed
Status: Phase complete
Last activity: 2026-03-20 — Completed 06-03-PLAN.md (Test Suite Validation & Quality Floor)

Progress: [████████████] 100% (14/14 completed plans across Phases 1-6)

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 5.6 min
- Total execution time: 1.31 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-ai-foundation | 3/3 | 22 min | 7.3 min |
| 02-module-iassistant | 2/2 | 17 min | 8.5 min |
| 03-module-plan | 2/2 | 13 min | 6.5 min |
| 04-modules-intention-meta | 2/2 | 7 min | 3.5 min |
| 05-context-system | 2/2 | 11 min | 5.5 min |
| 06-testing-quality | 3/3 | 19 min | 6.3 min |

**Recent Trend:**
- Last 5 plans: 03-02 (6min), 06-01 (7min), 06-02 (8min), 06-03 (4min)
- Trend: Consistent 4-8 min range, excellent velocity

*Updated after each plan completion*
*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

**Phase 06-03 (Test Suite Validation & Quality Floor):**
- Calibrated thresholds 5% below actual coverage (not at actual) to create achievable floor — Prevents regression while encouraging improvement, high floor (74-80%) reflects excellent existing coverage
- Set high thresholds reflecting 85%+ actual coverage — 236 tests pass with 85.95% statements, 85.5% lines, 79.16% functions, 74.92% branches
- Integration meta-test documents all 235+ tests for visibility — Living documentation of test strategy and module coverage

**Phase 06-01 (Unit Tests for AI Utilities & Scoring):**
- Focus on pure functions with clean input/output contracts — AI utility modules and scoring engine have no external dependencies, ideal for unit testing
- Organize tests by describe blocks matching source module structure — Clear mapping between source and tests
- Create mockTerm and mockSerpAnalysis helpers for test data — Database types have many required fields; helpers reduce boilerplate
- Edge case coverage in every module — Empty inputs, null values, boundary conditions, invalid data

**Phase 03-02 (Plan UI Integration):**
- Rough client-side over-optimization estimate (match count × 3) — Provides directional warning without backend scoring API call, labeled as approximate
- Text normalization via NFD (lowercase + remove accents) — Match semantic terms like "délégation" and "delegation" correctly
- Filter !is_to_avoid terms before over-optimization check — Only scoring-positive terms affect score, avoids false positives
- Skip over-optimization check if semanticTerms empty — No data to estimate from, prevents divide-by-zero errors
- window.confirm() for over-optimization warning — Native browser dialog blocks until user decides, simpler than custom Dialog

**Phase 05-02 (Context System UI Integration):**
- Sentinel value __none__ for null FK in base-ui Select — Base-nova Select onValueChange passes string | null, needs string sentinel
- Dynamic warning only when no contexts exist AND no active context — ContextSelector is sufficient if user has contexts
- FK context resolution with JSONB fallback — Execute route checks active_context_id first, falls back to prompt_context for backward compatibility
- Active context preview under selector — Shows audience/tone/sector for immediate feedback

**Phase 05-01 (Context System Data Layer):**
- active_context_id stored on guides, not separate junction table — Simpler for 1:1 relationship
- setActiveContext persists via PATCH /api/guides/[id] — Reuses existing endpoint, no new route needed
- initActiveContext separate from setActiveContext — Non-async initialization when guide loads
- deleteContext auto-clears activeContextId if deleted context was active — Prevents stale references
- Empty string defaults for audience/tone/sector/brief — Allows optional fields while keeping NOT NULL columns

**Phase 03-01 (AI Outline Generation API):**
- generateText (non-streaming) instead of streamText — Outline generation fast (<5s), need full response before JSON parsing
- XML-structured prompts for Claude Sonnet 4.5 — Claude 4.x excel with XML tags for structured input
- Graceful degradation when headings unavailable — Prompt uses titles when headings.length <= 2
- PostgrestError type guard (as { code, message }) — Supabase error types not properly exported
- AI SDK v5 usage property fallback — promptTokens/inputTokens compatibility across models

**Phase 04-02 (Meta Generation & Panel Fixes):**
- active_context_id stored on guides, not separate junction table — Simpler for 1:1 relationship
- setActiveContext persists via PATCH /api/guides/[id] — Reuses existing endpoint, no new route needed
- initActiveContext separate from setActiveContext — Non-async initialization when guide loads
- deleteContext auto-clears activeContextId if deleted context was active — Prevents stale references
- Empty string defaults for audience/tone/sector/brief — Allows optional fields while keeping NOT NULL columns

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

**Database Setup Required (01-03, 02-01, 03-01, 05-01):**
- ⚠️ Supabase environment not configured yet
- Migrations 003-007 ready to apply (prompts, ai_requests, seed prompts, headings, prompt_contexts)
- Run `supabase db push` when Supabase project is linked
- Migration 006 seeds 15 public prompts for IAssistant
- Migration 007 adds prompt_contexts table + active_context_id FK on guides (required for context system)

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

Last session: 2026-03-20 09:34 — Phase 6 execution
Stopped at: Completed 06-03-PLAN.md (Test Suite Validation & Quality Floor)
Resume file: None

Next step: All phases (1-6) complete! Project ready for production deployment or next milestone. Consider Phase 7 (Polish & Refinements) for production hardening.

## Quality Metrics

**Test Coverage (as of 06-03):**
- Total tests: 236 (1 skipped)
- Coverage: 85.95% statements, 85.5% lines, 79.16% functions, 74.92% branches
- Quality floor: 80/80/74/69 (prevents regression via vitest thresholds)

**Known gaps (acceptable):**
- SERP analysis route: 42% coverage (external service integration)
- AI registry: 12.5% coverage (not actively used)
- Logger production paths: 61.76% coverage (console output, not critical)

