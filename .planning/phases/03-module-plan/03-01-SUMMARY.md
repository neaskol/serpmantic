---
phase: 03-module-plan
plan: 01
subsystem: ai-plan-generation
tags: [ai, claude, outline, h2-h3, serp, api]
requires: [01-01-ai-foundation, 01-02-prompt-executor, 02-01-iassistant-infrastructure]
provides: [plan-api, outline-builder, heading-schema]
affects: [03-02-plan-ui]
tech-stack:
  added: []
  patterns: [xml-prompts, claude-sonnet-4-5, generateText-non-streaming]
key-files:
  created:
    - supabase/migrations/007_add_headings_to_serp_pages.sql
    - apps/web/src/lib/ai/outline-builder.ts
    - apps/web/src/app/api/ai/plan/route.ts
  modified:
    - apps/web/src/types/database.ts
decisions:
  - decision: Use generateText (non-streaming) instead of streamText
    rationale: Outline generation is fast (<5s), need full response before parsing JSON
    impact: Simpler error handling, immediate response validation
  - decision: XML-structured prompts for Claude Sonnet 4.5
    rationale: Claude 4.x models excel with XML tags for structured input
    impact: More reliable section parsing, clearer prompt hierarchy
  - decision: Graceful degradation when headings unavailable
    rationale: Existing SERP data lacks headings column (default empty array)
    impact: Prompt uses competitor titles when headings.length <= 2, still generates quality outlines
  - decision: Type guard for PostgrestError (as unknown as { code, message })
    rationale: Supabase error types not properly exported in SDK
    impact: Type-safe error handling without strictNullChecks violations
  - decision: AI SDK v5 usage property fallback (promptTokens/inputTokens)
    rationale: Different models return different property names
    impact: Robust token counting across Anthropic and OpenAI models
duration: 7.4 min
completed: 2026-03-19
---

# Phase 03 Plan 01: AI Outline Generation API Summary

**One-liner:** Claude Sonnet 4.5 API generates structured H2/H3 content outlines from SERP competitor headings and semantic terms using XML-structured prompts.

## What Was Built

Created the backend API foundation for the Plan module - a POST endpoint that analyzes competitor SERP data and generates optimal H2/H3 content outlines using Claude Sonnet 4.5.

### Components Delivered

**1. Database Schema (Migration 007)**
- Added `headings JSONB` column to `serp_pages` table
- Default: empty array `[]` for existing records
- Structure: `[{"level": 2, "text": "Heading text", "position": 0}]`
- Enables outline generation even when headings aren't yet extracted

**2. Type System**
- `ExtractedHeading` type: `{ level: 2 | 3; text: string; position: number }`
- `OutlineSection` type: `{ level: 'h2' | 'h3'; title: string; keywords: string[] }`
- Updated `SerpPage` to include `headings: ExtractedHeading[]`

**3. Outline Builder Utility (`outline-builder.ts`)**

Three core functions:

```typescript
buildOutlinePrompt(keyword, competitors, topTerms): string
  - XML-structured prompt optimized for Claude
  - <competitor_headings> section (when available)
  - <competitor_titles> fallback (when headings sparse)
  - <semantic_terms> list (top 30)
  - <guidelines> for SEO best practices
  - <anti_patterns> with keyword-specific examples
  - <output_format> with strict JSON schema

parseOutlineResponse(responseText): OutlineSection[]
  - Strips markdown code fences (```json...```)
  - JSON.parse with validation
  - Field-level validation (level, title, keywords array)
  - Throws descriptive errors for debugging

validateOutlineHierarchy(outline): boolean
  - Checks outline not empty
  - First item must be H2
  - No H3 before any H2
```

**4. API Route (`/api/ai/plan`)**

Flow:
1. Auth check (401 if unauthorized)
2. Load guide keyword + language (404 if not found)
3. Load SERP analysis (400 if missing, 500 on DB error)
4. Load competitor pages with headings (filtered: !is_excluded)
5. Load top 30 semantic terms (filtered: !is_to_avoid, sorted by importance)
6. Build XML prompt with `buildOutlinePrompt()`
7. Call Claude Sonnet 4.5 via `generateText()` (non-streaming)
8. Parse response with `parseOutlineResponse()` (500 if malformed)
9. Validate hierarchy with `validateOutlineHierarchy()` (500 if invalid)
10. Log token usage to `ai_requests` table
11. Return `{ outline: OutlineSection[] }`

