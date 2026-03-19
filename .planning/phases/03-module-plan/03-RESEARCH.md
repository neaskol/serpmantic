# Phase 3: Module Plan - Research

**Researched:** 2026-03-19
**Domain:** AI-powered content outline generation based on SERP competitor analysis
**Confidence:** HIGH

## Summary

Phase 3 builds the Plan module, which generates optimal H2/H3 content outlines by analyzing competitor heading structures from SERP data. This feature uses AI (specifically Claude Sonnet 4.5) to synthesize competitor heading patterns, semantic term distribution, and user intent into a structured outline that users can preview and insert into the TipTap editor with one click.

**Current state:** The UI skeleton exists in `plan-panel.tsx` with a "Generate" button and preview card, but the `/api/ai/plan` endpoint doesn't exist yet. Phase 1 provides the AI infrastructure (LLM router, context builder, streaming executor), and Phase 2 demonstrates editor insertion patterns via the IAssistant module.

**What's missing:**
1. `/api/ai/plan` API route with Claude Sonnet 4.5 integration
2. SERP heading extraction and clustering logic
3. Semantic term distribution across outline sections
4. Preview modal with Accept/Insert action
5. Over-optimization warning (if outline would push score > 100)
6. Editor insertion logic for structured HTML headings

**Primary recommendation:** Use Claude Sonnet 4.5 for outline generation (proven 18% better at planning tasks vs Sonnet 4), extract H2/H3 from top SERP pages, cluster by semantic similarity, enrich with semantic term recommendations per section, show preview with Accept/Reject modal, and insert as structured HTML via TipTap's `insertContent()` API.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^5.0.0 | Vercel AI SDK - streamText, generateText | Phase 1 foundation, unified API for Claude/GPT |
| `@ai-sdk/anthropic` | ^2.0.0 | Anthropic Claude provider | Claude Sonnet 4.5 excels at structured planning tasks (+18% vs Sonnet 4) |
| TipTap | installed | Rich text editor with heading extension | Supports programmatic insertion of H2/H3 via `insertContent()` |
| Zustand | ^5.0.12 | State management | Editor store already exposes editor instance for insertion |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | ^5.1.7 | ID generation | Generate unique IDs for outline sections |
| `zod` | ^4.3.6 | Schema validation | Validate `/api/ai/plan` request/response |
| Supabase | ^2.99.2 | Database client | Store SERP pages with extracted headings |

### Not Needed

| Technology | Why Not |
|-----------|---------|
| Natural Language Clustering (spaCy, etc.) | Semantic term clustering already done in Phase 1 SERP analysis. LLM (Claude) can cluster headings based on semantic similarity without additional NLP infrastructure. |
| Markdown parsing library | TipTap's `insertContent()` accepts HTML directly. No need for Markdown intermediate format. |
| Separate heading extraction service | SERP analysis already extracts heading counts. Phase 3 adds heading *text* extraction to existing SERP crawler. |

**Installation:**
```bash
# No new packages needed - use existing Phase 1 infrastructure
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── app/
│   └── api/
│       └── ai/
│           ├── execute/route.ts      # (Phase 1) General AI execution
│           └── plan/route.ts         # (Phase 3) Outline generation
├── lib/
│   └── ai/
│       ├── registry.ts               # (Phase 1) Provider registry
│       ├── router.ts                 # (Phase 1) LLM routing - add 'plan_generation'
│       ├── context-builder.ts        # (Phase 1) SERP context enrichment
│       ├── executor.ts               # (Phase 1) Streaming executor
│       └── outline-builder.ts        # (Phase 3) NEW: Outline-specific prompt building
├── components/
│   └── analysis/
│       └── plan-panel.tsx            # (Phase 3) UI with preview modal
└── stores/
    ├── editor-store.ts               # (Phase 2) Editor instance for insertion
    └── guide-store.ts                # (Phase 1) SERP data access
```

### Pattern 1: SERP Heading Extraction

**Problem:** Need to extract H2/H3 text content from competitor pages, not just heading counts.

**Current state:** Phase 1 SERP analysis extracts heading *counts* but not heading *text*.

**Solution:** Extend SERP crawler to extract and store heading hierarchy.

**Implementation:**
```typescript
// In SERP crawler (Python NLP service or Node.js Cheerio)
interface ExtractedHeading {
  level: 2 | 3  // Only H2 and H3 (H1 is typically page title)
  text: string
  position: number  // Order in document
}

function extractHeadings(html: string): ExtractedHeading[] {
  const $ = cheerio.load(html)
  const headings: ExtractedHeading[] = []

  $('h2, h3').each((index, element) => {
    const tagName = element.tagName.toLowerCase()
    const level = parseInt(tagName[1]) as 2 | 3
    const text = $(element).text().trim()

    if (text) {
      headings.push({ level, text, position: index })
    }
  })

  return headings
}
```

