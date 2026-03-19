# Phase 5: Context System - Research

**Researched:** 2026-03-19
**Domain:** CRUD data management with Zustand + Supabase + prompt template variable injection
**Confidence:** HIGH

## Summary

Phase 5 adds a "Context System" that lets users create reusable prompt contexts (audience, tone, sector, brief) and attach them to guides so that all AI prompts are automatically enriched with these variables. This is a feature that stitches together multiple existing pieces of infrastructure rather than introducing new technology.

The key insight is that **most of the infrastructure already exists**. The `prompt_context` JSONB column is already on the `guides` table (migration 004). The `context-builder.ts` already reads `userContext` and injects `{audience}`, `{tone}`, `{sector}`, `{brief}` into templates. The `assistant-panel.tsx` already shows a "No context" warning card. What is missing is: (1) a dedicated `prompt_contexts` table for reusable, named contexts, (2) API routes for CRUD operations, (3) a UI for creating/editing/deleting contexts, (4) a context selector dropdown in the AssistantPanel, and (5) wiring the selected context into the execution flow via the guide's `prompt_context` field.

**Primary recommendation:** Create a `prompt_contexts` table (user-owned, CRUD via 3 API routes), a Zustand context-store for client state, a context management dialog, and a context selector dropdown in AssistantPanel. The active context ID gets saved to the guide's `prompt_context` field (or a new `active_context_id` FK column), and the `/api/ai/execute` route resolves the full context at execution time.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5.x (already installed) | Client state for contexts list, active context | Project standard (guide-store, editor-store, ai-store) |
| Supabase | Already configured | Database + RLS for context CRUD | Project standard |
| Zod | Already installed | Request validation for API routes | Project standard (used in /api/ai/execute) |
| shadcn/ui base-nova | Already installed | Select, Dialog, Input, Button components | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @base-ui/react/select | Already installed | Context selector dropdown | For the active context picker in AssistantPanel |
| @base-ui/react/dialog | Already installed | Context create/edit modal | For the context management UI |
| lucide-react | Already installed | Icons (Settings, Plus, Trash2, Edit) | For context management actions |
| sonner | Already installed | Toast notifications | For CRUD success/error feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate `prompt_contexts` table | Embed in guide `prompt_context` JSONB directly | Separate table allows reuse across guides, naming, listing. JSONB-only is simpler but prevents reuse. **Recommend separate table.** |
| Zustand context-store | React Query / SWR for fetching | Zustand is project standard. Context list is small, doesn't need advanced caching. **Recommend Zustand.** |
| New `active_context_id` FK column on guides | Store context ID inside existing `prompt_context` JSONB | FK gives referential integrity, simpler queries. JSONB is more flexible. **Recommend FK column.** |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
  stores/
    context-store.ts           # Zustand store for context list + active context
  components/
    analysis/
      assistant-panel.tsx      # Modified: add context selector + management buttons
      context-selector.tsx     # New: dropdown to pick active context
      context-dialog.tsx       # New: create/edit context modal form
  app/api/
    contexts/
      route.ts                 # GET (list user contexts), POST (create)
      [id]/
        route.ts               # PATCH (update), DELETE (delete)
  types/
    database.ts                # Add PromptContextRecord type
  lib/ai/
    context-builder.ts         # No changes needed (already handles userContext)
supabase/migrations/
  007_create_prompt_contexts.sql   # New table + FK on guides
```

### Pattern 1: Zustand CRUD Store with Async Actions
**What:** A Zustand store that holds the contexts list, active context, and exposes fetch/create/update/delete actions that call API routes.
**When to use:** For any entity that the user creates and manages client-side.
**Example:**
```typescript
// Source: Project patterns from ai-store.ts and guide-store.ts
interface ContextState {
  contexts: PromptContextRecord[]
  activeContextId: string | null
  loading: boolean

