# Phase 1: AI Foundation - Research

**Researched:** 2026-03-19
**Domain:** Multi-LLM streaming infrastructure (Vercel AI SDK + Anthropic + OpenAI)
**Confidence:** HIGH

## Summary

Phase 1 establishes the AI infrastructure layer for SERPmantics: multi-LLM streaming with Anthropic Claude and OpenAI GPT, routed by task type, with real-time feedback to the user. The Vercel AI SDK (v5) is the standard solution for this exact problem -- it provides a unified API across providers, built-in streaming primitives, and first-class Next.js integration.

The codebase already has Next.js 15.3.1, Zustand 5.0.12, Supabase, and Zod 4.3.6 established. No AI-related packages are installed yet. The existing patterns (API routes with Zod validation, Supabase server client, structured error handling, Zustand stores) are well-established and the AI foundation must follow these conventions.

**Primary recommendation:** Install `ai@^5.0.0`, `@ai-sdk/anthropic@latest`, and `@ai-sdk/openai@latest`. Use `createProviderRegistry` for multi-LLM routing, `streamText` with `toTextStreamResponse()` for the `/api/ai/execute` endpoint, and a dedicated `ai-store.ts` Zustand store for streaming state management.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^5.0.0 | Vercel AI SDK core - streamText, generateText, provider registry | De facto standard for AI in Next.js; unified API across 20+ providers, built-in streaming, token tracking via onFinish callback |
| `@ai-sdk/anthropic` | ^2.0.0 (AI SDK 5 compatible) | Anthropic Claude provider | Official provider, supports claude-sonnet-4, claude-sonnet-4-5, thinking/reasoning tokens |
| `@ai-sdk/openai` | ^2.0.0 (AI SDK 5 compatible) | OpenAI GPT provider | Official provider, supports gpt-4o, gpt-4o-mini, predicted outputs, reasoning models |
| `@ai-sdk/react` | ^2.0.0 | React hooks (useChat, useCompletion) | Client-side streaming hooks; may not be needed in Phase 1 but useful for Phase 2 |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | ^5.0.12 | State management | AI store for loading/streaming/result/error state |
| `zod` | ^4.3.6 | Schema validation | Request/response validation for AI endpoint |
| `@supabase/supabase-js` | ^2.99.2 | Database client | Storing prompts, ai_requests, guide prompt_context |
| `nanoid` | ^5.1.7 | ID generation | Request IDs for AI requests tracking |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel AI SDK | Direct Anthropic + OpenAI SDKs | More control, but must hand-roll streaming, token tracking, provider switching. AI SDK abstracts all of this. |
| `createProviderRegistry` | Manual if/else routing | Registry provides type-safe model references like `registry.languageModel('anthropic/claude-sonnet-4-20250514')`. Manual routing is more brittle. |
| `streamText` + `toTextStreamResponse()` | `useChat` hook pattern | Our use case is single-prompt execution (not multi-turn chat). `streamText` with custom SSE is more appropriate than the chat pattern. |
| AI SDK v5 | AI SDK v6 (beta) | v6 introduces Agent abstraction, but is newer and less battle-tested. v5 is stable and sufficient for our needs. |

**Installation:**
```bash
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/react
```

**Environment variables required:**
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Note: The AI SDK automatically reads `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from environment variables -- no explicit configuration needed for default setup.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── lib/
│   └── ai/
│       ├── registry.ts        # Provider registry (createProviderRegistry)
│       ├── router.ts          # LLM Router - maps task types to models
│       ├── context-builder.ts # Enriches prompts with SERP data + user settings
│       └── executor.ts        # Prompt Executor - streamText wrapper
├── stores/
│   └── ai-store.ts            # Zustand store for AI state
├── app/
│   └── api/
│       └── ai/
│           └── execute/
│               └── route.ts   # POST /api/ai/execute endpoint
├── lib/
│   └── schemas.ts             # Add AI-related Zod schemas here
└── types/
    └── database.ts            # Add Prompt, AiRequest types here
```

### Pattern 1: Provider Registry for Multi-LLM Routing

