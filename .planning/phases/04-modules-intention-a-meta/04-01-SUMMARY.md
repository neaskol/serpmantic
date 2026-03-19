---
phase: 04-modules-intention-meta
plan: 01
subsystem: api
tags: [ai, claude, intent-analysis, nlp, error-handling, api-routes]

# Dependency graph
requires:
  - phase: 01-ai-foundation
    provides: executePrompt, getModelForTask, error handling patterns
  - phase: 02-module-iassistant
    provides: AI execution patterns, streaming/non-streaming approaches
provides:
  - POST /api/ai/intention - Search intent classification (4-way analysis)
  - POST /api/ai/intention/analyze - Content-intent alignment analysis
  - extractJSON utility for robust JSON parsing from LLM responses
  - Error handling pattern for IntentionPanel UI (toast notifications)
affects: [05-context-system, future-api-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-streaming LLM execution pattern (await result.text + extractJSON)"
    - "JSON extraction with multiple fallback strategies (direct parse → markdown → embedded)"
    - "User-facing error messages with toast.error for API failures"

key-files:
  created:
    - apps/web/src/lib/ai/json-extractor.ts
    - apps/web/src/app/api/ai/intention/route.ts
    - apps/web/src/app/api/ai/intention/analyze/route.ts
  modified:
    - apps/web/src/components/analysis/intention-panel.tsx

key-decisions:
  - "Non-streaming approach for JSON responses - need full text before parsing"
  - "extractJSON with 3 fallback strategies handles LLM markdown wrapping variations"
  - "Content truncated to 2000 chars for analysis - balances context vs token cost"
  - "Intent descriptions hardcoded in analyze route - matches French SEO context"

patterns-established:
  - "Pattern 1: Non-streaming JSON extraction - executePrompt → await result.text → extractJSON → return JSON"
  - "Pattern 2: Empty catch blocks replaced with toast.error + user-friendly messages"
  - "Pattern 3: Check res.ok before parsing, show specific error from API response"

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 04 Plan 01: Intention Module API Summary

**Search intent classification and content-intent alignment API routes using Claude Sonnet 4, with robust JSON extraction utility and user-facing error handling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T16:47:41Z
- **Completed:** 2026-03-19T16:51:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- POST /api/ai/intention returns 4-way intent classification (informationnel, transactionnel, navigationnel, comparatif) with confidence percentages, descriptions, and example questions
- POST /api/ai/intention/analyze returns content-intent alignment with matched/missing intents and 3-5 actionable suggestions
- extractJSON utility handles markdown-wrapped JSON, embedded JSON, and clean responses with 3 fallback strategies
- IntentionPanel shows toast notifications on API errors instead of silent failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JSON extraction utility and Intent Classification API route** - `4c277e7` (feat)
2. **Task 2: Create Content-Intent Alignment API route and add error handling to IntentionPanel** - `d4bcd53` (feat)

## Files Created/Modified
- `apps/web/src/lib/ai/json-extractor.ts` - Robust JSON extraction with 3 fallback strategies (direct parse, markdown blocks, embedded objects)
- `apps/web/src/app/api/ai/intention/route.ts` - Search intent classification endpoint (keyword + SERP pages → 4-way intent breakdown)
- `apps/web/src/app/api/ai/intention/analyze/route.ts` - Content-intent alignment endpoint (content + intents → coverage analysis + suggestions)
- `apps/web/src/components/analysis/intention-panel.tsx` - Added toast error handling, replaced empty catch blocks

## Decisions Made

**Non-streaming approach for JSON responses:**
- Standard streaming pattern (toTextStreamResponse) doesn't work for JSON endpoints
- Solution: await result.text to get full response, then parse with extractJSON
- Rationale: Need complete response before JSON.parse, streaming would require client-side buffering

**extractJSON with multiple fallback strategies:**
- LLMs inconsistently wrap JSON (sometimes markdown, sometimes raw, sometimes with explanation text)
- Strategy 1: Try direct JSON.parse (clean responses)
- Strategy 2: Extract from markdown code blocks with regex
- Strategy 3: Find first {...} object in text
- Rationale: Maximizes reliability across different LLM outputs without requiring strict prompt adherence

**Content truncation to 2000 chars:**
- Full content analysis would consume excessive tokens (user content can be 5000+ words)
- First 2000 chars capture introduction, headings, and core content
- Rationale: Balance context quality vs cost, intent coverage usually evident in opening sections

**Intent descriptions hardcoded:**
- INTENT_DESCRIPTIONS map in analyze route defines what each intent type should contain
- French SEO context: "informationnel: educational content, explanations, how-to guides, FAQs"
- Rationale: Provides clear guidance to LLM, keeps prompts consistent across requests

**Error handling with toast notifications:**
- Replaced empty catch blocks with toast.error calls
- Check res.ok before parsing, extract error message from API response
- Fallback to generic message if error parsing fails
- Rationale: Silent failures create bad UX, specific errors help users troubleshoot

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without blockers.

## User Setup Required

None - no external service configuration required. Routes use existing Anthropic API key from Phase 1.

## Next Phase Readiness

- Intention module backend complete, UI already implemented in Phase 3
- Meta module (04-02) can proceed independently - different Claude routing (meta_generation task type)
- extractJSON utility available for reuse in future API routes that return structured data
- Error handling pattern established for UI components making API calls

---
*Phase: 04-modules-intention-meta*
*Completed: 2026-03-19*