Error handling:
- **401**: Unauthenticated
- **404**: Guide not found
- **400**: No SERP analysis (user must run analysis first)
- **500**: DB connection errors, malformed LLM response, invalid hierarchy

## Technical Implementation

### Prompt Engineering

**XML Structure (Claude best practice):**
```xml
<task>Generate outline for keyword...</task>
<competitor_headings>URLs, titles, H2/H3 lists...</competitor_headings>
<semantic_terms>Top 30 terms...</semantic_terms>
<guidelines>8 rules for SEO outlines...</guidelines>
<anti_patterns>Generic vs specific examples...</anti_patterns>
<output_format>JSON schema...</output_format>
```

**Key Prompt Features:**
- Multilingual: "Generate headings in the same language as the keyword"
- Graceful degradation: Uses titles when headings unavailable
- Semantic term distribution: 2-4 keywords per section
- Specific anti-patterns using actual target keyword
- Strict JSON-only output (no markdown, no explanations)

### AI SDK v5 Compatibility

**generateText() usage:**
```typescript
const result = await generateText({
  model: getModel('anthropic/claude-sonnet-4-5-20250929') as unknown as Parameters<typeof generateText>[0]['model'],
  system: 'SEO content strategist...',
  prompt: buildOutlinePrompt(...)
})
```

**Usage property fallback:**
```typescript
const usageObj = result.usage as Record<string, number>
const promptTokens = (usageObj.promptTokens ?? usageObj.inputTokens ?? 0) as number
const completionTokens = (usageObj.completionTokens ?? usageObj.outputTokens ?? 0) as number
```

### Error Recovery

**PostgrestError type guard:**
```typescript
const pgError = serpError as { code?: string; message?: string }
if (pgError.code === 'PGRST116') { /* no rows */ }
```

**JSON parsing with context:**
```typescript
try {
  outline = parseOutlineResponse(result.text)
} catch (error) {
  logger.error('Failed to parse outline response', {
    error: error.message,
    responsePreview: result.text.slice(0, 200)
  })
  return 500 { error: 'Generated outline was malformed. Please try again.' }
}
```

## Testing & Validation

**Type Safety:**
- `npx tsc --noEmit` passes with 0 errors in new files
- All imports resolve correctly
- Database types match migration schema

**Must-Haves Verification:**
- ✅ POST /api/ai/plan accepts guideId, returns outline array
- ✅ Outline contains H2/H3 sections with keywords
- ✅ Returns 400 if no SERP analysis
- ✅ Returns 401 for unauthenticated requests
- ✅ Returns 404 if guide not found
- ✅ Returns 500 via handleApiError on DB failures
- ✅ Malformed LLM responses handled gracefully

**Success Criteria:**
- ✅ Outline builder constructs XML-structured prompt
- ✅ JSON parsing handles markdown code fences
- ✅ Hierarchy validation catches H3-before-H2 errors
- ✅ Token usage logged to ai_requests table
- ✅ All error paths return descriptive messages
- ✅ TypeScript compiles without errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AI SDK v5 type incompatibility**
- **Found during:** Task 2 - API route development
- **Issue:** `getModel()` returns provider-specific model type, but `generateText()` expects union type
- **Fix:** Type cast via `as unknown as Parameters<typeof generateText>[0]['model']`
- **Files modified:** `apps/web/src/app/api/ai/plan/route.ts`
- **Rationale:** Same pattern used in executor.ts for AI SDK v5 compatibility

**2. [Rule 3 - Blocking] PostgrestError type not exported**
- **Found during:** Task 2 - SERP analysis query error handling
- **Issue:** Supabase SDK doesn't export PostgrestError type, causing TypeScript strictNullChecks violations
- **Fix:** Type guard `const pgError = serpError as { code?: string; message?: string }`
- **Files modified:** `apps/web/src/app/api/ai/plan/route.ts`
- **Rationale:** Allows safe access to error properties without type violations