**What:** Centralize all LLM provider configuration in a single registry. Use string model IDs like `'anthropic/claude-sonnet-4-20250514'` throughout the codebase.
**When to use:** Always -- this is the entry point for all LLM calls.

```typescript
// Source: Context7 /websites/ai-sdk_dev - Provider Management
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { createProviderRegistry } from 'ai'

export const registry = createProviderRegistry({
  anthropic,
  openai,
})

// Usage anywhere:
const model = registry.languageModel('anthropic/claude-sonnet-4-20250514')
```

### Pattern 2: LLM Router (Task Type to Model Mapping)

**What:** Map prompt task types to optimal LLM models. Claude for structured/creative tasks, GPT for speed/editing tasks.
**When to use:** Before every AI execution, to determine which model to use.

```typescript
// Source: project CLAUDE.md Section 4.1 + 4.2
type TaskType =
  | 'plan_generation'        // Claude Sonnet 4.5
  | 'introduction'           // Claude Sonnet 4
  | 'intent_analysis'        // Claude Sonnet 4
  | 'content_editing'        // GPT-4o Mini
  | 'grammar_check'          // GPT-4o
  | 'semantic_optimization'  // GPT-4o Mini
  | 'meta_generation'        // GPT-4o Mini
  | 'media_suggestions'      // GPT-4o

const MODEL_MAP: Record<TaskType, string> = {
  plan_generation: 'anthropic/claude-sonnet-4-5-20250929',
  introduction: 'anthropic/claude-sonnet-4-20250514',
  intent_analysis: 'anthropic/claude-sonnet-4-20250514',
  content_editing: 'openai/gpt-4o-mini',
  grammar_check: 'openai/gpt-4o',
  semantic_optimization: 'openai/gpt-4o-mini',
  meta_generation: 'openai/gpt-4o-mini',
  media_suggestions: 'openai/gpt-4o',
}

export function getModelForTask(taskType: TaskType): string {
  return MODEL_MAP[taskType]
}
```

### Pattern 3: Streaming API Route with Token Tracking

**What:** Use `streamText` in a Next.js Route Handler with `onFinish` callback for token usage recording.
**When to use:** The `/api/ai/execute` endpoint.

```typescript
// Source: Context7 /vercel/ai - streamText + onFinish
import { streamText } from 'ai'
import { registry } from '@/lib/ai/registry'

export const maxDuration = 30 // Allow streaming up to 30 seconds

export async function POST(request: Request) {
  const { prompt, systemPrompt, modelId, guideId } = await request.json()

  const result = streamText({
    model: registry.languageModel(modelId),
    system: systemPrompt,
    prompt,
    onFinish({ text, usage, finishReason }) {
      // Record token usage to ai_requests table
      // usage.promptTokens, usage.completionTokens, usage.totalTokens
    },
    onError({ error }) {
      console.error('Stream error:', error)
    },
  })

  return result.toTextStreamResponse()
}
```

### Pattern 4: Context Builder (Prompt Enrichment)

**What:** Enrich raw prompt templates with SERP data, guide context, and user settings before execution.
**When to use:** Before every AI call, after the LLM router selects the model.

```typescript
// Source: project CLAUDE.md Section 10.4
interface PromptContext {
  keyword: string
  language: string
  semanticTerms: { term: string; minOccurrences: number; maxOccurrences: number }[]
  termsToAvoid: string[]
  structuralBenchmarks: Record<string, { min: number; max: number }>
  currentContent?: string
  selectedText?: string
  userContext?: {
    audience?: string
    tone?: string
    sector?: string
    brief?: string
  }
}

export function buildPrompt(
  template: string,
  context: PromptContext
): string {
  return template
    .replace('{keyword}', context.keyword)
    .replace('{language}', context.language)
    .replace('{semantic_terms}', JSON.stringify(context.semanticTerms))
    .replace('{terms_to_avoid}', context.termsToAvoid.join(', '))
    .replace('{content}', context.currentContent || '')
    .replace('{selected_text}', context.selectedText || '')
    // ... etc
}
```

### Pattern 5: Zustand AI Store with Streaming State

**What:** Dedicated Zustand store for managing AI execution lifecycle: idle -> loading -> streaming -> success/error.
**When to use:** All components that interact with AI features.