  fetchContexts: () => Promise<void>
  createContext: (data: CreateContextData) => Promise<void>
  updateContext: (id: string, data: Partial<CreateContextData>) => Promise<void>
  deleteContext: (id: string) => Promise<void>
  setActiveContext: (id: string | null, guideId: string) => Promise<void>
}
```

### Pattern 2: Guide-Scoped Context Selection
**What:** Each guide has an `active_context_id` FK that points to the user's selected context. When executing a prompt, the API route resolves the full context from this FK.
**When to use:** When a configuration choice must persist per-guide and be available server-side.
**Example:**
```typescript
// In /api/ai/execute route.ts, after loading guide:
// Load active context if guide has one
let userContext = guide.prompt_context
if (guide.active_context_id) {
  const { data: ctx } = await supabase
    .from('prompt_contexts')
    .select('audience, tone, sector, brief')
    .eq('id', guide.active_context_id)
    .single()
  if (ctx) userContext = ctx
}
```

### Pattern 3: Base UI Select with Null Guard (Lesson L1)
**What:** The base-nova Select `onValueChange` passes `string | null`, requiring a null guard.
**When to use:** Every Select component in the project.
**Example:**
```typescript
// Source: tasks/lessons.md L1
<Select
  value={activeContextId}
  onValueChange={(v) => v && setActiveContext(v, guideId)}
>
  {/* ... items */}
</Select>
```

### Anti-Patterns to Avoid
- **Storing full context object in guide JSONB:** Makes it impossible to update a context and have all guides reflect the change. Use FK reference instead.
- **Client-side context resolution:** Don't send the full context from the client to the AI execute endpoint. The server should resolve the context from the database to prevent prompt injection.
- **Mixing context ownership:** Don't allow users to see/select other users' contexts. RLS policy on `prompt_contexts` must enforce `user_id = auth.uid()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validation logic | Zod schemas in API routes | Already established pattern in /api/ai/execute |
| Dropdown with search | Custom filtered list | shadcn Select component | Already exists, handles keyboard nav, accessibility |
| Toast notifications | Custom error display | sonner (already configured) | Already used by AssistantPanel |
| UUID generation | Custom ID generation | Supabase gen_random_uuid() | Database-generated UUIDs are the project standard |
| RLS policies | Custom auth checks in code | Supabase RLS | Already established for guides, prompts, ai_requests |

**Key insight:** This feature is 100% about wiring together existing patterns. No new technology is needed. The risk is in getting the data flow right between the UI, store, API, and execution pipeline.

## Common Pitfalls

### Pitfall 1: Context Deletion Orphans Active References
**What goes wrong:** User deletes a context that is the active context for one or more guides. The guide now has a dangling `active_context_id`.
**Why it happens:** FK constraint without ON DELETE handling.
**How to avoid:** Use `ON DELETE SET NULL` on the FK constraint. In the UI, show a "No context" state gracefully when `active_context_id` is null.
**Warning signs:** Guide loads but context selector shows nothing selected.

### Pitfall 2: Select onValueChange Null Guard (L1)
**What goes wrong:** Selecting "No context" in the dropdown passes `null` to the handler, which then fails or does nothing.
**Why it happens:** Base UI Select `onValueChange` passes `string | null`.
**How to avoid:** Handle null explicitly: `(v) => setActiveContext(v, guideId)` (allow null to clear the context).
**Warning signs:** User cannot deselect a context once one is selected.

### Pitfall 3: Stale Context in Prompt Execution
**What goes wrong:** User updates a context, but the AI execute endpoint still uses the old cached/JSONB version.
**Why it happens:** If context is duplicated into the guide's `prompt_context` JSONB instead of resolved via FK at execution time.
**How to avoid:** Always resolve the context from the `prompt_contexts` table at execution time using the `active_context_id` FK. Never cache/duplicate context data into the guide row.
**Warning signs:** User changes context fields but AI prompts use old values.

### Pitfall 4: Empty Context Variables in Templates
**What goes wrong:** Prompt template contains `{audience}` but no context is active, so it renders as empty string.
**Why it happens:** `buildPrompt` replaces `{audience}` with `context.userContext?.audience ?? ''`.
**How to avoid:** This is actually acceptable behavior (empty string for absent context). But the UI should show the "No context" warning card (already exists in AssistantPanel) so users understand prompts are not enriched.
**Warning signs:** AI results feel generic/unspecific even though prompts mention context variables.