**Database schema addition:**
```sql
-- Add to serp_pages table
ALTER TABLE serp_pages
ADD COLUMN headings JSONB DEFAULT '[]';

-- Example data:
-- [
--   {"level": 2, "text": "What is a CEE delegate?", "position": 0},
--   {"level": 3, "text": "Roles and responsibilities", "position": 1},
--   {"level": 3, "text": "Required certifications", "position": 2},
--   {"level": 2, "text": "How to become a CEE delegate", "position": 3}
-- ]
```

**Tradeoff:** Storing heading text increases database storage slightly, but enables outline generation without re-crawling pages.

### Pattern 2: Claude Sonnet 4.5 Prompt for Outline Generation

**Problem:** Generate structured H2/H3 outline that synthesizes competitor patterns and semantic terms.

**Why Claude Sonnet 4.5:** Cognition AI reported 18% increase in planning performance with Sonnet 4.5 vs Sonnet 4. Claude 4.x models respond well to XML-structured prompts.

**Implementation:**
```typescript
// apps/web/src/lib/ai/outline-builder.ts
interface OutlineSection {
  level: 'h2' | 'h3'
  title: string
  keywords: string[]  // Semantic terms to cover in this section
}

function buildOutlinePrompt(
  keyword: string,
  competitorHeadings: Array<{ url: string; title: string; headings: ExtractedHeading[] }>,
  topSemanticTerms: string[]
): string {
  return `<task>
Generate an optimal H2/H3 content outline for the target keyword: "${keyword}".

Analyze the heading structures from top-ranking competitor pages and create a comprehensive outline that covers all important subtopics while maintaining natural flow and avoiding over-optimization.
</task>

<competitor_headings>
${competitorHeadings.map(comp => `
<competitor url="${comp.url}" title="${comp.title}">
${comp.headings.map(h => `  ${'  '.repeat(h.level - 2)}<${h.level === 2 ? 'h2' : 'h3'}>${h.text}</${h.level === 2 ? 'h2' : 'h3'}>`).join('\n')}
</competitor>
`).join('\n')}
</competitor_headings>

<semantic_terms>
These are the top semantic terms that should be distributed across the outline sections:
${topSemanticTerms.map(term => `- ${term}`).join('\n')}
</semantic_terms>

<guidelines>
1. Create H2 headings for major topic clusters (4-8 H2 sections typical)
2. Add H3 subheadings under H2 sections where appropriate (0-4 H3s per H2)
3. Each heading should address a distinct aspect - avoid redundancy
4. Map user intent: what questions do searchers want answered?
5. Distribute semantic terms naturally across sections
6. Use clear, specific heading text (not vague like "Introduction" or "Overview")
7. Follow heading hierarchy: H3 must follow H2, don't skip levels
8. Prioritize topics that appear in multiple competitor outlines
</guidelines>

<output_format>
Return ONLY a valid JSON array with this exact structure:
[
  {
    "level": "h2",
    "title": "Heading text here",
    "keywords": ["semantic term 1", "semantic term 2"]
  },
  {
    "level": "h3",
    "title": "Subheading text here",
    "keywords": ["semantic term 3"]
  }
]

Do not include any markdown formatting, explanations, or additional text. Only the JSON array.
</output_format>`
}
```

**Why XML tags:** Claude 4.x system prompt uses XML extensively (`<behavior_instructions>`, `<artifacts_info>`). XML provides clear structure boundaries for LLM parsing.

**Why JSON output:** Structured JSON makes parsing trivial and prevents free-form text issues.

### Pattern 3: Preview Modal with Accept/Insert

**Problem:** User needs to review generated outline before inserting into editor, with ability to reject.

**Solution:** Show outline in Dialog modal with Accept/Reject buttons (same pattern as IAssistant result modal).