```typescript
// Source: Context7 /pmndrs/zustand - Async Actions pattern
import { create } from 'zustand'

type AiStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error'

interface AiState {
  status: AiStatus
  streamedText: string
  error: string | null
  lastPromptId: string | null
  lastResult: string | null

  executePrompt: (promptId: string, content: string) => Promise<void>
  appendStreamedText: (chunk: string) => void
  acceptResult: () => void
  rejectResult: () => void
  reset: () => void
}

export const useAiStore = create<AiState>()((set, get) => ({
  status: 'idle',
  streamedText: '',
  error: null,
  lastPromptId: null,
  lastResult: null,

  executePrompt: async (promptId, content) => {
    set({ status: 'loading', error: null, streamedText: '' })
    try {
      const response = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, content }),
      })

      if (!response.ok) throw new Error('AI execution failed')
      if (!response.body) throw new Error('No response body')

      set({ status: 'streaming' })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        set((state) => ({ streamedText: state.streamedText + chunk }))
      }

      set((state) => ({
        status: 'success',
        lastResult: state.streamedText,
        lastPromptId: promptId,
      }))
    } catch (error) {
      set({ status: 'error', error: (error as Error).message })
    }
  },

  appendStreamedText: (chunk) =>
    set((state) => ({ streamedText: state.streamedText + chunk })),

  acceptResult: () => {
    // Phase 2 will use this to insert text into TipTap editor
    set({ status: 'idle', streamedText: '', lastResult: null })
  },

  rejectResult: () => {
    set({ status: 'idle', streamedText: '', lastResult: null, lastPromptId: null })
  },

  reset: () => set({
    status: 'idle', streamedText: '', error: null,
    lastPromptId: null, lastResult: null,
  }),
}))
```

### Anti-Patterns to Avoid
- **Do not use `useChat` for single-prompt execution.** `useChat` is designed for multi-turn conversations. Our IAssistant prompts are one-shot executions. Use `streamText` + custom fetch on the client.
- **Do not store AI state in the guide store.** AI state is ephemeral (loading, streaming, result). Keep it in a separate `ai-store.ts` to avoid polluting the guide store.
- **Do not hard-code model IDs in route handlers.** Always go through the LLM Router so model assignments can be changed from the database.
- **Do not skip the `maxDuration` export in route handlers.** Next.js serverless functions have a 10s default timeout. Streaming AI responses need 30-60 seconds. Always add `export const maxDuration = 30`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming SSE from LLM to client | Custom ReadableStream + TextEncoder | `streamText().toTextStreamResponse()` | Handles backpressure, encoding, error propagation, abort signals |
| Provider abstraction layer | Custom wrapper around Anthropic + OpenAI SDKs | `createProviderRegistry` from `ai` | Unified API, automatic model ID parsing, extensible for future providers |
| Token usage tracking | Custom token counting | `onFinish({ usage })` callback in `streamText` | Accurate counts from the provider, includes prompt + completion tokens |
| Request abort on client disconnect | Custom abort controller management | AI SDK handles this internally via Response streaming | The SDK properly cleans up when the client disconnects |
| Model-specific message formatting | Custom message converters | `convertToModelMessages` from `ai` | Handles provider-specific message format differences automatically |

**Key insight:** The Vercel AI SDK exists precisely to solve the multi-LLM streaming problem. Every custom solution would be re-implementing what the SDK already does with proper edge-case handling.

## Common Pitfalls

### Pitfall 1: Missing maxDuration Export
**What goes wrong:** Streaming responses get cut off after 10 seconds on Vercel/serverless.
**Why it happens:** Next.js serverless functions have a 10-second default timeout. LLM responses often take 15-30 seconds.
**How to avoid:** Always add `export const maxDuration = 30` (or 60) at the top of the route handler file.
**Warning signs:** Truncated AI responses, `504 Gateway Timeout` errors in production.

