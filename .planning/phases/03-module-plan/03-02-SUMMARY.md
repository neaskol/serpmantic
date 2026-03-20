---
phase: 03-module-plan
plan: 02
subsystem: ui-plan-module
tags: [react, dialog, tiptap, base-nova, plan-ui, over-optimization]
requires:
  - phase: 03-01
    provides: plan-api, outline-builder, OutlineSection type
  - phase: 02-02
    provides: Dialog pattern, Accept/Reject flow
  - phase: 01-03
    provides: editor-store, guide-store
provides:
  - plan-panel-ui
  - outline-preview-dialog
  - over-optimization-warning
  - editor-insertion-headings
affects: []
tech-stack:
  added: []
  patterns: [base-nova-dialog, over-optimization-estimate, text-normalization]
key-files:
  created: []
  modified:
    - apps/web/src/components/analysis/plan-panel.tsx
decisions:
  - decision: Rough client-side over-optimization estimate (match count × 3)
    rationale: Provides directional warning without backend scoring API call
    impact: Fast UX feedback, labeled as approximate in warning dialog
  - decision: Text normalization via NFD (lowercase + remove accents)
    rationale: Match semantic terms like "délégation" and "delegation" correctly
    impact: More accurate term counting, better French language support
  - decision: Filter !is_to_avoid terms before over-optimization check
    rationale: Only scoring-positive terms affect score, avoids false positives
    impact: More accurate estimate, prevents spam term warnings
  - decision: Skip over-optimization check if semanticTerms empty
    rationale: No data to estimate from, prevents divide-by-zero errors
    impact: Graceful degradation, no warning when SERP data incomplete
  - decision: window.confirm() for over-optimization warning
    rationale: Native browser dialog blocks until user decides, no Dialog state
    impact: Simplest UX, clear proceed/cancel choice
duration: 5.8 min
completed: 2026-03-20
---

# Phase 03 Plan 02: Plan UI Integration Summary

**One-liner:** PlanPanel Dialog preview with H2/H3 badges, keyword display, over-optimization estimate (term match × 3 heuristic), and TipTap editor insertion.

## What Was Built

Rewrote the PlanPanel component to connect the backend API (from Plan 03-01) to a user-facing interface with preview Dialog, Accept/Reject flow, and over-optimization safety checks.

### Components Delivered

**1. Generate Button**
- Calls `POST /api/ai/plan` with `{ guideId }`
- Loading state: spinner animation + "Generation en cours..."
- Disabled when:
  - `generating === true`
  - `!guide` (no guide loaded)
  - `plainText.trim().length > 50` (editor has content)
  - `serpPages.length === 0` (no SERP analysis)

**2. Preview Dialog (base-nova)**
- Title: "Apercu du plan genere"
- Description: "Verifiez le plan puis acceptez pour l'inserer dans l'editeur ou rejetez pour le supprimer."
- Body: ScrollArea with outline sections
  - H2 sections: Badge (default variant) + `font-semibold` title
  - H3 sections: Badge (secondary variant) + `pl-4` indent
  - Keywords: Badge (outline variant), max 3 per section
- Footer: Two buttons
  - "Rejeter" (outline variant) → `handleReject()`
  - "Accepter & Inserer" (default variant) → `handleAccept()`
- On close (X or escape): calls `handleReject()`

**3. Over-optimization Check (handleAccept)**

