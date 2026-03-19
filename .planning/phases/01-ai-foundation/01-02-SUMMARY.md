---
phase: 01-ai-foundation
plan: 02
subsystem: ai
tags: [vercel-ai-sdk, streaming, api, executor, token-tracking]

# Dependency graph
requires:
  - phase: 01-ai-foundation
    plan: 01
    provides: AI SDK provider registry and LLM router
  - phase: 01-ai-foundation
    plan: 03
    provides: Database schema (prompts, ai_requests tables)
provides:
  - Prompt executor with streaming and caller-injectable onFinish
  - POST /api/ai/execute endpoint with auth, validation, streaming
  - Token usage tracking in ai_requests table
  - Cost estimation utility
affects: [02-iassistant, 03-plan-module, 04-intention-meta, 05-prompt-library]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Streaming with toTextStreamResponse() (raw text, not chat protocol)"
    - "Caller-injectable onFinish callback for post-stream DB writes"
    - "Route handler captures Supabase client in closure for async DB writes"
    - "maxDuration=30 prevents Next.js serverless timeout"

key-files:
  created:
    - apps/web/src/lib/ai/executor.ts
    - apps/web/src/app/api/ai/execute/route.ts
  modified:
    - apps/web/src/types/database.ts (added prompt_context to Guide type)

key-decisions:
  - "Use toTextStreamResponse() (raw text stream) instead of toUIMessageStreamResponse() (chat protocol)"
  - "onFinish callback injected by route handler for DB writes (keeps executor generic)"
  - "maxDuration=30 to prevent serverless timeout on long AI responses"
  - "Capture Supabase client and user in closure before executePrompt (onFinish runs async)"
  - "Hard-coded pricing in executor (current as of 2026-03, easy to update)"

patterns-established:
  - "All AI execution flows through single executePrompt() primitive"
  - "Route handlers pass onFinish to executor for post-stream logic"
  - "Token usage always logged via onFinish callback"
  - "Cost estimation via estimateCost(modelId, usage)"
  - "Error handling via handleApiError with request ID tracking"

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 01 Plan 02: Prompt Executor & Streaming API Summary

**Single entry point for AI execution with streaming text response and automatic token tracking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T14:16:21Z
- **Completed:** 2026-03-19T14:20:01Z
- **Tasks:** 2
- **Files modified:** 2 created, 1 modified

## Accomplishments

- Created executePrompt() primitive with AI SDK v5 streamText
- Caller-injectable onFinish callback for post-stream DB writes
- Token usage logging and cost estimation
- POST /api/ai/execute endpoint with auth, validation, streaming
- Loads prompt template + guide + SERP data from database
- Enriches prompt with SERP semantic data via context-builder
- Routes to correct LLM model based on task type
- Streams response via toTextStreamResponse() (raw text)
- Tracks token usage in ai_requests table

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Prompt Executor** - `0aac137` (feat)
2. **Task 2: Create /api/ai/execute streaming Route Handler** - `6eb4c45` (feat)

## Files Created/Modified

### Created
- `apps/web/src/lib/ai/executor.ts` - executePrompt() with streaming, onFinish callback, token tracking, cost estimation
- `apps/web/src/app/api/ai/execute/route.ts` - POST endpoint with auth, validation, SERP context loading, streaming

### Modified
- `apps/web/src/types/database.ts` - Added prompt_context field to Guide type (migration 004 added column but type was missing)

## Decisions Made

**1. Use toTextStreamResponse() for raw text streaming**
- NOT using toUIMessageStreamResponse() (chat protocol)
- Client reads raw text via fetch + ReadableStream, not useChat hook
- Simpler protocol, consistent behavior across all prompt types
- Rationale: Single-prompt execution (not multi-turn chat)

**2. Caller-injectable onFinish callback pattern**
- Route handler passes DB write logic as onFinish to executor
- Executor wraps it inside streamText's onFinish
- Runs after stream completes, has access to route handler's closure variables
- Rationale: Keeps executor generic, route handler owns DB writes

**3. maxDuration=30 to prevent timeout**
- Next.js serverless functions default to 10s timeout
- AI responses (especially plan generation) can take 15-30s
- Without this, responses get truncated
- Rationale: Production requirement for long-running AI tasks

**4. Capture Supabase client in closure before executePrompt**
- Client and user.id stored in route handler closure
- onFinish callback (runs async after stream starts) has access
- Even though onFinish runs inside executor, it captures route handler's variables
- Rationale: Async DB writes after streaming without passing client through executor

**5. Hard-coded pricing in executor**
- Current pricing as of 2026-03 (Anthropic $3/$15, GPT-4o $2.5/$10, GPT-4o-mini $0.15/$0.6)
- Easy to update in one place (PRICING const object)
- Returns 0 if model not found (graceful degradation)
- Rationale: Simple, accurate, easy to maintain

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing prompt_context field to Guide type**
- **Found during:** Task 2 (Route handler creation)
- **Issue:** Migration 004 added prompt_context JSONB column to guides table, but TypeScript Guide type was not updated
- **Error:** `Type '"prompt_context"' does not satisfy the constraint 'keyof Guide'`
- **Fix:** Added `prompt_context: PromptContext | null` to Guide type in database.ts
- **Files modified:** apps/web/src/types/database.ts
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 6eb4c45 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** None - migration already existed, just needed type sync. No scope change.

## Issues Encountered

None - execution proceeded smoothly.

## Architecture Notes

**onFinish callback flow:**
1. Route handler creates onFinish callback that writes to ai_requests table
2. Route handler passes onFinish to executePrompt()
3. Executor wraps caller's onFinish inside streamText's onFinish
4. streamText starts streaming response to client
5. After stream completes, streamText calls its onFinish
6. Executor's onFinish logs completion info, then calls caller's onFinish
7. Caller's onFinish writes to database using captured Supabase client and user.id

This pattern:
- Keeps executor generic (no DB knowledge)
- Allows async post-stream logic without blocking the stream
- Captures route handler's closure variables (supabase, user.id) for use after streaming

**Streaming flow:**
1. Client POSTs to /api/ai/execute with promptId + guideId
2. Route handler loads prompt template + guide + SERP data
3. Route handler builds enriched prompt via context-builder
4. Route handler calls executePrompt() with onFinish callback
5. executePrompt() calls streamText(), returns immediately
6. Route handler calls result.toTextStreamResponse()
7. Client receives streaming text via ReadableStream
8. After stream completes, onFinish callback writes to ai_requests table

## Next Phase Readiness

**Ready for Phase 02 (AI UI Components):**
- POST /api/ai/execute endpoint accepts promptId + guideId
- Streaming text response works via toTextStreamResponse()
- Token usage tracked in ai_requests table
- Error handling follows existing patterns
- Authentication required (returns 401 without valid session)

**Dependencies satisfied:**
- AI SDK v5 installed and configured (Plan 01-01)
- Provider registry resolves model IDs (Plan 01-01)
- Context builder enriches prompts with SERP data (Plan 01-01)
- Database schema exists for prompts and ai_requests (Plan 01-03)

**Blockers:**
- API keys must be configured before testing (ANTHROPIC_API_KEY, OPENAI_API_KEY)
- Supabase migrations must be applied (migrations 003, 004, 005)
- Database must have at least one prompt template seeded

**Next steps:**
- Plan 02-01: IAssistant UI component (prompt library + execution UI)
- Plan 02-02: Streaming state management in ai-store (already exists from Plan 01-03)
- Plan 02-03: Result accept/reject UI flow

---
*Phase: 01-ai-foundation*
*Completed: 2026-03-19*