### Pitfall 2: Wrong Response Method for Non-Chat Use Cases
**What goes wrong:** Using `toUIMessageStreamResponse()` when you just need raw text streaming sends data in the AI SDK's internal protocol format, which is unreadable to a simple `fetch()` client.
**Why it happens:** Confusion between chat-based and prompt-based patterns.
**How to avoid:** Use `toTextStreamResponse()` for our single-prompt execution. Only use `toUIMessageStreamResponse()` if consuming with `useChat` hook.
**Warning signs:** Client receives garbled data like `0:"Hello"\n` instead of `Hello`.

### Pitfall 3: Not Handling Streaming Errors
**What goes wrong:** `streamText` suppresses errors by default to prevent server crashes. Errors are silently swallowed.
**Why it happens:** The stream starts immediately and errors can occur mid-stream.
**How to avoid:** Always provide an `onError` callback. Also consider wrapping the whole route handler in try/catch for pre-stream errors (validation, auth).
**Warning signs:** AI calls fail silently, no error logs, client gets empty streams.

### Pitfall 4: Provider API Key Not Found
**What goes wrong:** `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` missing from `.env.local`, causing cryptic runtime errors.
**Why it happens:** Environment variables not set up before first AI call.
**How to avoid:** Validate API key presence at app startup or in a middleware. Add clear error messages. Document required env vars.
**Warning signs:** `401 Unauthorized` from provider, `API key not found` errors.

### Pitfall 5: Zod v4 Compatibility with AI SDK
**What goes wrong:** The project uses Zod v4.3.6 (latest). AI SDK 5 was built for Zod v3 initially, but v5.0.0+ added Zod v4 support.
**Why it happens:** Major Zod version change happened during AI SDK 5 lifecycle.
**How to avoid:** Ensure `ai@^5.0.0` is installed (which supports Zod v4). Check AI SDK migration guide section on Zod compatibility.
**Warning signs:** TypeScript errors related to Zod schema types in AI SDK functions.

### Pitfall 6: Zustand Store Not Resetting Between Executions
**What goes wrong:** Previous AI result bleeds into next execution because `streamedText` wasn't cleared.
**Why it happens:** Forgetting to reset state before starting a new execution.
**How to avoid:** Always reset `streamedText` to `''` at the start of `executePrompt`. Provide explicit `reset()` action.
**Warning signs:** New AI result starts with content from previous result.

### Pitfall 7: Database Migration Order Matters
**What goes wrong:** `ai_requests` table references `prompts` table and `guides` table. If created in wrong order, foreign key constraints fail.
**Why it happens:** Not considering table dependency graph.
**How to avoid:** Create tables in order: 1) `prompts` (no deps), 2) `ALTER guides` (add column), 3) `ai_requests` (references both).
**Warning signs:** Migration fails with `relation "prompts" does not exist`.

## Code Examples

### Example 1: Complete Provider Registry Setup

```typescript
// Source: Context7 /websites/ai-sdk_dev - Provider Management
// File: apps/web/src/lib/ai/registry.ts

import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { createProviderRegistry } from 'ai'

export const registry = createProviderRegistry({
  anthropic,
  openai,
})

// Type-safe model getter
export function getModel(modelId: string) {
  return registry.languageModel(modelId)
}
```

### Example 2: Complete Route Handler with Auth + Validation + Streaming + Token Tracking

```typescript
// Source: Context7 /vercel/ai + existing codebase patterns
// File: apps/web/src/app/api/ai/execute/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { registry } from '@/lib/ai/registry'
import { buildPromptContext } from '@/lib/ai/context-builder'
import { getModelForTask } from '@/lib/ai/router'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

export const maxDuration = 30

const ExecuteRequestSchema = z.object({
  promptId: z.string().uuid(),
  guideId: z.string().uuid(),
  selectedText: z.string().optional(),
  scope: z.enum(['selection', 'document']).default('document'),
})

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Validate
    const body = await request.json()
    const { promptId, guideId, selectedText, scope } = ExecuteRequestSchema.parse(body)

    // 3. Load prompt template from database
    const { data: prompt } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .single()

    if (!prompt) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })

    // 4. Load guide + SERP data for context
    const { data: guide } = await supabase
      .from('guides')
      .select('*, serp_analyses(*)')
      .eq('id', guideId)
      .single()

    // 5. Build enriched prompt
    const enrichedPrompt = buildPromptContext(prompt.prompt_template, {
      keyword: guide.keyword,
      language: guide.language,
      selectedText,
      // ... SERP data
    })

    // 6. Route to correct model
    const modelId = prompt.model_id || getModelForTask(prompt.task_type)

    // 7. Stream
    const result = streamText({
      model: registry.languageModel(modelId),
      system: prompt.system_prompt || undefined,
      prompt: enrichedPrompt,
      onFinish: async ({ text, usage, finishReason }) => {
        // 8. Track usage in database
        await supabase.from('ai_requests').insert({
          user_id: user.id,
          guide_id: guideId,
          prompt_id: promptId,
          model_id: modelId,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          finish_reason: finishReason,
          // Estimate cost (approximate)
          estimated_cost: estimateCost(modelId, usage),
        })
      },
      onError: ({ error }) => {
        logger.error('AI stream error', { requestId, error })
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    return handleApiError(error, { route: '/api/ai/execute', context: { requestId } })
  }
}
```