Flow:
1. Filter `semanticTerms` for `!is_to_avoid` (scoring-positive terms only)
2. Skip check if `semanticTerms.length === 0` (no data to estimate)
3. Normalize all outline titles: `normalizeText(title)` (lowercase + remove accents via NFD)
4. Concatenate normalized titles into single string
5. For each scoring term: normalize `display_term`, check if in concatenated string, count matches (max 1 per term)
6. Estimate score: `currentScore + matchCount × 3` (rough heuristic: each heading match adds ~3 occurrences when written)
7. If `estimatedScore > 100`: show `window.confirm()` with French warning labeled as "estimation approximative"
8. If user cancels: return (don't insert)

**4. Editor Insertion**
- Convert `OutlineSection[]` to HTML:
  - H2: `<h2>title</h2>`
  - H3: `<h3>title</h3>`
  - Join with newline
- Insert: `editor.chain().focus().insertContent(html).run()`
- Close dialog: `setShowPreview(false)`, `setOutline(null)`
- Toast: `toast.success('Plan insere dans l\'editeur')`

**5. Warning Cards**
- **Editor has content** (amber): "Videz l'editeur avant de generer un nouveau plan."
- **No SERP data** (blue): "Lancez d'abord une analyse SERP pour generer un plan."
- **Error display** (red): Shows `error` state from API call

**6. Help Section**
- Collapsible with ChevronDown/ChevronUp
- Explains outline generation process
- 5-step numbered instructions

## Technical Implementation

### Text Normalization Function

```typescript
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
```

- Converts to lowercase
- NFD normalization separates accents from base characters
- Regex removes accent marks (U+0300 to U+036F)
- Example: "Délégation" → "delegation"

### Over-optimization Estimate Logic

**Why client-side?**
- Fast feedback: no backend round-trip
- Good enough: estimate labeled as approximate
- Low cost: no additional API call

**Heuristic rationale:**
- Each heading match implies ~3 occurrences when section is written out
- Example: "Qu'est-ce que la délégation CEE?" heading matches "delegation" term
- When user writes that section, "delegation" appears in heading + 2-3 times in body
- Multiplier of 3 is conservative estimate

**False positive prevention:**
- Filter `!is_to_avoid` terms: spam/navigation terms don't affect score
- Normalize both outline and terms: handles accents, capitalization
- Count each term max once: prevents double-counting variations

### Base-nova Dialog Pattern

**Key differences from Radix UI:**
- Trigger: `render={<Button />}` instead of `asChild`
- Open/close: `onOpenChange={(open) => { if (!open) handleReject() }}`
- Footer buttons: `render={<Button />}` pattern
- No need for DialogTrigger in preview flow (open controlled by `showPreview` state)

## Testing & Validation

**Must-Haves Verification:**
- ✅ Generate button calls POST /api/ai/plan and shows loading state
- ✅ Preview Dialog displays outline with H2/H3 badges and keywords
- ✅ Accept converts outline to HTML and inserts into TipTap editor
- ✅ Reject closes Dialog and clears state
- ✅ Over-optimization check filters out is_to_avoid terms before counting
- ✅ Over-optimization check normalizes text (lowercase + remove accents) before matching
- ✅ Over-optimization check handles empty semanticTerms (skips check)
- ✅ Warning dialog labels estimate as approximate
- ✅ Generate disabled when editor has content, no guide, or no SERP data

**Build Verification:**
- ✅ `npm run build` passes (Next.js 15.3.1, 24s compile)
- ✅ No TypeScript errors
- ✅ No ESLint errors (fixed `any` type to `Error` instanceof check)

## Commit History

**Commit 1: feat(03-02): implement PlanPanel UI with Dialog preview and over-optimization check (1ed7526)**
- Rewritten PlanPanel component (183 insertions, 86 deletions)
- Generate button with loading state
- Preview Dialog with H2/H3 badges and keywords
- Over-optimization estimate with term filtering and normalization
- Accept/Reject flow with editor insertion
- Warning cards for editor content and SERP data
- Help section with collapsible instructions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript ESLint error (no explicit any)**
- **Found during:** Task 1 - Build verification
- **Issue:** `catch (err: any)` violates @typescript-eslint/no-explicit-any
- **Fix:** Changed to `catch (err)` with `err instanceof Error` check
- **Files modified:** `apps/web/src/components/analysis/plan-panel.tsx`
- **Verification:** Build passes with no ESLint errors
- **Committed in:** 1ed7526 (amended before final commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for build to pass. No scope creep.

## Next Phase Readiness

**Plan Module Complete:**
- ✅ Backend API (POST /api/ai/plan) functional
- ✅ Frontend UI (PlanPanel) functional
- ✅ Dialog preview with Accept/Reject flow
- ✅ Over-optimization warning protects score
- ✅ Editor insertion creates proper H2/H3 nodes

**Dependencies for other modules:**
- **Intention Module** (Phase 04): Can use similar Dialog preview pattern
- **Meta Module** (Phase 04): Can use similar API call pattern
- **Context System** (Phase 05): Outline builder needs active_context_id integration

**Known Limitations:**
- No outline history: each generation overwrites previous
- No editing outline before insertion: must Accept or Reject
- Over-optimization estimate is approximate (±10 score points accuracy)
- No retry button if generation fails: user must click Generate again

**Blockers:** None

**Concerns:** None

## Integration Points

**Upstream Dependencies:**
- `03-01-plan-api`: POST /api/ai/plan endpoint
- `guide-store`: guide, score, serpPages, semanticTerms
- `editor-store`: editor instance, plainText
- `OutlineSection` type from database.ts

**Downstream Consumers:**
- None (Plan module complete)

**Data Flow:**
```
User clicks "Generer le plan optimal"
  → handleGenerate()
  → POST /api/ai/plan { guideId }
  → setOutline(data.outline), setShowPreview(true)
  → Dialog opens with H2/H3 sections + keywords
  → User clicks "Accepter & Inserer"
  → handleAccept()
  → Over-optimization check (filter !is_to_avoid, normalize, count matches, estimate)
  → window.confirm() if estimatedScore > 100
  → Convert outline to HTML (<h2>, <h3>)
  → editor.chain().insertContent(html)
  → Dialog closes, toast success
```

## Files Modified

**Modified:**
- `apps/web/src/components/analysis/plan-panel.tsx` (183 insertions, 86 deletions)

**Total:** 183 lines rewritten

## Performance Metrics

- **Execution time:** 5.8 minutes (start: 2026-03-20T04:57:40Z, end: 2026-03-20T05:03:26Z)
- **Task commits:** 1 (feat: PlanPanel UI)
- **Type errors fixed:** 1 (ESLint no-explicit-any)
- **Lines of code:** 183 added, 86 removed

## Learning & Improvements

**What worked well:**
- base-nova Dialog pattern from assistant-panel.tsx was perfect reference
- Text normalization (NFD) handles French accents cleanly
- Client-side over-optimization estimate is fast and good enough
- window.confirm() is simpler than custom Dialog for binary choice

**What could improve:**
- Add outline editing before insertion (drag-to-reorder, delete sections)
- Add retry button when generation fails (don't force re-click Generate)
- Add outline history (version control, undo/redo)
- Improve over-optimization estimate accuracy (backend scoring API call)

**Reusable patterns:**
- Text normalization: `text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')`
- Over-optimization heuristic: `matchCount × 3` for heading-to-body expansion
- Term filtering: `semanticTerms.filter((t) => !t.is_to_avoid)` before scoring
- base-nova Dialog: `onOpenChange={(open) => { if (!open) handleReject() }}`

---
*Phase: 03-module-plan*
*Completed: 2026-03-20*
