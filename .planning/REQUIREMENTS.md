# Requirements: SERPmantics v0.3.0

**Defined:** 2026-03-19
**Core Value:** Real-time semantic scoring (0-120) that compares user content against SERP benchmarks and provides actionable term-by-term recommendations.

## v0.3.0 Requirements

Requirements for Sprint 3 - AI Modules. Each maps to roadmap phases.

### AI Foundation

- [ ] **AI-01**: Install Vercel AI SDK with Anthropic and OpenAI providers
- [ ] **AI-02**: Create LLM Router that routes prompts to Claude vs GPT based on task type
- [ ] **AI-03**: Create Context Builder that enriches prompts with SERP data and user settings
- [ ] **AI-04**: Create Prompt Executor with streaming support and error handling
- [ ] **AI-05**: Create API route `/api/ai/execute` for prompt execution
- [ ] **AI-06**: Create Zustand AI store for managing AI state (loading, results, errors)
- [ ] **AI-07**: Database schema for prompts table
- [ ] **AI-08**: Database schema for ai_requests table (token tracking)
- [ ] **AI-09**: Add prompt_context JSONB column to guides table

### Module Plan (AI Content Outline)

- [x] **PLAN-01**: User can click "Generate outline" button in Plan tab
- [x] **PLAN-02**: AI generates H2/H3 outline based on SERP analysis
- [x] **PLAN-03**: Outline enriched with competitor H2/H3 structure from SERP
- [x] **PLAN-04**: User can preview generated outline before inserting
- [x] **PLAN-05**: User can insert outline into editor with one click
- [x] **PLAN-06**: System warns if outline would cause over-optimization (score > 100)

### Module IAssistant (Prompt Library)

- [ ] **ASST-01**: IAssistant tab displays prompt library with categories
- [ ] **ASST-02**: Library includes 15 public prompts (grammar, tone, semantic, intro, etc.)
- [ ] **ASST-03**: User can select text in editor and execute prompt on selection
- [ ] **ASST-04**: User can execute prompt on full document (no selection)
- [ ] **ASST-05**: AI execution shows loading state with progress indicator
- [ ] **ASST-06**: AI result appears in preview modal with Accept/Reject buttons
- [ ] **ASST-07**: User can accept AI changes (insert into editor)
- [ ] **ASST-08**: User can reject AI changes (discard result)
- [ ] **ASST-09**: Each prompt shows which LLM model is used (Claude/GPT badge)
- [ ] **ASST-10**: Prompts are enriched with SERP context (semantic terms, benchmarks)
- [ ] **ASST-11**: Prompts warn against using terms-to-avoid from SERP analysis

### Module Intention (Search Intent Analysis)

- [ ] **INTENT-01**: User can click "Identify intentions" in Intention tab
- [ ] **INTENT-02**: AI classifies search intent (informational/transactional/navigational/commercial)
- [ ] **INTENT-03**: System displays identified intent with explanation
- [ ] **INTENT-04**: User can click "Analyze my content" to check alignment
- [ ] **INTENT-05**: System shows intent alignment score (0-100%)
- [ ] **INTENT-06**: System provides recommendations to improve alignment

### Module Meta (SEO Metadata Generation)

- [ ] **META-01**: Meta tab has input fields for title and description
- [ ] **META-02**: Title field has character counter (max 60 chars)
- [ ] **META-03**: Description field has character counter (max 158 chars)
- [ ] **META-04**: User can click "Suggest ideas" to generate AI meta variants
- [ ] **META-05**: AI generates 2-3 title options
- [ ] **META-06**: AI generates 2-3 description options
- [ ] **META-07**: User can select and copy generated meta to fields
- [ ] **META-08**: User can save meta title and description to guide
- [ ] **META-09**: Copy buttons for both title and description fields

### Context System

- [ ] **CTX-01**: User can create context (audience, tone, sector, brief)
- [ ] **CTX-02**: User can edit existing contexts
- [ ] **CTX-03**: User can delete contexts
- [ ] **CTX-04**: User can select active context for current guide
- [ ] **CTX-05**: Prompts are enriched with active context variables
- [ ] **CTX-06**: Context variables are injected into prompts ({audience}, {brand_tone}, etc.)

### Testing