### Example 3: Database Migration - Prompts Table

```sql
-- File: Supabase migration for prompts table
-- Matches the data model from CLAUDE.md Section 11 (Prompt entity)

CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  llm_provider TEXT NOT NULL CHECK (llm_provider IN ('anthropic', 'openai')),
  model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  system_prompt TEXT,
  scope TEXT NOT NULL DEFAULT 'document' CHECK (scope IN ('selection', 'document', 'full')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Public prompts visible to all authenticated users
CREATE POLICY "Public prompts visible to authenticated users"
  ON prompts FOR SELECT
  TO authenticated
  USING (is_public = true OR owner_id = (SELECT auth.uid()));

-- Only owners can modify their prompts
CREATE POLICY "Owners can modify their prompts"
  ON prompts FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- Index for common queries
CREATE INDEX idx_prompts_public ON prompts (is_public) WHERE is_public = true;
CREATE INDEX idx_prompts_owner ON prompts (owner_id);
CREATE INDEX idx_prompts_category ON prompts (category);
```

### Example 4: Database Migration - AI Requests Table

```sql
-- Token tracking and cost monitoring table

CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  model_id TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10,6) NOT NULL DEFAULT 0,
  finish_reason TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own requests
CREATE POLICY "Users view own requests"
  ON ai_requests FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Insert policy for server (requests are created server-side via service role)
-- The API route uses the server client which has the user's JWT
CREATE POLICY "Users can insert own requests"
  ON ai_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Performance indexes
CREATE INDEX idx_ai_requests_user ON ai_requests (user_id);
CREATE INDEX idx_ai_requests_guide ON ai_requests (guide_id);
CREATE INDEX idx_ai_requests_created ON ai_requests (created_at DESC);
```

### Example 5: ALTER guides Table

