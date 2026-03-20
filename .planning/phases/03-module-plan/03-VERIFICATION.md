---
phase: 03-module-plan
verified: 2026-03-20T05:15:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 3: Module Plan Verification Report

**Phase Goal:** Users can generate AI-powered H2/H3 content outlines based on SERP competitor structure with one-click insertion into editor

**Verified:** 2026-03-20T05:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User clicks "Generate outline" button in Plan tab and receives structured H2/H3 outline | ✓ VERIFIED | PlanPanel renders button (line 187-203) with handleGenerate() calling POST /api/ai/plan (line 39-70). API returns { outline: OutlineSection[] } (line 282). |
| 2 | Generated outline reflects competitor H2/H3 patterns from SERP analysis | ✓ VERIFIED | buildOutlinePrompt() includes competitor_headings section (line 26-38) with H2/H3 from SERP pages. Prompt instructs Claude to "Prioritize topics that appear in multiple competitor headings" (line 69). |
| 3 | Outline enriched with semantic term distribution across sections | ✓ VERIFIED | API loads top 30 semantic terms (line 165-192) and passes to buildOutlinePrompt() (line 195). Prompt includes semantic_terms section (line 56-59) with instruction "aim for 2-4 terms per section". OutlineSection type includes keywords: string[] field (database.ts line 161-165). |
| 4 | User can preview generated outline before inserting into editor | ✓ VERIFIED | PlanPanel Dialog opens on API success (line 62, setShowPreview(true)). Dialog renders outline sections with H2/H3 badges, titles, and keyword badges (line 247-301). Accept/Reject buttons control insertion (line 292-298). |
| 5 | System warns if inserting outline would push semantic score above 100 (over-optimization risk) | ✓ VERIFIED | handleAccept() includes over-optimization check (line 72-112). Filters scoring terms (!is_to_avoid), normalizes outline text (NFD), counts matches, estimates score (matchCount × 3), shows window.confirm() if estimated > 100 (line 105-111) with French warning labeled "estimation approximative". |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `/api/ai/plan` route | POST endpoint accepting guideId, returning outline array | ✓ VERIFIED | 291 lines, substantive. Exists, no stubs, wired. Auth check → load guide → load SERP data → load terms → buildPrompt → generateText → parseResponse → validateHierarchy → return outline. Error handling: 401/404/400/500. Logs token usage to ai_requests table. |
| `outline-builder.ts` | Utility with buildPrompt, parseResponse, validateHierarchy | ✓ VERIFIED | 211 lines, substantive. Exists, no stubs, wired. Three exported functions: buildOutlinePrompt (XML-structured prompt with competitor_headings and semantic_terms sections), parseOutlineResponse (strips markdown fences, validates JSON structure), validateOutlineHierarchy (checks non-empty, first H2, no H3 before H2). |
| `plan-panel.tsx` | UI with generate button, preview dialog, editor insertion | ✓ VERIFIED | 304 lines, substantive. Exists, no stubs, wired. Generate button with loading state (line 187-203), Preview Dialog with ScrollArea (line 247-301), Accept button with over-optimization check + insertContent (line 72-133), Reject button (line 135-139). Warning cards for editor content and no SERP data. Help section with collapsible instructions. |
| Database migration 007 | headings JSONB column on serp_pages | ✓ VERIFIED | 9 lines, exists. ALTER TABLE serp_pages ADD COLUMN headings JSONB DEFAULT '[]'. Comment describes structure: [{"level": 2, "text": "...", "position": 0}]. ExtractedHeading type in database.ts matches (line 44-48). |
| TipTap editor integration | insertContent call for H2/H3 HTML | ✓ VERIFIED | Line 126: editor.chain().focus().insertContent(html).run(). HTML built from outline (line 115-123): <h2> for level='h2', <h3> for level='h3', joined with newline. Uses editor from editor-store (line 28). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| PlanPanel button | /api/ai/plan | fetch POST | ✓ WIRED | handleGenerate() calls fetch('/api/ai/plan', { method: 'POST', body: JSON.stringify({ guideId }) }) (line 49-53). Sets generating state, shows loading spinner (line 193-196). On success, setOutline(data.outline) and setShowPreview(true) (line 61-62). |
| /api/ai/plan | Claude Sonnet 4.5 | generateText | ✓ WIRED | Line 204-209: generateText({ model: getModel('anthropic/claude-sonnet-4-5-20250929'), system: '...SEO content strategist...', prompt: buildOutlinePrompt(...) }). Model ID logged to ai_requests (line 251). Usage tokens tracked (line 254-257). |
| Preview Dialog Accept | TipTap editor | insertContent | ✓ WIRED | handleAccept() converts OutlineSection[] to HTML string (line 115-123), then calls editor.chain().focus().insertContent(html).run() (line 126). Sets focus, inserts at cursor position. Closes dialog (line 129-130), shows success toast (line 132). |
| Over-optimization check | semantic terms | filter + normalize + estimate | ✓ WIRED | handleAccept() filters semanticTerms for !is_to_avoid (line 84). Normalizes outline titles via normalizeText (NFD lowercase + remove accents, line 88-90). Counts matches (line 94-98). Estimates score: score + matchCount × 3 (line 102). Shows window.confirm if > 100 (line 105-111). |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| PLAN-01: User can click "Generate outline" button in Plan tab | ✓ SATISFIED | None. Button renders (line 187-203), calls API, handles loading state. |
| PLAN-02: AI generates H2/H3 outline based on SERP analysis | ✓ SATISFIED | None. API uses Claude Sonnet 4.5 with SERP data (competitor headings + semantic terms). |
| PLAN-03: Outline enriched with competitor H2/H3 structure from SERP | ✓ SATISFIED | None. buildOutlinePrompt includes competitor_headings section with H2/H3 lists from serp_pages. |
| PLAN-04: User can preview generated outline before inserting | ✓ SATISFIED | None. Dialog shows outline with H2/H3 badges, titles, keywords (line 247-301). |
| PLAN-05: User can insert outline into editor with one click | ✓ SATISFIED | None. Accept button converts to HTML and calls insertContent (line 126). |
| PLAN-06: System warns if outline would cause over-optimization (score > 100) | ✓ SATISFIED | None. Over-optimization check estimates score, shows window.confirm if > 100 (line 105-111). |