### Pitfall 5: Dialog Focus Stealing from Editor
**What goes wrong:** Opening the context management dialog causes the TipTap editor to lose focus and selection state.
**Why it happens:** Base UI Dialog is modal and captures focus.
**How to avoid:** This is only a concern if the user needs to reference editor content while managing contexts (they don't). Context management is a setup task, not an editing task. No special handling needed.
**Warning signs:** None expected for this feature.

### Pitfall 6: RLS Policy Must Allow Insert with user_id
**What goes wrong:** User creates a context but gets a Supabase permission error.
**Why it happens:** RLS INSERT policy needs `WITH CHECK (auth.uid() = user_id)` and the API must set `user_id` from the authenticated session.
**How to avoid:** Follow the existing pattern from guides table (same RLS pattern). Always set `user_id` server-side from `supabase.auth.getUser()`.
**Warning signs:** 403 errors when creating contexts.

## Code Examples

Verified patterns from the existing codebase:

### Database Migration Pattern (from 003_create_prompts_table.sql)
```sql
-- Source: supabase/migrations/003_create_prompts_table.sql
CREATE TABLE prompt_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  audience TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  brief TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prompt_contexts ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own contexts
CREATE POLICY "Users can view own contexts"
  ON prompt_contexts FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own contexts"
  ON prompt_contexts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own contexts"
  ON prompt_contexts FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own contexts"
  ON prompt_contexts FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Add FK on guides to reference active context
ALTER TABLE guides
  ADD COLUMN active_context_id UUID REFERENCES prompt_contexts(id) ON DELETE SET NULL;

CREATE INDEX idx_prompt_contexts_user ON prompt_contexts (user_id);
CREATE INDEX idx_guides_active_context ON guides (active_context_id);
```

### API Route CRUD Pattern (from /api/prompts/route.ts and /api/ai/execute/route.ts)
```typescript
// Source: Pattern from apps/web/src/app/api/prompts/route.ts
// GET /api/contexts - List user's contexts
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('prompt_contexts')
    .select('id, name, audience, tone, sector, brief, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load contexts' }, { status: 500 })
  return NextResponse.json({ contexts: data })
}

// POST /api/contexts - Create new context
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const validated = CreateContextSchema.parse(body)

  const { data, error } = await supabase
    .from('prompt_contexts')
    .insert({ ...validated, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create context' }, { status: 500 })
  return NextResponse.json({ context: data }, { status: 201 })
}
```

### Zustand Store Pattern (from ai-store.ts)
```typescript
// Source: Pattern from apps/web/src/stores/ai-store.ts
import { create } from 'zustand'

interface ContextState {
  contexts: PromptContextRecord[]
  activeContextId: string | null
  loading: boolean

  fetchContexts: () => Promise<void>
  setActiveContext: (id: string | null, guideId: string) => Promise<void>
  createContext: (data: CreateContextData) => Promise<PromptContextRecord | null>
  updateContext: (id: string, data: Partial<CreateContextData>) => Promise<void>
  deleteContext: (id: string) => Promise<void>
}

export const useContextStore = create<ContextState>()((set, get) => ({
  contexts: [],
  activeContextId: null,
  loading: false,

  fetchContexts: async () => {
    set({ loading: true })
    const res = await fetch('/api/contexts')
    const data = await res.json()
    set({ contexts: data.contexts || [], loading: false })
  },

  setActiveContext: async (id, guideId) => {
    // Persist to guide
    await fetch(`/api/guides/${guideId}/context`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_context_id: id }),
    })
    set({ activeContextId: id })
  },
  // ... create, update, delete follow same pattern
}))
```

### Context Selector Component Pattern (base-nova Select)
```typescript
// Source: Pattern from apps/web/src/components/ui/select.tsx + lessons.md L1
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

function ContextSelector({ guideId }: { guideId: string }) {
  const contexts = useContextStore((s) => s.contexts)
  const activeContextId = useContextStore((s) => s.activeContextId)
  const setActiveContext = useContextStore((s) => s.setActiveContext)

  return (
    <Select
      value={activeContextId ?? undefined}
      onValueChange={(v) => setActiveContext(v, guideId)}
    >
      <SelectTrigger size="sm">
        <SelectValue placeholder="Aucun contexte" />
      </SelectTrigger>
      <SelectContent>
        {contexts.map((ctx) => (
          <SelectItem key={ctx.id} value={ctx.id}>
            {ctx.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### Modified AI Execute Route Pattern
```typescript
// Source: Modified from apps/web/src/app/api/ai/execute/route.ts
// In the existing POST handler, after loading guide:

// Resolve context from FK instead of inline JSONB
let userContext = guide.prompt_context || undefined
if (guide.active_context_id) {
  const { data: ctx } = await supabase
    .from('prompt_contexts')
    .select('audience, tone, sector, brief')
    .eq('id', guide.active_context_id)
    .single()
  if (ctx) {
    userContext = {
      audience: ctx.audience || undefined,
      tone: ctx.tone || undefined,
      sector: ctx.sector || undefined,
      brief: ctx.brief || undefined,
    }
  }
}

// Pass to buildPromptContext (existing call, just update options.userContext)
const promptContext = buildPromptContext(
  serpAnalysis || null,
  semanticTerms || [],
  { keyword: guide.keyword, language: guide.language },
  {
    selectedText,
    currentContent: guide.content ? JSON.stringify(guide.content) : '',
    userContext,
  }
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline JSONB on guide | Separate table + FK reference | This phase | Enables reuse, naming, proper CRUD |
| No context warning only | Context selector + management UI | This phase | Users can actually configure prompts |

**Deprecated/outdated:**
- `guide.prompt_context` JSONB field (migration 004): Will remain in schema for backward compatibility but should be considered deprecated once `active_context_id` FK is in use. The execute route should prefer `active_context_id` resolution over inline `prompt_context`.

## Data Flow Diagram

```
User creates context
  --> POST /api/contexts
    --> Supabase INSERT prompt_contexts
      --> Response with new context
        --> context-store.contexts updated

User selects context for guide
  --> PATCH /api/guides/[id]/context
    --> Supabase UPDATE guides SET active_context_id
      --> context-store.activeContextId updated

User executes AI prompt
  --> POST /api/ai/execute
    --> Load guide (includes active_context_id)
    --> Resolve prompt_contexts row by active_context_id
    --> buildPromptContext(... { userContext: resolved })
    --> buildPrompt(template, context) replaces {audience}, {tone}, {sector}, {brief}
    --> executePrompt(enriched prompt)
    --> Stream response
```

## Open Questions

1. **Should context clearing be explicit or implicit?**
   - What we know: The Select component can pass `null` to `onValueChange`. The guide's `active_context_id` is nullable with `ON DELETE SET NULL`.
   - What's unclear: Should there be a "Clear context" option in the dropdown, or should deselecting the current item clear it?
   - Recommendation: Add a "Aucun contexte" item at the top of the Select that maps to `null`. This is explicit and intuitive.

2. **Should the `prompt_context` JSONB column be removed?**
   - What we know: Migration 004 added `prompt_context JSONB` to guides. Phase 5 introduces `active_context_id` FK which is the preferred approach.
   - What's unclear: Whether any existing code writes directly to `prompt_context` JSONB.
   - Recommendation: Keep the column for backward compatibility but deprecate it. The execute route should check `active_context_id` first, fall back to `prompt_context` JSONB.

3. **How to handle the "active context for guide" persistence?**
   - Option A: Add `active_context_id` FK column on guides table (new migration) - clean, proper FK
   - Option B: Store `{ active_context_id: "uuid" }` inside existing `prompt_context` JSONB - no migration needed
   - Recommendation: Option A. FK gives referential integrity, cleaner queries, ON DELETE SET NULL behavior. Migration is trivial.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/web/src/lib/ai/context-builder.ts` - Already handles `userContext` with audience, tone, sector, brief
- Codebase analysis: `apps/web/src/app/api/ai/execute/route.ts` - Already passes `guide.prompt_context` to `buildPromptContext`
- Codebase analysis: `supabase/migrations/004_add_prompt_context_to_guides.sql` - `prompt_context JSONB` column exists
- Codebase analysis: `apps/web/src/components/analysis/assistant-panel.tsx` - "No context" warning card exists at line 173
- Codebase analysis: `apps/web/src/types/database.ts` - `PromptContext` type defined with audience, tone, sector, brief
- Codebase analysis: `apps/web/src/stores/ai-store.ts` - Pattern for Zustand async stores
- Codebase analysis: `supabase/migrations/003_create_prompts_table.sql` - Pattern for RLS policies
- Codebase analysis: `tasks/lessons.md` - L1: Base UI Select onValueChange null guard

### Secondary (MEDIUM confidence)
- [Base UI Select docs](https://base-ui.com/react/components/select) - Confirmed onValueChange passes `Value | null`, value accepts `null | undefined`
- [Zustand discussions](https://github.com/pmndrs/zustand/discussions/2486) - Multiple small stores recommended over single store

### Tertiary (LOW confidence)
- None. All findings verified against codebase or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and patterns established in codebase
- Architecture: HIGH - Direct extension of existing patterns (stores, API routes, migrations)
- Pitfalls: HIGH - Based on actual codebase analysis and lessons.md
- Code examples: HIGH - Derived from existing codebase patterns, not hypothetical

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no external dependencies changing)