```sql
-- Add prompt_context JSONB column to guides table (AI-09)

ALTER TABLE guides
ADD COLUMN prompt_context JSONB DEFAULT '{}';

-- JSONB structure example:
-- {
--   "audience": "SEO consultants",
--   "tone": "professional",
--   "sector": "digital marketing",
--   "brief": "Focus on technical SEO best practices"
-- }

COMMENT ON COLUMN guides.prompt_context IS 'User-defined context for AI prompt enrichment (audience, tone, sector, brief)';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct Anthropic/OpenAI SDK calls | Vercel AI SDK with unified provider API | AI SDK v4+ (2024) | One API for all providers, no more provider-specific streaming code |
| `convertToCoreMessages()` | `convertToModelMessages()` | AI SDK v5 (2025) | Renamed function -- must use new name |
| `toAIStreamResponse()` | `toTextStreamResponse()` / `toUIMessageStreamResponse()` | AI SDK v5 (2025) | Clearer naming, separate methods for different use cases |
| Zod v3 schemas | Zod v4 schemas | AI SDK v5.0.0+ (2025) | AI SDK now supports Zod v4 natively |
| `useChat` with `initialMessages` | `useChat` with `messages` + `sendMessage` | AI SDK v5 (2025) | New chat API with parts-based messages |
| `@ai-sdk/openai` model IDs like `gpt-4-turbo` | Model IDs like `gpt-4o`, `gpt-4o-mini`, `gpt-5` | OpenAI model releases 2024-2025 | Use current model names |

**Deprecated/outdated:**
- `OpenAI` class facade: Removed in AI SDK 4.0. Use `openai` object or `createOpenAI()` function.
- `Anthropic` class facade: Removed in AI SDK 4.0. Use `anthropic` object or `createAnthropic()` function.
- `baseUrl` option: Renamed to `baseURL` across all providers in AI SDK 4.0.
- `toAIStreamResponse()`: Removed, use `toTextStreamResponse()` or `toUIMessageStreamResponse()`.

## Open Questions

1. **Exact model IDs for Claude Sonnet 4.5 and GPT-5**
   - What we know: Context7 shows `claude-sonnet-4-5-20250929` and `claude-sonnet-4-20250514` for Anthropic, `gpt-4o` and `gpt-4o-mini` for OpenAI. The CLAUDE.md references "GPT-5 Chat" and "GPT-5 Mini" which suggests newer models may be available.
   - What's unclear: Exact production model IDs for GPT-5 variants. The roadmap mentions GPT-5 but the AI SDK currently lists `gpt-5` as a valid model ID.
   - Recommendation: Start with `gpt-4o` and `gpt-4o-mini` as they are well-tested. Store model IDs in the `prompts` database table so they can be updated without code changes. Switch to GPT-5 when confirmed available.

2. **Cost estimation accuracy**
   - What we know: The `onFinish` callback provides exact `promptTokens` and `completionTokens`. Pricing differs by model.
   - What's unclear: Whether to hard-code prices or fetch them from an API.
   - Recommendation: Hard-code current prices in a config object. Update manually when prices change. This is simpler and more reliable than API calls for pricing.

3. **Supabase RLS for ai_requests insert**
   - What we know: The API route uses the Supabase server client with the user's JWT. The `onFinish` callback runs server-side.
   - What's unclear: Whether the `onFinish` callback will have the same Supabase client context (auth session) as the main request handler.
   - Recommendation: Capture the `supabase` client and `user.id` in the closure before calling `streamText`. Pass them to the `onFinish` callback. If auth context is lost in the callback, use a service role client for inserting ai_requests (with the user_id from the closure).

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/ai-sdk_dev` - Provider registry, streaming patterns, provider configuration
- Context7 `/vercel/ai` - streamText API, onFinish callback, error handling, token usage
- Context7 `/pmndrs/zustand` - Async action patterns, store design
- Supabase docs - RLS policies, table creation, migration patterns
- Existing codebase: `apps/web/src/stores/guide-store.ts`, `apps/web/src/stores/editor-store.ts` - Zustand patterns to follow
- Existing codebase: `apps/web/src/app/api/guides/route.ts` - API route pattern with Supabase + Zod + error handling
- Existing codebase: `apps/web/src/app/api/serp/analyze/route.ts` - Complex API route with rate limiting + caching + NLP service calls
- Existing codebase: `apps/web/src/types/database.ts` - Type definition pattern
- Existing codebase: `apps/web/src/lib/schemas.ts` - Zod schema pattern

### Secondary (MEDIUM confidence)
- GitHub releases `/vercel/ai` - Version numbers (ai@5.0.155 latest as of March 2026)
- WebSearch: AI SDK v6 exists but is in beta; v5 is the stable recommended choice
- WebSearch: `maxDuration` export requirement confirmed across multiple sources

### Tertiary (LOW confidence)
- GPT-5 model availability: Referenced in CLAUDE.md but not verified against current OpenAI API. Model IDs may differ from assumptions.
- Cost per token rates: Will need verification at implementation time against current Anthropic and OpenAI pricing pages.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vercel AI SDK is the established solution, verified via Context7 with current API examples
- Architecture: HIGH - Patterns derived from official docs + existing codebase conventions
- Pitfalls: HIGH - Verified through Context7 docs, WebSearch, and analysis of existing codebase patterns
- Database schema: MEDIUM - Schema design follows CLAUDE.md data models and existing Supabase patterns, but exact RLS for onFinish callback needs validation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days - stable domain, AI SDK v5 is well-established)
