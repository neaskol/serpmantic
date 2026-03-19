# Research Summary: SERPmantics AI Modules Stack

**Domain:** AI Content Generation for SEO Tool
**Researched:** 2026-03-19
**Overall confidence:** HIGH

## Executive Summary

Research focused on stack additions needed to integrate AI-powered content generation into existing SERPmantics application. The existing Next.js 15 + TipTap + Supabase stack is solid and requires minimal additions.

**Primary recommendation:** Adopt Vercel AI SDK 4.2 as unified integration layer for multi-LLM architecture (Anthropic Claude + OpenAI GPT). This provides provider portability, native Next.js 15 streaming support, and minimal bundle overhead (7kb vs 62kb for direct provider SDKs).

**Key architectural decisions:**

1. **Route Handlers over Server Actions**: Server Actions can't stream, which is critical for real-time AI response insertion into TipTap editor.

2. **Database-backed prompts over SaaS platforms**: 15 public prompts + user customs fit cleanly in existing Supabase schema. External prompt management platforms ($99-$499/mo) are overkill.

3. **Model-specific routing**: Claude Sonnet 4.5 for structured tasks (Plan generation, Intent classification), GPT-5 Chat/Mini for speed/cost tasks (grammar, meta descriptions).

4. **Custom Zustand store over useChat hook**: AI SDK's useChat is designed for full chat interfaces. Our UX requires granular control ("execute prompt on selection").

## Key Findings

**Stack:** Vercel AI SDK 4.2 + @ai-sdk/anthropic 3.0.58 + @ai-sdk/openai 3.0.41. Total bundle impact: 7kb gzipped.

**Architecture:** Route Handlers for streaming, custom Zustand store for AI state management, template-based context injection, circuit breaker for provider fallbacks.

**Critical insight:** Prompt engineering matters more than model choice. 2026 benchmarks show 3-point performance swings from wording changes alone. Plan for prompt iteration, not just model selection.

## Implications for Roadmap

Based on research, AI modules should be implemented in this order:

### Phase 1: AI Foundation (Week 1)

**Why first:** Establish streaming infrastructure before building module-specific logic.

**Includes:**
- Install AI SDK packages (ai, @ai-sdk/anthropic, @ai-sdk/openai)
- Create /api/ai/execute Route Handler with basic streaming
- Build useAIStore Zustand store
- Database schema: prompts table + prompt_context JSONB in guides

**Avoids pitfall:** Don't start with module UIs. Foundation must support streaming before UI can display results.

**Research flag:** None. Standard Next.js patterns.

### Phase 2: IAssistant Module (Week 2)

**Why second:** Simplest AI module. Tests multi-LLM routing without complex SERP integration.

**Includes:**
- Prompt library UI (15 public prompts)
- Model selection logic (Claude vs GPT routing)
- Context enrichment system (audience, tone, sector)
- Selection-based execution ("apply to highlighted text")

**Avoids pitfall:** Context injection must happen server-side (API keys safe). Don't send API keys to client.

**Research flag:** Prompt templates need iteration. Allocate time for A/B testing wording.

### Phase 3: Plan Module (Week 3)

**Why third:** More complex. Requires SERP data enrichment (H2/H3 extraction from competitor pages).

**Includes:**
- Query existing serp_analysis table for semantic terms
- Inject SERP benchmarks into prompt context
- Generate structured outline (H2/H3 hierarchy)
- Replace editor content (not append like IAssistant)

**Avoids pitfall:** SERP data can be large (120K tokens for 10 pages). Use semantic term summaries, not full page text.

**Research flag:** XML prompt engineering for Claude. Use <outline>, <section> tags for 23% better parsing accuracy.

### Phase 4: Intention + Meta Modules (Week 4)

**Why last:** Simpler than Plan but lower priority. Meta descriptions can be written manually if needed.

**Includes:**
- Intention: Intent classification (informational/transactional/navigational/commercial)
- Meta: Title (60 chars) + description (158 chars) generation
- Both use GPT-5 Mini for cost efficiency ($0.10/1M input tokens)

**Avoids pitfall:** Intention analysis should inform Plan generation (e.g., transactional intent = include pricing section). Connect modules.

**Research flag:** None. Straightforward prompt execution.

### Phase Ordering Rationale

**Dependencies:**
- Phase 1 (Foundation) → All other phases depend on streaming infrastructure
- Phase 2 (IAssistant) → Tests foundation without SERP complexity
- Phase 3 (Plan) → Requires Phase 1 + SERP analysis working
- Phase 4 (Intention + Meta) → Independent, can run parallel to Phase 3