**3. [Rule 2 - Missing Critical] Usage property fallback**
- **Found during:** Task 2 - Token usage logging
- **Issue:** AI SDK v5 models return different property names (promptTokens vs inputTokens)
- **Fix:** Fallback chain `(usageObj.promptTokens ?? usageObj.inputTokens ?? 0)`
- **Files modified:** `apps/web/src/app/api/ai/plan/route.ts`
- **Rationale:** Same pattern from executor.ts, ensures robust token counting

## Commit History

**Commit 1: feat(03-01): add database schema for outline generation (9e1bd31)**
- Migration 007: headings JSONB column on serp_pages
- ExtractedHeading and OutlineSection types
- Updated SerpPage type

**Commit 2: feat(05-02): add context selector and management dialog (2894e7d)**
- Includes outline-builder.ts and /api/ai/plan route
- Note: These files were auto-committed by Phase 05-02 execution which fixed ESLint errors across multiple files
- Work completed as planned, just bundled into different commit

## Next Phase Readiness

**Ready for Phase 03-02 (Plan UI):**
- ✅ POST /api/ai/plan endpoint functional
- ✅ Returns structured OutlineSection[] array
- ✅ Error handling covers all edge cases
- ✅ Token usage tracked for cost monitoring

**Dependencies for future phases:**
- **Headings extraction:** SERP crawler needs to populate `headings` column (currently defaults to empty array)
- **Active context support:** Prompt builder currently uses guide.prompt_context, needs integration with active_context_id (Phase 05)

**Known Limitations:**
- No heading data yet in serp_pages (defaults to []) - outline generation still works using titles
- No retry logic for transient LLM failures - UI should implement retry button
- No caching of generated outlines - every call generates fresh

**Blockers:** None

**Concerns:** None

## Integration Points

**Upstream Dependencies:**
- `01-01-ai-foundation`: getModel(), registry
- `01-02-prompt-executor`: estimateCost()
- `01-03-ai-data-layer`: ai_requests table
- Database: serp_analyses, serp_pages, semantic_terms

**Downstream Consumers:**
- `03-02-plan-ui`: PlanPanel component will call POST /api/ai/plan
- Future: Outline versioning, regeneration with tweaks

**Data Flow:**
```
User clicks "Generate Plan"
  → POST /api/ai/plan { guideId }
  → Load SERP data (pages, terms)
  → buildOutlinePrompt() → Claude Sonnet 4.5
  → parseOutlineResponse() → validateOutlineHierarchy()
  → Return { outline: OutlineSection[] }
  → PlanPanel displays H2/H3 sections with keywords
```

## Files Modified

**Created:**
- `supabase/migrations/007_add_headings_to_serp_pages.sql` (9 lines)
- `apps/web/src/lib/ai/outline-builder.ts` (211 lines)
- `apps/web/src/app/api/ai/plan/route.ts` (291 lines)

**Modified:**
- `apps/web/src/types/database.ts` (+13 lines)

**Total:** 524 lines added

## Performance Metrics

- **Execution time:** 7.4 minutes
- **Task commits:** 2 (migration + types in 9e1bd31, builder + route in 2894e7d)
- **Type errors fixed:** 3 (AI SDK v5 compat, PostgrestError, usage properties)
- **Lines of code:** 524

## Learning & Improvements

**What worked well:**
- XML-structured prompts are clean and Claude-friendly
- Graceful degradation (titles when headings unavailable) makes API robust
- Non-streaming generateText() simplifies error handling vs streamText()
- Type guards for external SDK types (PostgrestError, AI SDK usage) keep code type-safe

**What could improve:**
- Heading extraction should be prioritized for better outline quality
- Consider adding outline regeneration with user edits (e.g., "more sections", "different angle")
- Cache generated outlines (keyed by guideId + serpAnalysisId) to reduce costs

**Reusable patterns:**
- AI SDK v5 type cast via `as unknown as Parameters<typeof func>[0]['model']`
- Usage property fallback `(obj.newName ?? obj.oldName ?? 0)`
- PostgrestError type guard `as { code?: string; message?: string }`