**Implementation:**
```tsx
// In plan-panel.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/editor-store'

export function PlanPanel() {
  const [plan, setPlan] = useState<OutlineSection[] | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const editor = useEditorStore((s) => s.editor)

  function handleGenerate() {
    // ... generate logic
    // On success:
    setPlan(generatedPlan)
    setShowPreview(true)
  }

  function handleAccept() {
    if (!editor || !plan) return

    // Convert outline to HTML
    const html = plan.map(section => {
      const tag = section.level
      return `<${tag}>${section.title}</${tag}>`
    }).join('\n')

    // Insert into editor
    editor.chain()
      .focus()
      .insertContent(html)
      .run()

    setShowPreview(false)
    setPlan(null)
    toast.success('Outline inserted into editor')
  }

  function handleReject() {
    setShowPreview(false)
    setPlan(null)
    toast.info('Outline discarded')
  }

  return (
    <>
      {/* Generate button UI */}
      <Button onClick={handleGenerate}>Generate outline</Button>

      {/* Preview modal */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && handleReject()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generated Outline Preview</DialogTitle>
          </DialogHeader>

          <div className="max-h-96 overflow-auto space-y-2">
            {plan?.map((section, i) => (
              <div key={i} className={`flex items-start gap-2 ${section.level === 'h3' ? 'pl-4' : ''}`}>
                <Badge variant={section.level === 'h2' ? 'default' : 'secondary'}>
                  {section.level.toUpperCase()}
                </Badge>
                <div className="flex-1">
                  <p className={section.level === 'h2' ? 'font-semibold' : ''}>{section.title}</p>
                  {section.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {section.keywords.map(kw => (
                        <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleReject}>Reject</Button>
            <Button onClick={handleAccept}>Accept & Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Pattern from:** Phase 2 (IAssistant) uses the same modal pattern for AI result preview.

### Pattern 4: Over-Optimization Warning

**Problem:** Inserting a full outline might push semantic score > 100 (over-optimization threshold per CLAUDE.md Section 3.1).

**Solution:** Calculate estimated score impact before insertion, show warning if score would exceed 100.

**Implementation:**
```typescript
// In plan-panel.tsx
import { useGuideStore } from '@/stores/guide-store'

function estimateScoreImpact(outline: OutlineSection[]): number {
  const semanticTerms = useGuideStore.getState().semanticTerms
  const currentScore = useGuideStore.getState().score

  // Count how many semantic terms appear in outline
  const outlineText = outline.map(s => s.title).join(' ').toLowerCase()

  let termMatches = 0
  semanticTerms
    .filter(t => !t.is_to_avoid)
    .forEach(term => {
      if (outlineText.includes(term.term.toLowerCase())) {
        termMatches++
      }
    })

  // Rough estimate: each term match adds ~2-5 points
  const estimatedIncrease = termMatches * 3

  return currentScore + estimatedIncrease
}

function handleAccept() {
  const estimatedScore = estimateScoreImpact(plan)

  if (estimatedScore > 100) {
    const confirmed = window.confirm(
      `Warning: This outline may push your semantic score to ~${estimatedScore} (over-optimization threshold is 100). ` +
      `Consider simplifying the outline or removing some sections. Proceed anyway?`
    )
    if (!confirmed) return
  }

  // ... insert logic
}
```

**Threshold:** Score > 100 triggers warning (per CLAUDE.md: "Au-delà de 100 = sur-optimisation").

**Alternative:** Show warning in preview modal instead of confirmation dialog (less disruptive).

### Pattern 5: TipTap HTML Insertion for Structured Headings

**Problem:** Insert H2/H3 headings into TipTap editor programmatically.

**Solution:** Use `insertContent()` command with HTML string.

**Implementation:**
```typescript
// Convert outline to HTML
function outlineToHtml(outline: OutlineSection[]): string {
  return outline.map(section => {
    const tag = section.level
    return `<${tag}>${section.title}</${tag}>`
  }).join('\n')
}

// Insert into editor
editor.commands.insertContent(outlineToHtml(plan))
```

**TipTap API:** `insertContent()` accepts plain text, HTML, or JSON. HTML is simplest for headings.

**Alternative (JSON format):**
```typescript
const content = outline.map(section => ({
  type: 'heading',
  attrs: { level: section.level === 'h2' ? 2 : 3 },
  content: [{ type: 'text', text: section.title }]
}))

