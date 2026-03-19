# SERPmantics

## What This Is

SERPmantics is a SaaS tool for semantic SEO optimization. It analyzes Google's top-10 SERP results for a target keyword, extracts semantic patterns (terms, frequencies, structure), and provides real-time scoring and recommendations to help content creators match or exceed the semantic relevance of top-ranking pages.

The application has a split-screen interface: TipTap WYSIWYG editor on the left, analysis panel with 7 tabs on the right (IAssistant, Plan, Intention, Optimisation, Liens, Meta, Config).

## Core Value

**Real-time semantic scoring (0-120) that compares user content against SERP benchmarks and provides actionable term-by-term recommendations.**

## Requirements

### Validated

<!-- Sprint 1 & 2 shipped features -->

- ✓ Guide CRUD operations — Sprint 1
- ✓ TipTap editor with rich formatting (H1-H6, bold, italic, lists, tables, images, videos, links) — Sprint 1
- ✓ Supabase auth and RLS policies — Sprint 1
- ✓ Basic dashboard with guide cards — Sprint 1
- ✓ NLP service (Python FastAPI) with TF-IDF and lemmatization (5 languages) — Sprint 1
- ✓ OpenAPI/Swagger API documentation — Sprint 2
- ✓ Redis caching layer (24h SERP, 5min guides) — Sprint 2
- ✓ Database performance indexes (10x speedup) — Sprint 2
- ✓ Load testing infrastructure with autocannon — Sprint 2

### Active

<!-- Sprint 3 scope -->

**Module Plan:**
- [ ] AI-generated H2/H3 content outline based on SERP analysis
- [ ] Uses Anthropic Claude for outline generation

**Module IAssistant:**
- [ ] Multi-LLM routing (Anthropic Claude + OpenAI GPT)
- [ ] 15+ pre-built prompts (construction plan, grammar, tone, semantic optimization, media suggestions)
- [ ] Prompt execution on selected text or full document
- [ ] Context system (audience, tone, sector, brief)

**Module Intention:**
- [ ] AI-powered search intent classification (informational/transactional/navigational/commercial)
- [ ] Content alignment check against identified intent

**Module Meta:**
- [ ] AI-generated SEO title (60 char limit) and meta description (158 char limit)
- [ ] Character counters and copy buttons
- [ ] Save meta fields to guide

**Testing:**
- [ ] Test coverage 30-40% (currently ~5%)
- [ ] Test AI prompt execution
- [ ] Test API routes for new modules
- [ ] Basic UI tests

### Out of Scope

- Config tab improvements — deferred to v0.4+
- Module Liens (internal linking) — deferred to v0.4+
- Optimisation automatique Beta (AI rewriting) — deferred to v0.4+
- Custom user prompts — deferred to v0.4+
- Collaboration features (real-time editing, sharing) — deferred to v1.0+
- Export PDF/Word — deferred to v1.0+

## Current Milestone: v0.3.0 Sprint 3 - Modules IA & Features Avancées

**Goal:** Implement AI-powered content assistance modules (Plan, IAssistant, Intention, Meta) with multi-LLM routing and context system.

**Target features:**
- Module Plan (AI content outline)
- Module IAssistant base (15+ prompts, multi-LLM)
- Module Intention (search intent analysis)
- Module Meta (AI-generated SEO metadata)
- Context system for prompts (audience, tone, sector)
- Test coverage 30-40%

## Context

**Technical environment:**
- Monorepo: `apps/web/` (Next.js 15, React 19) + `services/nlp/` (Python FastAPI)
- UI: shadcn/ui base-nova style using `@base-ui/react` (NOT Radix UI)
- State: Zustand stores (guide-store, editor-store)
- Editor: TipTap with rich extensions
- Styling: Tailwind CSS v4 + class-variance-authority
- Database: Supabase (PostgreSQL + Auth + RLS)
- Cache: Upstash Redis
- LLM: Will use Anthropic SDK + OpenAI SDK for multi-LLM routing

**User research:**
- Target users: SEO consultants, content marketers, web writers
- Main workflow: Create guide → analyze SERP → generate outline → write content → optimize semantics → publish
- Pain points addressed: Manual SERP analysis, semantic gap detection, content structure uncertainty

**Known issues:**
- Currently only 1/7 tabs implemented (Optimisation tab)
- 6 tabs are placeholder/mock
- Test coverage very low (~5%)
- No AI capabilities yet (Sprint 3 will add them)

## Constraints

- **Tech stack**: Next.js 15 + React 19 (established in Sprint 1) — must maintain compatibility
- **LLM providers**: Anthropic Claude (for content generation) + OpenAI GPT (for editing tasks) — multi-provider strategy for reliability
- **Timeline**: Sprint 3 target completion ~1-2 weeks — ambitious scope with 4 modules + testing
- **Dependencies**: Requires Anthropic API key and OpenAI API key in environment
- **Performance**: AI calls must have proper loading states, error handling, and caching where applicable
- **UI consistency**: Must use shadcn/ui base-nova components (NOT Radix UI) — see `tasks/lessons.md` for gotchas

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| shadcn/ui base-nova (Base UI React) vs Radix | Base UI is newer, better performance, more modern API | — Pending (Sprint 1 choice, working well so far) |
| Zustand vs Jotai for state | Zustand simpler, less boilerplate, good for our use case | ✓ Good (Sprint 1, working well) |
| TipTap vs Slate/Lexical | TipTap has excellent ProseMirror foundation, rich ecosystem | ✓ Good (Sprint 1, very stable) |
| ioredis vs Upstash REST | ioredis unified client, better performance, standard Redis protocol | ✓ Good (Sprint 2, simplified caching logic) |
| Multi-LLM routing (Claude + GPT) | Redundancy, cost optimization (GPT cheaper for simple tasks), use best model for each task | — Pending (Sprint 3 will implement) |

---
*Last updated: 2026-03-19 after Sprint 3 milestone initialization*
