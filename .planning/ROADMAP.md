# Roadmap: SERPmantics v0.3.0

## Overview

Sprint 3 delivers AI-powered content assistance by building a multi-LLM foundation (Anthropic Claude + OpenAI GPT), then layering four specialized modules: IAssistant (prompt library with 15 public prompts), Plan (AI-generated content outlines), Intention (search intent classification), and Meta (SEO metadata generation). A context system enriches prompts with audience/tone/sector, and comprehensive testing brings coverage from 5% to 30-40%.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: AI Foundation** - Multi-LLM streaming infrastructure and database schema
- [x] **Phase 2: Module IAssistant** - Prompt library with 15 public prompts and execution engine
- [x] **Phase 3: Module Plan** - AI-generated content outlines from SERP analysis
- [x] **Phase 4: Modules Intention & Meta** - Search intent classification and SEO metadata generation
- [x] **Phase 5: Context System** - Prompt enrichment with audience, tone, sector, brief
- [ ] **Phase 6: Testing & Quality** - Comprehensive test coverage for AI modules
- [ ] **Phase 7: Polish & Refinements** - Close integration gaps and architecture improvements

## Phase Details

### Phase 1: AI Foundation
**Goal**: Establish multi-LLM streaming infrastructure that routes prompts to optimal provider and executes with real-time feedback
**Depends on**: Nothing (first phase)
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AI-09
**Success Criteria** (what must be TRUE):
  1. Developer can execute AI prompt via `/api/ai/execute` endpoint and receive streamed response
  2. System routes prompts to Claude for structured tasks and GPT for speed/cost tasks based on prompt type
  3. AI state (loading, results, errors) persists in Zustand store across component renders
  4. Database stores prompt templates with LLM provider assignments
  5. Database tracks AI request tokens and costs per guide
**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01: Install AI SDK + Provider Registry + LLM Router + Context Builder (Wave 1)
- [x] 01-02: Create Prompt Executor + /api/ai/execute streaming Route Handler (Wave 2)
- [x] 01-03: AI types, Zod schemas, Zustand store + database migrations (Wave 1)

**Completed**: 2026-03-19

### Phase 2: Module IAssistant
**Goal**: Users can select from 15 pre-built prompts, execute them on selected text or full document, and accept/reject AI suggestions
**Depends on**: Phase 1
**Requirements**: ASST-01, ASST-02, ASST-03, ASST-04, ASST-05, ASST-06, ASST-07, ASST-08, ASST-09, ASST-10, ASST-11
**Success Criteria** (what must be TRUE):
  1. User sees IAssistant tab with 15 categorized prompts showing LLM provider badges
  2. User can select text in editor and execute prompt only on that selection
  3. User can execute prompt on full document when no text is selected
  4. AI execution shows loading state with progress indicator during streaming
  5. User receives AI result in preview modal with Accept (insert to editor) and Reject (discard) buttons
  6. Prompts automatically include SERP semantic terms and warn against using terms-to-avoid
**Plans**: 2 plans in 2 waves

Plans:
- [x] 02-01: Editor Store integration + Prompts API + 15 seeded prompts (Wave 1)
- [x] 02-02: AssistantPanel rewrite with streaming, selection detection, result modal (Wave 2)

**Completed**: 2026-03-19

### Phase 3: Module Plan
**Goal**: Users can generate AI-powered H2/H3 content outlines based on SERP competitor structure with one-click insertion into editor
**Depends on**: Phase 1
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06
**Success Criteria** (what must be TRUE):
  1. User clicks "Generate outline" button in Plan tab and receives structured H2/H3 outline
  2. Generated outline reflects competitor H2/H3 patterns from SERP analysis
  3. Outline enriched with semantic term distribution across sections
  4. User can preview generated outline before inserting into editor
  5. System warns if inserting outline would push semantic score above 100 (over-optimization risk)
**Plans**: 2 plans in 2 waves

Plans:
- [x] 03-01-PLAN.md — Database migration + outline builder + /api/ai/plan route with Claude Sonnet 4.5 (Wave 1)
- [x] 03-02-PLAN.md — PlanPanel rewrite with preview Dialog, editor insertion, over-optimization warning (Wave 2)

**Completed**: 2026-03-20