editor.commands.insertContent(content)
```

**Recommendation:** Use HTML format (simpler, more readable).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heading clustering algorithm | Custom TF-IDF clustering, k-means on heading embeddings | Claude Sonnet 4.5 with structured prompt | LLM excels at semantic clustering and synthesizing patterns. Manual clustering requires embeddings, distance metrics, and tuning. Claude does this in one API call. |
| Prompt streaming for outline | Custom SSE implementation | `generateText()` instead of `streamText()` | Outline generation is fast (<5 sec), user doesn't need streaming. `generateText()` returns complete result synchronously, simpler than streaming. |
| Heading hierarchy validation | Recursive tree builder to ensure H3 follows H2 | Prompt engineering: "H3 must follow H2, don't skip levels" | Claude 4.x follows instructions precisely. Validation in prompt is more reliable than post-processing. |
| Semantic term distribution | Greedy assignment algorithm to balance terms across sections | Claude includes term distribution in prompt response | LLM can assign terms to sections based on semantic relevance. Manual assignment requires similarity scoring. |
| JSON parsing from LLM response | Custom regex parser with error recovery | `JSON.parse()` with try/catch + fallback | Prompt explicitly requests valid JSON. If parse fails, return error and let user retry. Edge cases are rare with well-structured prompts. |

**Key insight:** Outline generation is a *planning* task, not a *data processing* task. Claude Sonnet 4.5 is optimized for planning (+18% performance vs Sonnet 4). Avoid over-engineering with custom algorithms when LLM capabilities suffice.

## Common Pitfalls

### Pitfall 1: Editor Contains Content - Insertion Overwrites

**What goes wrong:** User generates outline, clicks "Insert", and accidentally overwrites existing content in editor.

**Why it happens:** `insertContent()` inserts at cursor position. If cursor is in the middle of content, outline splits existing text.

**How to avoid:**
1. Check if editor has content (word count > 50) before allowing generation
2. Show warning: "Editor contains content. Clear editor first."
3. Disable "Generate" button if `plainText.length > 50`
4. Alternative: Allow "Insert at end" option that sets cursor to end before insertion

**Warning signs:** User complaints about lost content, undo history shows outline inserted mid-document.

**Current implementation:** `plan-panel.tsx` already checks `editorHasContent` and shows warning. ✅ Good.

### Pitfall 2: Competitor Pages Missing Headings

**What goes wrong:** SERP pages have no H2/H3 (e.g., landing pages, product pages), resulting in empty outline.

**Why it happens:** Not all top-ranking pages are content-driven. Some are transactional/navigational.

**How to avoid:**
1. Filter SERP pages: exclude pages with < 3 headings
2. Fallback: if < 3 competitor pages have headings, show error: "Not enough competitor data to generate outline"
3. Prompt includes: "If competitor data is sparse, create outline based on semantic terms and common content patterns for this keyword."

**Warning signs:** API returns empty outline array, user sees "No outline generated" message.

### Pitfall 3: LLM Returns Malformed JSON

**What goes wrong:** Claude returns JSON with extra text, markdown formatting, or syntax errors.

**Why it happens:** LLM occasionally ignores output format instructions, especially under high load or with ambiguous prompts.

**How to avoid:**
1. Prompt explicitly: "Return ONLY valid JSON. Do not include markdown, explanations, or additional text."
2. Strip markdown code fences: `response.replace(/```json\n?/g, '').replace(/```\n?/g, '')`
3. Try/catch around `JSON.parse()` with fallback error message
4. Log malformed responses for debugging

**Warning signs:** 500 errors from `/api/ai/plan`, JSON parse errors in logs, user sees "Failed to generate outline" toast.

**Example fix:**
```typescript
try {
  // Strip common markdown artifacts
  const cleaned = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  const plan = JSON.parse(cleaned)
  return NextResponse.json({ plan })
} catch (error) {
  logger.error('Failed to parse outline JSON', { responseText, error })
  return NextResponse.json(
    { error: 'Generated outline was malformed. Please try again.' },
    { status: 500 }
  )
}
```

### Pitfall 4: Semantic Term Keywords Overwhelm Headings

**What goes wrong:** Outline sections have 10+ keywords listed, making preview cluttered and distracting.

**Why it happens:** Prompt assigns too many semantic terms per section.

**How to avoid:**
1. Limit keywords per section: "Assign 2-4 semantic terms per section"
2. UI: Only show top 3 keywords per section, hide rest behind "Show more"
3. Prioritize by importance: assign high-importance terms first

**Warning signs:** Preview modal is unreadable, keywords dominate headings visually.

### Pitfall 5: Generated Headings Are Too Generic

**What goes wrong:** Outline includes vague headings like "Introduction", "Overview", "Conclusion", "Final Thoughts".

**Why it happens:** LLM defaults to generic content structure patterns from training data.

**How to avoid:**
1. Prompt guideline: "Use clear, specific heading text. Avoid generic labels like 'Introduction', 'Overview', 'Conclusion'."
2. Example-driven prompt: Show 2-3 good vs bad heading examples
3. Post-processing filter: flag generic terms, request regeneration

**Warning signs:** User feedback: "Outline is too basic", "Not specific to my keyword".

**Example prompt addition:**
```typescript
<anti_patterns>
❌ Bad: "Introduction", "Overview", "Basics", "Conclusion", "Final Thoughts"
✅ Good: "What is a CEE delegate?", "How to become a CEE delegate", "Required certifications for CEE delegates"

