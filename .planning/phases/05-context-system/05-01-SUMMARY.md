---
phase: 05-context-system
plan: 01
subsystem: database, api
tags: [supabase, postgres, rls, zustand, rest-api, context-management]

# Dependency graph
requires:
  - phase: 01-ai-foundation
    provides: prompt_context JSONB on guides, AI execution infrastructure
  - phase: 02-module-iassistant
    provides: prompt templates with context variables
provides:
  - prompt_contexts table with user_id FK and RLS policies
  - active_context_id FK on guides table (ON DELETE SET NULL)
  - CRUD API routes for context management (GET, POST, PATCH, DELETE)
  - Zustand context-store with async actions
  - CreateContextSchema and UpdateContextSchema Zod validation
  - PromptContextRecord TypeScript type
affects: [05-02-context-ui, future-modules-using-prompts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Context persistence via guides.active_context_id FK"
    - "Server-side user_id injection in POST /api/contexts"
    - "RLS policies for user-owned contexts"
    - "Zustand store with separate setActiveContext and initActiveContext"

key-files:
  created:
    - supabase/migrations/007_create_prompt_contexts.sql
    - apps/web/src/app/api/contexts/route.ts
    - apps/web/src/app/api/contexts/[id]/route.ts
    - apps/web/src/stores/context-store.ts
  modified:
    - apps/web/src/types/database.ts
    - apps/web/src/lib/schemas.ts

key-decisions:
  - "active_context_id stored on guides, not separate junction table - simpler for 1:1 relationship"
  - "setActiveContext persists via PATCH /api/guides/[id] - reuses existing endpoint, no new route needed"
  - "initActiveContext separate from setActiveContext - non-async initialization when guide loads"
  - "deleteContext auto-clears activeContextId if deleted context was active - prevents stale references"
  - "Empty string defaults for audience/tone/sector/brief - allows optional fields while keeping NOT NULL columns"

patterns-established:
  - "Pattern: Context management via dedicated table + FK reference"
  - "Pattern: RLS policies with auth.uid() for user-owned resources"
  - "Pattern: Zustand async actions return values (createContext returns PromptContextRecord | null)"

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 05 Plan 01: Context System Data Layer Summary

**Prompt context CRUD with dedicated table, RLS policies, and active context FK on guides**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T16:58:28Z
- **Completed:** 2026-03-19T17:02:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Database schema for user-owned prompt contexts with full CRUD
- API routes following project patterns (auth check, Zod validation, error handling)
- Zustand store with context persistence to guide records
- Extended UpdateGuideSchema to accept active_context_id

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration + type definitions + Zod schemas** - `5db9dbd` (feat)
2. **Task 2: CRUD API routes + Zustand context-store** - `64f9fcb` (feat)

## Files Created/Modified
- `supabase/migrations/007_create_prompt_contexts.sql` - prompt_contexts table with RLS, active_context_id FK on guides
- `apps/web/src/types/database.ts` - Added PromptContextRecord type and active_context_id to Guide
- `apps/web/src/lib/schemas.ts` - Added CreateContextSchema, UpdateContextSchema, extended UpdateGuideSchema
- `apps/web/src/app/api/contexts/route.ts` - GET (list contexts) and POST (create context)
- `apps/web/src/app/api/contexts/[id]/route.ts` - PATCH (update context) and DELETE (delete context)
- `apps/web/src/stores/context-store.ts` - Zustand store with CRUD actions and active context management

## Decisions Made

**Active context storage approach:**
- Store active_context_id directly on guides table (not separate junction table)
- Rationale: 1:1 relationship, simpler schema, fewer joins

**Active context persistence:**
- setActiveContext persists via existing PATCH /api/guides/[id] endpoint
- Rationale: Reuse existing route, UpdateGuideSchema already supports arbitrary fields

**Async vs sync initialization:**
- setActiveContext is async (makes API call to persist)
- initActiveContext is sync (just sets store state when guide loads)
- Rationale: Prevent double API calls when loading guide that already has active_context_id

**Delete behavior:**
- deleteContext auto-clears activeContextId if deleted context was active
- Rationale: Prevent stale references in UI

**Schema defaults:**
- audience/tone/sector/brief default to empty strings (not NULL)
- Rationale: Allows optional fields in CreateContextSchema while keeping columns NOT NULL

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward implementation following established patterns from prompts table (migration 003) and ai-store.ts.

## User Setup Required

None - no external service configuration required.

Database migration 007 needs to be applied via `supabase db push` (already documented in STATE.md blockers).

## Next Phase Readiness

- Data layer complete and ready for UI integration (Plan 05-02)
- Context store provides all CRUD actions needed by Context Builder UI
- active_context_id FK ready for Assistant Panel context selector dropdown
- API routes follow authentication patterns, RLS enforced at database level

---
*Phase: 05-context-system*
*Completed: 2026-03-19*