### Anti-Patterns Found

No anti-patterns found. All files substantive with real implementations.

**Scanned files:**
- `/api/ai/plan/route.ts` - No TODO/FIXME/placeholder patterns
- `outline-builder.ts` - No TODO/FIXME/placeholder patterns
- `plan-panel.tsx` - No TODO/FIXME/placeholder patterns

**Build verification:**
- `npm run build` passes (Next.js 15.3.1)
- No TypeScript errors
- No ESLint errors

### Human Verification Required

None. All success criteria can be verified programmatically and have been verified in the codebase.

(If you want to manually test the feature in the browser, you would:)

1. **Test: Generate outline button**
   - Load a guide with SERP analysis
   - Click "Generer le plan optimal"
   - **Expected:** Loading spinner appears, then preview dialog opens with H2/H3 sections
   - **Why optional:** API call and Dialog rendering verified in code

2. **Test: Over-optimization warning**
   - Create outline that would push score > 100
   - Click Accept
   - **Expected:** window.confirm dialog appears with French warning about score
   - **Why optional:** Logic verified in code (line 105-111), but UX confirmation desirable

3. **Test: Editor insertion**
   - Accept an outline
   - **Expected:** H2/H3 headings appear in TipTap editor, properly formatted
   - **Why optional:** insertContent call verified, but visual confirmation desirable

---

## Verification Details

### Artifact Level-by-Level Verification

**1. `/api/ai/plan/route.ts`**
- **Level 1: Exists** ✓ (291 lines)
- **Level 2: Substantive** ✓ (291 lines, no stubs, exports POST function)
- **Level 3: Wired** ✓ (Called by PlanPanel fetch, calls getModel/generateText, inserts to ai_requests)

**2. `outline-builder.ts`**
- **Level 1: Exists** ✓ (211 lines)
- **Level 2: Substantive** ✓ (211 lines, no stubs, exports 3 functions)
- **Level 3: Wired** ✓ (Imported by /api/ai/plan route, used in prompt building and response parsing)

**3. `plan-panel.tsx`**
- **Level 1: Exists** ✓ (304 lines)
- **Level 2: Substantive** ✓ (304 lines, no stubs, exports PlanPanel component)
- **Level 3: Wired** ✓ (Imported by analysis-panel.tsx, rendered in "plan" TabsContent)

**4. Migration 007**
- **Level 1: Exists** ✓ (9 lines)
- **Level 2: Substantive** ✓ (9 lines, no stubs, valid SQL ALTER TABLE)
- **Level 3: Wired** ✓ (Applied to database, ExtractedHeading type in database.ts matches schema)

**5. TipTap editor integration**
- **Level 1: Exists** ✓ (insertContent call on line 126)
- **Level 2: Substantive** ✓ (Converts outline to HTML, no stubs)
- **Level 3: Wired** ✓ (Uses editor from editor-store, HTML properly formatted with <h2>/<h3>)

### Wiring Verification Details

**PlanPanel → /api/ai/plan**
```typescript
// plan-panel.tsx line 49-53
const res = await fetch('/api/ai/plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ guideId: guide.id }),
})
```
✓ WIRED: fetch call exists, sends guideId, handles response (line 60-62), shows error (line 63-66)

**/api/ai/plan → Claude Sonnet 4.5**
```typescript
// route.ts line 204-209
const result = await generateText({
  model: getModel('anthropic/claude-sonnet-4-5-20250929') as unknown as Parameters<typeof generateText>[0]['model'],
  system: 'You are an expert SEO content strategist...',
  prompt,
})
```
✓ WIRED: generateText call exists, uses Claude model, passes buildOutlinePrompt result, logs usage (line 251-279)