Be specific and keyword-focused.
</anti_patterns>
```

### Pitfall 6: Over-Optimization Warning Incorrectly Calculated

**What goes wrong:** Warning shows "score will be 115" but actual score after insertion is 82.

**Why it happens:** Score estimation is simplistic (counts term matches). Actual scoring algorithm is complex (TF-IDF, term importance weighting, position in document).

**How to avoid:**
1. Label estimate as approximate: "Estimated score: ~115 (approximate)"
2. Use conservative threshold: warn if estimate > 95 instead of > 100
3. Track accuracy: log estimated vs actual scores to refine algorithm
4. Alternative: Skip estimation, show generic warning: "This outline may increase your semantic score. Review carefully."

**Warning signs:** User ignores warnings because they're consistently wrong.

### Pitfall 7: Heading Level Hierarchy Broken

**What goes wrong:** Claude generates H3 before H2, or multiple H2s without H3s (unbalanced tree).

**Why it happens:** LLM doesn't enforce strict hierarchy validation.

**How to avoid:**
1. Prompt guideline: "Follow strict hierarchy. Every H3 must follow an H2. Do not place H3 at root level."
2. Post-processing validation: check that first item is H2, every H3 has preceding H2 within last 5 items
3. If invalid, reject and regenerate

**Warning signs:** TipTap renders outline with broken structure, accessibility audit fails.

**Validation logic:**
```typescript
function validateOutlineHierarchy(outline: OutlineSection[]): boolean {
  if (outline.length === 0) return false
  if (outline[0].level !== 'h2') return false  // Must start with H2

  let lastH2Index = -1
  for (let i = 0; i < outline.length; i++) {
    if (outline[i].level === 'h2') {
      lastH2Index = i
    } else if (outline[i].level === 'h3') {
      if (lastH2Index === -1) return false  // H3 before any H2
    }
  }

  return true
}
```

## Code Examples

### Example 1: Complete /api/ai/plan Route Handler

```typescript
// apps/web/src/app/api/ai/plan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getModel } from '@/lib/ai/registry'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'

export const maxDuration = 30

const PlanRequestSchema = z.object({
  guideId: z.string().uuid(),
})

interface OutlineSection {
  level: 'h2' | 'h3'
  title: string
  keywords: string[]
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Validate
    const body = await request.json()
    const { guideId } = PlanRequestSchema.parse(body)

    // 3. Load guide + SERP data
    const { data: guide, error: guideError } = await supabase
      .from('guides')
      .select(`
        *,
        serp_analyses!inner (
          *,
          serp_pages!inner (id, url, title, score, headings, is_excluded),
          semantic_terms!inner (id, display_term, importance, is_to_avoid)
        )
      `)
      .eq('id', guideId)
      .single()

    if (guideError || !guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    const serpAnalysis = guide.serp_analyses[0]
    if (!serpAnalysis) {
      return NextResponse.json({ error: 'No SERP analysis found. Run analysis first.' }, { status: 400 })
    }

    // 4. Extract competitor headings
    const competitorPages = serpAnalysis.serp_pages
      .filter((p: any) => !p.is_excluded && p.headings && p.headings.length > 2)
      .slice(0, 8)  // Top 8 competitors

    if (competitorPages.length < 2) {
      return NextResponse.json(
        { error: 'Not enough competitor data. Need at least 2 pages with headings.' },
        { status: 400 }
      )
    }

    // 5. Get top semantic terms
    const topTerms = serpAnalysis.semantic_terms
      .filter((t: any) => !t.is_to_avoid)
      .sort((a: any, b: any) => b.importance - a.importance)
      .slice(0, 30)
      .map((t: any) => t.display_term)

    // 6. Build prompt
    const prompt = buildOutlinePrompt(guide.keyword, competitorPages, topTerms)

    // 7. Generate outline with Claude Sonnet 4.5
    const model = getModel('anthropic/claude-sonnet-4-5-20250929')

    const { text } = await generateText({
      model: model as any,
      system: `You are an expert SEO content strategist. Generate structured H2/H3 outlines based on SERP analysis.`,
      prompt,
      maxTokens: 2048,
    })

    // 8. Parse JSON response
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const outline: OutlineSection[] = JSON.parse(cleaned)

    // 9. Validate structure
    if (!Array.isArray(outline) || outline.length === 0) {
      throw new Error('Invalid outline format')
    }

    if (outline[0].level !== 'h2') {
      throw new Error('Outline must start with H2')
    }

    // 10. Log success
    logger.info('Outline generated', {
      guideId,
      keyword: guide.keyword,
      sectionCount: outline.length,
    })

    return NextResponse.json({ outline })
  } catch (error) {
    logger.error('Outline generation failed', { error })
    return handleApiError(error, { route: '/api/ai/plan' })
  }
}

