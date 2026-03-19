# Project State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-19 — Milestone v0.3.0 started

## Accumulated Context

### Previous Milestones

**Sprint 1 (Infrastructure)** — Completed
- Next.js 15 + React 19 + TipTap editor
- Supabase (PostgreSQL + Auth + RLS)
- Guide CRUD operations
- Basic dashboard
- Python FastAPI NLP service

**Sprint 2 (Performance & Docs)** — Completed
- OpenAPI/Swagger documentation
- Redis caching layer (24h SERP cache, 5min guide cache)
- Database indexes (10x query speedup)
- Load testing infrastructure (autocannon)

### Key Learnings

**Base UI (base-nova) API Gotchas:**
- Triggers use `render={<Component />}` instead of `asChild`
- `Select.onValueChange` passes `string | null` — needs null guard
- Always read `src/components/ui/*.tsx` source before using a component
- See `tasks/lessons.md` for full list

**Architecture Patterns:**
- Use Zustand stores for client state (guide-store, editor-store)
- TipTap editor updates trigger real-time analysis (debounced)
- API routes use Zod validation
- React error boundaries for graceful degradation

### Technical Decisions

1. **Multi-LLM routing planned** — Anthropic for content generation, OpenAI for editing
2. **Context system needed** — Prompts will be enriched with user context (audience, tone, sector)
3. **15+ prompts in IAssistant** — Ambitious but high user value
4. **Test coverage target 30-40%** — Balance speed and quality

### Blockers

None currently. Sprint 3 is greenfield AI module implementation.

### Pending TODOs

(None from previous sprints — clean slate for Sprint 3)

---
*Updated: 2026-03-19*