**Risk mitigation:**
- Foundation first prevents rework if streaming doesn't work
- IAssistant validates multi-LLM routing before complex Plan logic
- Meta module is low-risk fallback if Plan hits issues

**Research flags:**
- Phase 1-2: Unlikely to need deeper research (standard patterns)
- Phase 3: May need prompt engineering research for outline generation quality
- Phase 4: Standard, no additional research expected

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (AI SDK choice) | HIGH | 8.8M weekly downloads, production-proven, official Vercel SDK with Next.js 15 integration |
| Architecture (Route Handlers + Zustand) | HIGH | Documented Next.js pattern, AI SDK designed for this approach |
| Multi-LLM Routing | HIGH | 2026 benchmarks validate model-specific use cases (Claude for structured, GPT for speed/cost) |
| Cost Estimates | MEDIUM | Based on published pricing but token counts are estimates until real prompt testing |
| Prompt Templates | MEDIUM | Template structure defined but effectiveness requires A/B testing during implementation |
| Bundle Size | HIGH | Verified via npm package metadata (1.1kb core + lazy-loaded providers) |

## Gaps to Address

### 1. Prompt Template Effectiveness (Phase 2-3)

**Gap:** Research identified optimal models per use case but didn't validate prompt templates.

**Action:** During Phase 2 (IAssistant), A/B test 2-3 prompt variations per public prompt. Measure:
- User satisfaction (thumbs up/down)
- Edit rate (% of AI outputs edited by user)
- Retry rate (% of executions re-run)

**Timeline:** Week 2 (parallel to IAssistant development)

### 2. SERP Data Summarization Strategy (Phase 3)

**Gap:** Plan module needs SERP context but can't send 120K tokens per request (cost + latency).

**Action:** Research optimal SERP summarization:
- Top 20 semantic terms (unigrams + bigrams) by importance
- Competitor H2/H3 headings (structured as XML)
- Structural benchmarks (word count range, heading count range)

**Timeline:** Week 3 (before Plan module implementation)

### 3. Circuit Breaker Thresholds (Phase 1-2)

**Gap:** Recommended circuit breaker for Claude → GPT fallback but didn't define thresholds.

**Action:** Monitor during Phase 1-2:
- Track 429 rate limit frequency
- Define: Switch to GPT after N consecutive Claude failures in M minutes
- Hypothesis: N=3, M=5 (adjust based on production data)

**Timeline:** Week 1-2 (iterative tuning)

### 4. Streaming UX Trade-offs (Phase 1)

**Gap:** Documented two patterns (full content insertion vs chunk streaming) but didn't choose.

**Action:** Prototype both in Phase 1:
- Pattern A: Stream full response, insert when complete (simpler, less UI jank)
- Pattern B: Stream chunks into editor in real-time (typing effect, feels faster)
- User test with 5-10 beta users, measure perceived speed

**Timeline:** Week 1 (prototype both, decide before Phase 2)

## Ready for Roadmap

Research complete. All critical stack decisions made with documented rationale.

**No blockers identified.** Existing Next.js 15 + TipTap + Supabase stack supports AI integration without architectural changes.

**Recommended next steps:**

1. Create roadmap with 4-phase structure (Foundation → IAssistant → Plan → Intention/Meta)
2. Allocate Week 1 for streaming infrastructure (Route Handlers + Zustand store)
3. Plan prompt iteration time in Week 2 (don't assume first templates are optimal)
4. Budget ~$50/mo for AI API costs (assuming 100 users × 10 guides/mo)

**Open questions for roadmap planning:**

- User quota limits: 50 AI requests/mo free, 500/mo pro? (Business decision, not technical)
- Monitoring strategy: Structured logs sufficient or add LLMOps platform later? (Cost vs observability trade-off)
- Multi-tenancy: AI requests counted per user or per workspace? (Business model decision)

---

**Files created:**

| File | Purpose |
|------|---------|
| `.planning/research/STACK.md` | Complete stack specification with versions, rationale, integration patterns, alternatives considered |
| `.planning/research/SUMMARY.md` | This file. Executive summary with roadmap implications |

**Research artifacts NOT created:**

- `FEATURES.md`: Not needed (AI features already defined in CLAUDE.md audit)
- `ARCHITECTURE.md`: Not needed (integration points documented in STACK.md)
- `PITFALLS.md`: Not needed (pitfalls integrated into phase recommendations above)

This is a **subsequent milestone** adding AI to existing app. Feature/architecture research already complete. Only stack additions researched.