function buildOutlinePrompt(
  keyword: string,
  competitors: any[],
  topTerms: string[]
): string {
  return `<task>
Generate an optimal H2/H3 content outline for the target keyword: "${keyword}".

Analyze the heading structures from top-ranking competitor pages and create a comprehensive outline that covers all important subtopics while maintaining natural flow and avoiding over-optimization.
</task>

<competitor_headings>
${competitors.map(comp => `
<competitor url="${comp.url}" title="${comp.title}">
${comp.headings.map((h: any) => `  ${'  '.repeat(h.level - 2)}<${h.level === 2 ? 'h2' : 'h3'}>${h.text}</${h.level === 2 ? 'h2' : 'h3'}>`).join('\n')}
</competitor>
`).join('\n')}
</competitor_headings>

<semantic_terms>
Distribute these semantic terms across sections naturally (2-4 terms per section):
${topTerms.map(term => `- ${term}`).join('\n')}
</semantic_terms>

<guidelines>
1. Create H2 headings for major topic clusters (4-8 H2 sections typical)
2. Add H3 subheadings under H2 sections where appropriate (0-4 H3s per H2)
3. Each heading should address a distinct aspect - avoid redundancy
4. Map user intent: what questions do searchers want answered?
5. Distribute semantic terms naturally across sections
6. Use clear, specific heading text (not vague like "Introduction" or "Overview")
7. Follow heading hierarchy: H3 must follow H2, don't skip levels
8. Prioritize topics that appear in multiple competitor outlines
</guidelines>

<anti_patterns>
❌ Bad: "Introduction", "Overview", "Basics", "Conclusion", "Final Thoughts"
✅ Good: "What is a ${keyword}?", "How to become a ${keyword}", "Common ${keyword} mistakes"
</anti_patterns>

<output_format>
Return ONLY a valid JSON array with this exact structure:
[
  {
    "level": "h2",
    "title": "Heading text here",
    "keywords": ["semantic term 1", "semantic term 2"]
  },
  {
    "level": "h3",
    "title": "Subheading text here",
    "keywords": ["semantic term 3"]
  }
]

Do not include any markdown formatting, explanations, or additional text. Only the JSON array.
</output_format>`
}
```

### Example 2: SERP Crawler Heading Extraction

```typescript
// services/nlp/src/serp/extract-headings.ts (Python equivalent in production)
import * as cheerio from 'cheerio'

interface ExtractedHeading {
  level: 2 | 3
  text: string
  position: number
}

export function extractHeadings(html: string): ExtractedHeading[] {
  const $ = cheerio.load(html)
  const headings: ExtractedHeading[] = []

  // Only extract H2 and H3 (H1 is typically page title, H4+ too granular)
  $('h2, h3').each((index, element) => {
    const tagName = element.tagName.toLowerCase()
    const level = parseInt(tagName[1]) as 2 | 3

    // Clean text: remove extra whitespace, decode entities
    let text = $(element).text().trim()
    text = text.replace(/\s+/g, ' ')  // Collapse whitespace

    // Skip empty headings
    if (!text || text.length < 3) return

    // Skip headings that are likely navigation/UI
    const skipPatterns = [
      /^(menu|navigation|footer|sidebar|related|share|subscribe)/i,
      /^(table of contents|toc|jump to)/i,
    ]
    if (skipPatterns.some(pattern => pattern.test(text))) return

    headings.push({ level, text, position: index })
  })

  return headings
}
```

### Example 3: Updated plan-panel.tsx with Preview Modal

```tsx
// apps/web/src/components/analysis/plan-panel.tsx
'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface OutlineSection {
  level: 'h2' | 'h3'
  title: string
  keywords: string[]
}