### Phase 4: Modules Intention & Meta
**Goal**: Users can classify search intent for their keyword and generate optimized SEO title/description with character limits
**Depends on**: Phase 1
**Requirements**: INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06, META-01, META-02, META-03, META-04, META-05, META-06, META-07, META-08, META-09
**Success Criteria** (what must be TRUE):
  1. User clicks "Identify intentions" and receives search intent classification (informational/transactional/navigational/commercial) with explanation
  2. User clicks "Analyze my content" and sees intent alignment score (0-100%) with improvement recommendations
  3. User enters meta title (60 char counter) and description (158 char counter) manually
  4. User clicks "Suggest ideas" and receives 2-3 AI-generated title and description options
  5. User can select generated option, copy to field, and save to guide
**Plans**: 2 plans in 1 wave

Plans:
- [x] 04-01-PLAN.md — Intention backend API routes (classification + alignment) with JSON extractor utility (Wave 1)
- [x] 04-02-PLAN.md — Meta backend API route (AI generation) + MetaPanel field name fix + error handling (Wave 1)

**Completed**: 2026-03-19

### Phase 5: Context System
**Goal**: Users can create reusable prompt contexts (audience, tone, sector, brief) that automatically enrich all AI prompts
**Depends on**: Phase 2 (contexts used by IAssistant and all modules)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, CTX-06
**Success Criteria** (what must be TRUE):
  1. User can create new context with fields: audience, tone, sector, brief
  2. User can edit existing contexts and delete unused contexts
  3. User can select active context for current guide from dropdown
  4. Prompts automatically inject context variables ({audience}, {brand_tone}, {sector}, {brief})
  5. IAssistant tab shows current active context name or "No context" warning
**Plans**: 2 plans in 2 waves

Plans:
- [x] 05-01: Database migration + CRUD API routes + Zustand context-store + types/schemas (Wave 1)
- [x] 05-02: Context selector + management dialog + AssistantPanel integration + execute route FK resolution (Wave 2)

**Completed**: 2026-03-19

### Phase 6: Testing & Quality
**Goal**: Test coverage reaches 30-40% with unit and integration tests for all AI modules
**Depends on**: Phases 1-5 (tests all AI functionality)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, TEST-10, TEST-11
**Success Criteria** (what must be TRUE):
  1. Unit tests cover LLM Router, Context Builder, and Prompt Executor core logic
  2. Integration tests verify `/api/ai/execute` endpoint with mocked LLM responses
  3. Integration tests validate Plan, Intention, Meta, and Contexts API routes
  4. Coverage report shows 30-40% line coverage (up from ~5%)
  5. Vitest thresholds calibrated as quality floor
**Plans**: 3 plans in 2 waves

Plans:
- [x] 06-01-PLAN.md -- Unit tests for AI utilities (router, context-builder, executor, json-extractor, outline-builder) + scoring + text-utils (Wave 1)
- [x] 06-02-PLAN.md -- Integration tests for AI API routes (plan, intention, meta) + contexts CRUD with mocked AI SDK (Wave 1)
- [x] 06-03-PLAN.md -- Full suite run, coverage report, vitest threshold calibration (Wave 2)

**Completed**: 2026-03-20

### Phase 7: Polish & Refinements
**Goal**: Close integration gaps and architecture weaknesses identified in milestone audit
**Depends on**: Phase 6 (polish after testing confirms stability)
**Gap Closure**: Closes 1 integration gap from v0.3.0-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. MetaPanel PATCH refreshes guide-store after successful save
  2. Analysis panels wrapped in ErrorBoundary components
  3. ContextSelector shows loading state during fetch
  4. Meta changes use optimistic updates for better UX
**Plans**: 1 plan in 1 wave

Plans:
- [ ] 07-01-PLAN.md -- Fix guide-store sync, add error boundaries, loading states, optimistic updates (Wave 1)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. AI Foundation | 3/3 | ✓ Complete | 2026-03-19 |
| 2. Module IAssistant | 2/2 | ✓ Complete | 2026-03-19 |
| 3. Module Plan | 2/2 | ✓ Complete | 2026-03-20 |
| 4. Modules Intention & Meta | 2/2 | ✓ Complete | 2026-03-19 |
| 5. Context System | 2/2 | ✓ Complete | 2026-03-19 |
| 6. Testing & Quality | 3/3 | ✓ Complete | 2026-03-20 |
| 7. Polish & Refinements | 0/1 | Not started | - |