- [ ] **TEST-01**: Unit tests for LLM Router
- [ ] **TEST-02**: Unit tests for Context Builder
- [ ] **TEST-03**: Unit tests for Prompt Executor
- [ ] **TEST-04**: Integration tests for `/api/ai/execute` route
- [ ] **TEST-05**: Integration tests for Plan generation
- [ ] **TEST-06**: Integration tests for IAssistant prompt execution
- [ ] **TEST-07**: Integration tests for Intention classification
- [ ] **TEST-08**: Integration tests for Meta generation
- [ ] **TEST-09**: E2E test for full Plan workflow
- [ ] **TEST-10**: E2E test for IAssistant prompt selection → execution → acceptance
- [ ] **TEST-11**: Test coverage reaches 30-40% (up from 5%)

## Future Requirements (v0.4+)

Deferred to later milestones. Tracked but not in current roadmap.

### Custom User Prompts
- **CUP-01**: User can create custom prompts
- **CUP-02**: User can save custom prompts to library
- **CUP-03**: User can share custom prompts with team

### Config Tab
- **CFG-01**: Share settings UI (private/read/edit)
- **CFG-02**: Language selector for multi-language support
- **CFG-03**: Force analysis button

### Module Liens (Internal Linking)
- **LINK-01**: Internal linking suggestions
- **LINK-02**: Link opportunity detection
- **LINK-03**: Group-based link recommendations

### Auto-Optimization
- **AUTO-01**: Automatic AI rewriting to hit semantic targets
- **AUTO-02**: Batch optimization for multiple terms

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auto-apply AI suggestions | Users must review and accept AI output — prevents quality issues and unwanted changes |
| Unlimited AI requests | Prevents cost spirals and abuse — will implement user quotas in production |
| Custom prompt templates in Sprint 3 | Defer to v0.4+ to focus on core 15 prompts first |
| Real-time collaboration | Complex feature, not core to AI value — defer to v1.0+ |
| Export PDF/Word | Not AI-specific, defer to v1.0+ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AI-01 | Phase 1 | Complete |
| AI-02 | Phase 1 | Complete |
| AI-03 | Phase 1 | Complete |
| AI-04 | Phase 1 | Complete |
| AI-05 | Phase 1 | Complete |
| AI-06 | Phase 1 | Complete |
| AI-07 | Phase 1 | Complete |
| AI-08 | Phase 1 | Complete |
| AI-09 | Phase 1 | Complete |
| PLAN-01 | Phase 3 | Complete |
| PLAN-02 | Phase 3 | Complete |
| PLAN-03 | Phase 3 | Complete |
| PLAN-04 | Phase 3 | Complete |
| PLAN-05 | Phase 3 | Complete |
| PLAN-06 | Phase 3 | Complete |
| ASST-01 | Phase 2 | Pending |
| ASST-02 | Phase 2 | Pending |
| ASST-03 | Phase 2 | Pending |
| ASST-04 | Phase 2 | Pending |
| ASST-05 | Phase 2 | Pending |
| ASST-06 | Phase 2 | Pending |
| ASST-07 | Phase 2 | Pending |
| ASST-08 | Phase 2 | Pending |
| ASST-09 | Phase 2 | Pending |
| ASST-10 | Phase 2 | Pending |
| ASST-11 | Phase 2 | Pending |
| INTENT-01 | Phase 4 | Complete |
| INTENT-02 | Phase 4 | Complete |
| INTENT-03 | Phase 4 | Complete |
| INTENT-04 | Phase 4 | Complete |
| INTENT-05 | Phase 4 | Complete |
| INTENT-06 | Phase 4 | Complete |
| META-01 | Phase 4 | Complete |
| META-02 | Phase 4 | Complete |
| META-03 | Phase 4 | Complete |
| META-04 | Phase 4 | Complete |
| META-05 | Phase 4 | Complete |
| META-06 | Phase 4 | Complete |
| META-07 | Phase 4 | Complete |
| META-08 | Phase 4 | Complete |
| META-09 | Phase 4 | Complete |
| CTX-01 | Phase 5 | Complete |
| CTX-02 | Phase 5 | Complete |
| CTX-03 | Phase 5 | Complete |
| CTX-04 | Phase 5 | Complete |
| CTX-05 | Phase 5 | Complete |
| CTX-06 | Phase 5 | Complete |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |
| TEST-04 | Phase 6 | Pending |
| TEST-05 | Phase 6 | Pending |
| TEST-06 | Phase 6 | Pending |
| TEST-07 | Phase 6 | Pending |
| TEST-08 | Phase 6 | Pending |
| TEST-09 | Phase 6 | Pending |
| TEST-10 | Phase 6 | Pending |
| TEST-11 | Phase 6 | Pending |

**Coverage:**
- v0.3.0 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after Phase 4 completion*
