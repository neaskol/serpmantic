# AI Article Writer — Design Document

**Date**: 2026-03-21
**Status**: Approved

## Summary

Add a "Redaction IA" tab (✍️) to the analysis panel that lets users generate a full article from an existing plan, select which AI provider/model to use (Anthropic, OpenAI, Google Gemini), and iteratively optimize until reaching a target semantic score of 75-85.

## User Flow

1. User generates a plan in the Plan tab (existing feature)
2. User opens the Redaction tab
3. User selects AI model (dropdown grouped by provider)
4. User clicks "Ecrire l'article" → AI writes the full article in streaming
5. Score recalculates automatically
6. If score < target → panel shows missing terms and offers optimization
7. User can regenerate individual sections or optimize the whole article

## UI Design — 3 States

### State 1: No plan detected
- Message: "Generez d'abord un plan dans l'onglet Plan"
- Link button to switch to Plan tab

### State 2: Plan detected, ready to write
- Model selector dropdown (grouped by provider)
- Score target display (75-85)
- Plan preview (list of H2/H3 sections detected in editor)
- "Ecrire l'article" button

### State 3: Article generated, optimization mode
- Current score with progress bar toward target
- Term summary (missing / OK / excess counts)
- Section list with per-section regenerate buttons [↻]
- "Optimiser tout l'article" button
- "Regenerer une section" via section-specific buttons

## Model Selection

| Provider | Models | Default |
|----------|--------|---------|
| Anthropic | Claude Sonnet 4.5, Claude Sonnet 4 | Claude Sonnet 4.5 |
| OpenAI | GPT-4o, GPT-4o-mini | GPT-4o |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash | Gemini 2.5 Pro |

## API Design

### POST `/api/ai/write`

**Request body:**
```json
{
  "guideId": "string",
  "modelId": "string",
  "mode": "full | section | optimize",
  "sectionIndex": "number (optional, for mode=section)",
  "sectionHeading": "string (optional, for mode=section)",
  "currentContent": "string (optional, for mode=optimize/section)"
}
```

**Response:** Streaming text (same pattern as `/api/ai/execute`)

### Prompt Strategy

**Full article generation:**
- System prompt: SEO content writer role, target language, natural tone
- User prompt includes: keyword, plan (H2/H3 structure), top 30 semantic terms with min/max ranges, terms to avoid, structural benchmarks (word count range, etc.)
- Instruction: write HTML content for each section, integrate semantic terms naturally

**Section regeneration:**
- System prompt: same role + context of full article
- User prompt includes: the specific section heading, current section content, terms that are missing in this section area, terms in excess
- Instruction: rewrite this section only, improve semantic coverage

**Full optimization:**
- System prompt: SEO optimizer role
- User prompt includes: full current article, current score, list of missing terms with how many more needed, list of excess terms
- Instruction: rewrite passages to naturally integrate missing terms and reduce excess terms, target score 75-85

## Architecture

### New files
- `apps/web/src/components/analysis/writer-panel.tsx` — Main UI component
- `apps/web/src/app/api/ai/write/route.ts` — API endpoint

### Modified files
- `apps/web/src/components/analysis/analysis-panel.tsx` — Add 8th tab
- `apps/web/src/lib/ai/router.ts` — Add `article_writing` and `article_optimization` task types
- `apps/web/src/lib/ai/context-builder.ts` — Add writer-specific prompt builder

### New dependency
- `@ai-sdk/google` — Gemini provider for Vercel AI SDK

### State management
- Local component state (useState) in writer-panel.tsx
- No new Zustand store needed
- Reads from guide-store (semanticTerms, serpAnalysis, score) and editor-store (editor instance, content)

### Plan detection logic
- Parse editor content for H2/H3 nodes
- If >= 2 H2 headings found → plan is detected
- Extract section titles and structure for display

### Section detection for regeneration
- Parse TipTap JSON content tree
- Identify sections as: H2 node + all content until next H2
- Track section boundaries (node positions) for targeted replacement

### Editor insertion
- Full write: `editor.chain().clearContent().insertContent(html).run()`
- Section replace: select range from H2 to next H2, replace selection
- Optimization: full content replacement with confirmation dialog

## Constraints

- Score capped at 120 (existing rule)
- Warn if score > 100 (over-optimization)
- Max 3 optimization iterations suggested (avoid infinite loops)
- Streaming response for all generation modes
- Token usage logged to `ai_requests` table (existing pattern)
