---
phase: 01-ai-foundation
plan: 01
subsystem: ai
tags: [vercel-ai-sdk, anthropic, openai, claude, gpt, llm-routing, prompt-enrichment]

# Dependency graph
requires:
  - phase: none (first phase)
    provides: N/A
provides:
  - AI SDK v5 with multi-provider support (Anthropic + OpenAI)
  - Provider registry for model resolution
  - Task-type to model routing (8 task types)
  - SERP-aware prompt enrichment system
affects: [01-02-prompt-executor, 01-03-database-tables, 02-iassistant, 03-plan-module, 04-intention-meta]

# Tech tracking
tech-stack:
  added:
    - ai@5.0.156 (Vercel AI SDK)
    - @ai-sdk/anthropic@3.0.58
    - @ai-sdk/openai@3.0.41
    - @ai-sdk/react@3.0.118
  patterns:
    - Multi-LLM routing based on task type
    - SERP-aware prompt context building
    - Template variable replacement for dynamic prompts
    - RCCF system prompt format (Role-Context-Constraint-Format)

key-files:
  created:
    - apps/web/src/lib/ai/registry.ts
    - apps/web/src/lib/ai/router.ts
    - apps/web/src/lib/ai/context-builder.ts
  modified:
    - apps/web/package.json (added AI SDK packages)

key-decisions:
  - "Use AI SDK v5 provider pattern instead of createProviderRegistry (API compatibility)"
  - "Map 8 task types to optimal models: Claude for planning/analysis, GPT for editing/cost-sensitive"
  - "Start with gpt-4o/gpt-4o-mini (well-tested), defer GPT-5 to database overrides"
  - "Separate system prompts from user content for security (prevent prompt injection)"
  - "Top 20 semantic terms in templates, top 10 in system messages"

patterns-established:
  - "Model IDs format: 'provider/model-name' (e.g., 'anthropic/claude-sonnet-4-5-20250929')"
  - "All model selection via router.getModelForTask() - no hardcoded IDs elsewhere"
  - "Template variables use {variable_name} pattern with 11 supported variables"
  - "buildPromptContext() transforms DB types to PromptContext shape"
  - "System prompts include SERP terms + over-optimization warnings"

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 1 Plan 1: AI Foundation Infrastructure Summary

**Multi-LLM routing with Claude Sonnet 4.5 for planning, GPT-4o for editing, plus SERP-aware prompt enrichment via 11 template variables**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-19T13:57:05Z
- **Completed:** 2026-03-19T14:05:36Z
- **Tasks:** 2
- **Files modified:** 3 created, 1 modified

## Accomplishments
- Installed AI SDK v5 with Anthropic and OpenAI providers
- Created provider registry that resolves model IDs for both providers
- Built LLM router mapping 8 task types to optimal models (Claude for complex reasoning, GPT for speed/cost)
- Implemented context builder that enriches prompts with SERP semantic data, structural benchmarks, and user context
- Template system supports 11 variables with graceful fallbacks
- RCCF-formatted system prompts include SERP-aware instructions and over-optimization warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Install AI SDK and create Provider Registry + LLM Router** - `7d0c41a` (feat)
2. **Task 2: Create Context Builder for prompt enrichment** - `963f480` (feat)

## Files Created/Modified

Created:
- `apps/web/src/lib/ai/registry.ts` - Provider registry with getModel() helper, resolves 'provider/model-name' IDs
- `apps/web/src/lib/ai/router.ts` - Maps 8 task types to models, extracts provider from model ID
- `apps/web/src/lib/ai/context-builder.ts` - Enriches prompts with SERP data, 11 template variables, RCCF system messages

Modified:
- `apps/web/package.json` - Added ai@5.0.156, @ai-sdk/anthropic@3.0.58, @ai-sdk/openai@3.0.41, @ai-sdk/react@3.0.118

## Decisions Made

**1. AI SDK v5 Provider Pattern**
- AI SDK v5 uses direct provider instances, not createProviderRegistry
- Registry pattern: `{ anthropic, openai }` with manual resolution in getModel()
- Rationale: Matches AI SDK v5 API, simpler than middleware registry

**2. Task-Type to Model Mapping**
- Claude Sonnet 4.5: plan_generation (structured outline)
- Claude Sonnet 4: introduction, intent_analysis (narrative/reasoning)
- GPT-4o: grammar_check, media_suggestions (rule-based, multimodal)
- GPT-4o Mini: content_editing, semantic_optimization, meta_generation (cost-sensitive)
- Rationale: Match model strengths to task requirements, optimize cost vs quality

**3. Start with GPT-4o/GPT-4o-mini (not GPT-5)**
- gpt-4o and gpt-4o-mini are well-tested and stable
- Database prompts table can override with GPT-5 model IDs later without code changes
- Rationale: De-risk initial implementation, enable gradual model upgrades

**4. Template Variable Count**
- Templates get top 20 semantic terms (detailed context)
- System messages get top 10 terms (focused guidance)
- Rationale: Balance detail vs prompt length, avoid token bloat

**5. Security-First Prompt Design**
- Separate system prompts from user content
- User text in `prompt` parameter, SERP instructions in `system` parameter
- Rationale: Prevent prompt injection attacks, OWASP LLM01 mitigation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed AI SDK v5 API compatibility**
- **Found during:** Task 1 (Provider Registry creation)
- **Issue:** createProviderRegistry() not compatible with v5 provider types (v3 spec vs v2 expected)
- **Fix:** Changed to direct provider instances pattern: `{ anthropic, openai }` with manual getModel() resolution
- **Files modified:** apps/web/src/lib/ai/registry.ts
- **Verification:** TypeScript compilation passes with --skipLibCheck, no API errors
- **Committed in:** 7d0c41a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for AI SDK v5 compatibility. No scope change - registry still resolves model IDs for both providers as specified.

## Issues Encountered

None - execution proceeded smoothly after API compatibility fix.

## User Setup Required

**External services require manual configuration.** See [01-USER-SETUP.md](./01-USER-SETUP.md) for:
- ANTHROPIC_API_KEY environment variable
- OPENAI_API_KEY environment variable
- Verification: Both providers can resolve model IDs without errors

## Next Phase Readiness

**Ready for Phase 01-02 (Prompt Executor):**
- Provider registry resolves model IDs for Anthropic and OpenAI
- Router maps task types to optimal models
- Context builder produces enriched prompts with SERP data
- Template variable replacement works for all 11 variables
- System message generation includes over-optimization warnings

**Dependencies satisfied:**
- AI SDK v5 installed and configured
- Type-safe interfaces for PromptContext
- getModel() tested with both providers

**Blockers:**
- API keys must be configured before executor can run (documented in USER-SETUP.md)
- Cost monitoring not yet implemented (tracked in State blockers, planned for plan 01-03)

---
*Phase: 01-ai-foundation*
*Completed: 2026-03-19*
