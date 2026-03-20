# SERPmantics

## What This Is

SERPmantics is a SaaS tool for semantic SEO optimization. It analyzes Google's top-10 SERP results for a target keyword, extracts semantic patterns (terms, frequencies, structure), and provides real-time scoring and recommendations to help content creators match or exceed the semantic relevance of top-ranking pages.

The application has a split-screen interface: TipTap WYSIWYG editor on the left, analysis panel with 7 tabs on the right (IAssistant, Plan, Intention, Optimisation, Liens, Meta, Config).

## Core Value

**Real-time semantic scoring (0-120) that compares user content against SERP benchmarks and provides actionable term-by-term recommendations.**

## Requirements

### Validated

<!-- Sprint 1 & 2 shipped features -->

- ✓ Guide CRUD operations — v0.1.0
- ✓ TipTap editor with rich formatting (H1-H6, bold, italic, lists, tables, images, videos, links) — v0.1.0
- ✓ Supabase auth and RLS policies — v0.1.0
- ✓ Basic dashboard with guide cards — v0.1.0
- ✓ NLP service (Python FastAPI) with TF-IDF and lemmatization (5 languages) — v0.1.0
- ✓ OpenAPI/Swagger API documentation — v0.2.0
- ✓ Redis caching layer (24h SERP, 5min guides) — v0.2.0
- ✓ Database performance indexes (10x speedup) — v0.2.0
- ✓ Load testing infrastructure with autocannon — v0.2.0

<!-- Sprint 3 shipped features - v0.3.0 -->

- ✓ Multi-LLM streaming infrastructure (Anthropic Claude + OpenAI GPT) — v0.3.0
- ✓ LLM Router with task-based model selection — v0.3.0
- ✓ Context Builder enriching prompts with SERP data — v0.3.0
- ✓ Prompt Executor with streaming and token tracking — v0.3.0
- ✓ AI-generated H2/H3 content outline from SERP analysis — v0.3.0
- ✓ 15 pre-built prompts across 6 categories — v0.3.0
- ✓ Prompt execution on selected text or full document — v0.3.0
- ✓ Context system (audience, tone, sector, brief) — v0.3.0
- ✓ AI-powered search intent classification — v0.3.0
- ✓ Content alignment scoring against identified intent — v0.3.0
- ✓ AI-generated SEO title and meta description — v0.3.0
- ✓ Test coverage 85.5% (236 tests passing) — v0.3.0

### Active

<!-- v0.4.0 scope - to be defined -->

### Out of Scope

- Config tab improvements — deferred to v0.4+
- Module Liens (internal linking) — deferred to v0.4+
- Optimisation automatique Beta (AI rewriting) — deferred to v0.4+
- Custom user prompts — deferred to v0.4+
- Collaboration features (real-time editing, sharing) — deferred to v1.0+
- Export PDF/Word — deferred to v1.0+

## Current State

**Latest shipped:** v0.3.0 Sprint 3 - AI Modules (2026-03-20)

**What's working:**
- Full AI foundation with multi-LLM routing (Claude + GPT)
- 4 specialized AI modules (IAssistant, Plan, Intention, Meta)
- Reusable context system for prompt enrichment
- 236 tests with 85.5% coverage
- Production-ready error handling and optimistic updates

**Next milestone:** v0.4.0 (to be defined)

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
- Currently 4/7 analysis tabs implemented (Optimisation, IAssistant, Plan, Intention, Meta)
- 2 tabs remaining: Liens (internal linking), Config (share/language settings)
- Custom user prompts not yet implemented (deferred to v0.4+)
- Auto-optimization Beta not yet implemented (deferred to v0.4+)

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
| Multi-LLM routing (Claude + GPT) | Redundancy, cost optimization (GPT cheaper for simple tasks), use best model for each task | ✓ Good (v0.3.0, working excellently) |
| Test coverage 85.5% (exceeded 30-40% target) | Establish strong quality foundation, prevent regressions with Vitest thresholds | ✓ Good (v0.3.0, quality floor established) |
| Context FK + JSONB fallback | Backward compatibility while enabling normalized context references | ✓ Good (v0.3.0, flexible architecture) |

---
*Last updated: 2026-03-20 after v0.3.0 milestone completion*