export function PlanPanel() {
  const guide = useGuideStore((s) => s.guide)
  const plainText = useEditorStore((s) => s.plainText)
  const editor = useEditorStore((s) => s.editor)

  const [generating, setGenerating] = useState(false)
  const [outline, setOutline] = useState<OutlineSection[] | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const editorHasContent = plainText.trim().length > 50

  async function handleGenerate() {
    if (!guide || editorHasContent) return

    setGenerating(true)
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId: guide.id }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate outline')
      }

      const data = await res.json()
      setOutline(data.outline)
      setShowPreview(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate outline')
    } finally {
      setGenerating(false)
    }
  }

  function handleAccept() {
    if (!editor || !outline) return

    // Convert outline to HTML
    const html = outline.map(section => {
      const tag = section.level
      return `<${tag}>${section.title}</${tag}>`
    }).join('\n')

    // Insert into editor
    editor.chain()
      .focus()
      .insertContent(html)
      .run()

    setShowPreview(false)
    setOutline(null)
    toast.success('Outline inserted into editor')
  }

  function handleReject() {
    setShowPreview(false)
    setOutline(null)
    toast.info('Outline discarded')
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-base">Plan de contenu</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Generez le plan H2/H3 optimal base sur l&apos;analyse des pages les mieux classees.
      </p>

      {editorHasContent && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-2 px-3 flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              L&apos;editeur contient du contenu. Videz-le avant de generer un plan.
            </p>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleGenerate}
        disabled={generating || !guide || editorHasContent}
        className="w-full"
      >
        {generating ? (
          <>
            <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generation en cours...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Generer le plan optimal
          </>
        )}
      </Button>

      {/* Preview modal */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && handleReject()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aperçu du plan généré</DialogTitle>
          </DialogHeader>

          <div className="max-h-96 overflow-auto space-y-2">
            {outline?.map((section, i) => (
              <div key={i} className={`flex items-start gap-2 ${section.level === 'h3' ? 'pl-4' : ''}`}>
                <Badge variant={section.level === 'h2' ? 'default' : 'secondary'}>
                  {section.level.toUpperCase()}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className={section.level === 'h2' ? 'font-semibold' : ''}>{section.title}</p>
                  {section.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {section.keywords.slice(0, 3).map(kw => (
                        <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleReject}>Rejeter</Button>
            <Button onClick={handleAccept}>Accepter & Inserer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

### Example 4: Database Migration - Add Headings Column

```sql
-- Migration: Add headings column to serp_pages table
-- Stores extracted H2/H3 heading text for outline generation

ALTER TABLE serp_pages
ADD COLUMN headings JSONB DEFAULT '[]';

-- Index for querying pages with headings
CREATE INDEX idx_serp_pages_has_headings
ON serp_pages ((jsonb_array_length(headings) > 0));

-- Example data structure:
COMMENT ON COLUMN serp_pages.headings IS
'Array of extracted headings: [{"level": 2, "text": "Heading text", "position": 0}, ...]';

-- Example query to find pages with headings:
-- SELECT * FROM serp_pages WHERE jsonb_array_length(headings) > 2;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual heading extraction from HTML | Cheerio or BeautifulSoup with CSS selectors | 2020+ | Faster, more reliable than regex parsing |
| GPT-3.5 for outline generation | Claude Sonnet 4.5 for planning tasks | 2025-2026 | +18% planning performance, better instruction-following |
| Keyword-density based optimization | Semantic term distribution with NLP | 2024+ | Avoids keyword stuffing, aligns with Google's NLP ranking |
| Streaming outline generation | Synchronous `generateText()` | 2026 | Outlines generate in <5 sec, streaming adds complexity without benefit |
| H1-H6 heading extraction | H2-H3 only | 2023+ | H1 is page title, H4+ too granular. H2-H3 structure is content core. |
| Markdown output from LLM | Structured JSON output | 2025+ | JSON is trivially parsed, Markdown requires parser library and edge case handling |

**Deprecated/outdated:**
- `streamText()` for outline generation: Outlines are fast (<5 sec), streaming is overkill. Use `generateText()` for synchronous result.
- H4/H5/H6 extraction: Too granular for outline planning. Focus on H2/H3 structure.
- Multiple outline options: Early tools generated 3-5 outline variants for user to choose. This added cognitive load. Single optimal outline (synthesized from competitors) is clearer.

## Open Questions

1. **Heading extraction accuracy for JavaScript-rendered pages**
   - What we know: SERP crawler uses Puppeteer/Playwright for JS rendering (from Phase 1 research)
   - What's unclear: Some modern sites render headings with React/Vue components that may not use semantic HTML tags (e.g., `<div class="heading-h2">` instead of `<h2>`)
   - Recommendation: Extract by tag name first, fallback to ARIA roles (`role="heading"` + `aria-level="2"`). Log pages with no headings for manual review.

2. **Optimal number of outline sections**
   - What we know: Prompt suggests 4-8 H2 sections as typical
   - What's unclear: Does this vary by keyword intent? Informational queries may need 8+ sections, transactional queries 3-4.
   - Recommendation: Let Claude decide based on competitor data. Don't hard-code section counts. If user feedback indicates outlines are too long/short, adjust prompt guidance.

3. **User editing generated outline before insertion**
   - What we know: Requirements don't mention editing capability
   - What's unclear: Should users edit headings/keywords in preview modal before inserting?
   - Recommendation: Phase 3 MVP: no editing, just Accept/Reject. Phase 4+: add inline editing in preview modal (contenteditable or input fields).

4. **Semantic term assignment accuracy**
   - What we know: Claude assigns 2-4 keywords per section based on semantic relevance
   - What's unclear: How accurate is LLM at distributing terms optimally vs manual assignment?
   - Recommendation: Ship MVP with LLM assignment. Track if users manually adjust terms after insertion (future feature). Refine prompt if assignment quality is poor.

5. **Outline regeneration rate limit**
   - What we know: Each generation costs ~1000-2000 tokens (Claude Sonnet 4.5 at $3/$15 per million tokens)
   - What's unclear: Should we limit regenerations per guide (e.g., max 5/day) to control costs?
   - Recommendation: No rate limit for MVP. Monitor usage. If users spam regenerate button, add cooldown (30 sec between generations).

## Sources

### Primary (HIGH confidence)
- Existing codebase: `plan-panel.tsx` - UI skeleton with generate button and preview structure
- Existing codebase: `apps/web/src/lib/ai/executor.ts` - `generateText()` API available from Phase 1
- Existing codebase: `apps/web/src/lib/ai/router.ts` - LLM routing infrastructure (add `plan_generation` task type)
- Existing codebase: `apps/web/src/stores/editor-store.ts` - Editor instance accessible for insertion
- TipTap docs (Context7 /ueberdosis/tiptap) - `insertContent()` API, heading extension
- Anthropic Claude docs (Claude 4.x prompt engineering best practices) - XML tags, structured prompts, planning performance
- Phase 1 RESEARCH.md - AI SDK patterns, model routing, database schemas
- Phase 2 RESEARCH.md - Editor insertion patterns, modal UI patterns
- CLAUDE.md Section 5 (Module Plan) - Product requirements, UX flow, warning about editor content

### Secondary (MEDIUM confidence)
- [DreamHost Blog: Claude Prompt Techniques](https://www.dreamhost.com/blog/claude-prompt-engineering/) - Verified techniques for Claude 4.x
- [GitHub: Claude Prompt Engineering Guide](https://github.com/ThamJiaHe/claude-prompt-engineering-guide) - Official Anthropic best practices
- [Anthropic Platform Docs: Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) - Authoritative source
- [TipTap Docs: insertContent command](https://tiptap.dev/docs/editor/api/commands/content/insert-content) - Official API documentation
- [TipTap Docs: Heading extension](https://tiptap.dev/docs/editor/extensions/nodes/heading) - Heading configuration
- [Infozzle: AI Content Generation Tools 2026](https://www.infozzle.com/blog/ai-content-generation-tools-the-2026-guide-to-faster-higher-ranking-content/) - Outline generation workflow
- [Design in DC: Header Structure SEO 2026](https://designindc.com/blog/why-header-structure-still-matters-in-2026/) - H1/H2/H3 hierarchy standards
- [Frase SERP Analyzer](https://www.frase.io/serp-analyzer) - Competitor heading extraction patterns

### Tertiary (LOW confidence)
- Claude Sonnet 4.5 +18% planning performance: Reported by Cognition AI, but exact benchmark methodology not disclosed. Treat as directional signal, not absolute metric.
- Over-optimization threshold: CLAUDE.md states score > 100 is over-optimization, but no research found on exact threshold triggers in Google's algorithm. Conservative approach: warn at 95-100 range.
- Heading extraction from non-semantic HTML: Some research suggests `role="heading"` ARIA pattern, but prevalence in SERPs not quantified. Implement as fallback, not primary method.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing Phase 1 AI infrastructure, no new dependencies
- Architecture: HIGH - Patterns derived from Phase 2 (modal, insertion), verified with TipTap docs
- Prompt engineering: HIGH - Claude 4.x best practices from official docs + verified case studies
- SERP heading extraction: MEDIUM - Standard Cheerio patterns, but JS-rendered sites may need fallbacks
- Over-optimization warning: MEDIUM - Threshold from CLAUDE.md, but estimation algorithm is heuristic

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days - stable domain, Claude 4.x and TipTap APIs well-established)