**Preview Dialog → TipTap editor**
```typescript
// plan-panel.tsx line 115-126
const html = outline
  .map((section) => {
    if (section.level === 'h2') {
      return `<h2>${section.title}</h2>`
    } else {
      return `<h3>${section.title}</h3>`
    }
  })
  .join('\n')

editor.chain().focus().insertContent(html).run()
```
✓ WIRED: Converts outline to HTML, calls insertContent, runs TipTap command chain

**Over-optimization check → semantic terms**
```typescript
// plan-panel.tsx line 84-102
const scoringTerms = semanticTerms.filter((t) => !t.is_to_avoid)

if (scoringTerms.length > 0) {
  const normalizedOutlineText = outline
    .map((section) => normalizeText(section.title))
    .join(' ')

  let matchCount = 0
  for (const term of scoringTerms) {
    const normalizedTerm = normalizeText(term.display_term || term.term)
    if (normalizedOutlineText.includes(normalizedTerm)) {
      matchCount++
    }
  }

  const estimatedScore = score + matchCount * 3

  if (estimatedScore > 100) {
    const confirmed = window.confirm(...)
    if (!confirmed) return
  }
}
```
✓ WIRED: Filters terms, normalizes text (NFD), counts matches, estimates score, shows warning

### Text Normalization Verification

**normalizeText function (line 19-21)**
```typescript
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
```

✓ VERIFIED: Correctly handles French accents
- "Délégation" → "delegation" (NFD normalization + accent removal)
- Case-insensitive matching (lowercase)
- Matches semantic terms from SERP analysis

### Semantic Term Enrichment Verification

**API route (line 165-192)**
```typescript
const { data: semanticTerms } = await supabase
  .from('semantic_terms')
  .select('display_term, importance, is_to_avoid')
  .eq('serp_analysis_id', serpAnalysis.id)

const topTerms = (semanticTerms || [])
  .filter((term) => !term.is_to_avoid)
  .sort((a, b) => b.importance - a.importance)
  .slice(0, 30)
  .map((term) => term.display_term)
```

**outline-builder.ts (line 56-59)**
```typescript
<semantic_terms>
Top semantic terms to distribute across sections (aim for 2-4 terms per section):
${topTerms.map((term, idx) => `${idx + 1}. ${term}`).join('\n')}
</semantic_terms>
```

**Prompt instruction (line 104)**
```typescript
- keywords: 2-4 semantic terms from the list above (array of strings)
```

✓ VERIFIED: Top 30 terms loaded, filtered for !is_to_avoid, sorted by importance, passed to prompt, Claude instructed to distribute 2-4 per section, keywords field validated in parseResponse (line 193-200)

### Competitor H2/H3 Structure Verification

**outline-builder.ts (line 20-44)**
```typescript
const competitorsWithHeadings = competitors.filter((c) => c.headings.length > 2)

if (competitorsWithHeadings.length > 0) {
  competitorSection = `<competitor_headings>
${competitorsWithHeadings
  .map(
    (c) =>
      `URL: ${c.url}
Title: ${c.title}
Headings:
${c.headings
  .map((h) => `${h.level === 2 ? 'H2' : 'H3'}: ${h.text}`)
  .join('\n')}`
  )
  .join('\n\n')}
</competitor_headings>`
} else {
  competitorSection = `<competitor_titles>
Note: Heading data not available for these pages. Use titles as context.
${competitors.map((c) => `${c.url}\nTitle: ${c.title}`).join('\n\n')}
</competitor_titles>`
}
```

✓ VERIFIED: Graceful degradation
- If headings available (length > 2): competitor_headings section with H2/H3 lists
- If headings unavailable: competitor_titles section with fallback
- Prompt guideline (line 69): "Prioritize topics that appear in multiple competitor headings"

### Database Schema Verification

**Migration 007**
```sql
ALTER TABLE public.serp_pages
ADD COLUMN headings JSONB DEFAULT '[]' NOT NULL;

COMMENT ON COLUMN public.serp_pages.headings IS
'Extracted H2/H3 headings from competitor pages. Structure: [{"level": 2, "text": "Heading text", "position": 0}]';
```

**database.ts (line 44-48)**
```typescript
export type ExtractedHeading = {
  level: 2 | 3
  text: string
  position: number
}
```

**database.ts (line 60-61)**
```typescript
export type SerpPage = {
  // ...
  headings: ExtractedHeading[]
}
```

✓ VERIFIED: Schema matches types, default '[]' for backward compatibility

### OutlineSection Type Verification

**database.ts (line 161-165)**
```typescript
export type OutlineSection = {
  level: 'h2' | 'h3'
  title: string
  keywords: string[]
}
```

**outline-builder.ts (line 203-207)**
```typescript
outline.push({
  level: level as 'h2' | 'h3',
  title,
  keywords: keywords as string[],
})
```

**plan-panel.tsx (line 115-122)**
```typescript
const html = outline
  .map((section) => {
    if (section.level === 'h2') {
      return `<h2>${section.title}</h2>`
    } else {
      return `<h3>${section.title}</h3>`
    }
  })
  .join('\n')
```

✓ VERIFIED: Type used consistently across API, builder, and UI

---

_Verified: 2026-03-20T05:15:00Z_
_Verifier: Claude (gsd-verifier)_
