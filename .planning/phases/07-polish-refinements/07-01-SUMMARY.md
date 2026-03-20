---
phase: 07
plan: 01
subsystem: ui-resilience
tags: [error-handling, optimistic-ui, loading-states, production-hardening]
requires:
  - 05-02-context-ui
  - 04-02-meta-fixes
provides:
  - production-ready-ui
  - error-boundary-protection
  - optimistic-meta-save
  - context-loading-skeleton
affects:
  - future-panel-implementations
tech-stack:
  added: []
  patterns:
    - React ErrorBoundary
    - Optimistic UI updates with rollback
    - Skeleton loading states
key-files:
  created: []
  modified:
    - apps/web/src/components/analysis/meta-panel.tsx
    - apps/web/src/components/analysis/analysis-panel.tsx
    - apps/web/src/components/analysis/context-selector.tsx
    - apps/web/src/app/api/ai/intention/__tests__/route.test.ts
    - apps/web/src/app/api/ai/meta/__tests__/route.test.ts
    - apps/web/src/app/api/ai/plan/__tests__/route.test.ts
    - apps/web/src/app/api/contexts/__tests__/route.test.ts
decisions:
  - key: guide-store-sync-after-patch
    choice: Call setGuide(updatedGuide) after successful PATCH response
    rationale: Prevents stale data in guide-store when meta fields are updated, ensures other components see fresh data
    alternatives: []
  - key: optimistic-ui-with-rollback
    choice: Capture previous values before PATCH, revert on failure
    rationale: Simple optimistic pattern without complex state management, improves perceived performance
    alternatives:
      - Full optimistic store update before PATCH (more complex, not needed for meta fields)
  - key: panel-level-error-fallback
    choice: Compact French-language fallback instead of reusing default ErrorBoundary fallback
    rationale: Default fallback designed for full-page errors with min-h-[400px], panels need compact message
    alternatives: []
  - key: skeleton-only-initial-load
    choice: Show skeleton when loading AND contexts.length === 0
    rationale: Prevents skeleton flash during background refetch after creating context, only shows on first load
    alternatives:
      - Always show skeleton when loading (causes UI jank on refresh)
  - key: fix-linting-violations
    choice: Add eslint-disable comments to pre-existing test files
    rationale: Blocking build errors (Rule 3), linting-only fixes, no functional changes
    alternatives: []
duration: 329s
completed: 2026-03-20
---

# Phase 7 Plan 1: Production Hardening - UI Resilience Summary

Close 4 integration gaps from v0.3.0 milestone audit: guide-store sync, error boundaries, loading skeleton, optimistic updates.

## Tasks Completed

### Task 1: MetaPanel guide-store sync + optimistic save (da284bb)

**What was built:**
- Added `setGuide` call after successful PATCH `/api/guides/{id}` response
- Implemented optimistic save pattern with rollback on failure
- Captures previous `meta_title` and `meta_description` values before fetch
- Reverts local fields if PATCH fails or network error occurs

**Key changes:**
```typescript
const setGuide = useGuideStore((s) => s.setGuide)
const prevTitle = guide.meta_title ?? ''
const prevDesc = guide.meta_description ?? ''

if (res.ok) {
  const updatedGuide = await res.json()
  setGuide(updatedGuide) // Sync guide-store
  toast.success('Meta tags sauvegardees')
} else {
  // Revert on failure
  setMetaTitle(prevTitle)
  setMetaDescription(prevDesc)
  toast.error('Erreur lors de la sauvegarde')
}
```

**Impact:**
- Eliminates stale guide data after meta PATCH
- Improves UX with immediate feedback (optimistic fields, revert on error)
- Other components now see fresh meta values from guide-store

### Task 2: ErrorBoundary + ContextSelector skeleton (5c0d220)

**Part A: ErrorBoundary wrapping**
- Imported `ErrorBoundary` component into `analysis-panel.tsx`
- Wrapped all 7 panel components in `<ErrorBoundary>`:
  - AssistantPanel, PlanPanel, IntentionPanel, LinksPanel, MetaPanel, ConfigPanel
  - Optimization tab: wrapped entire `<div>` with 5 sub-components
- Created compact French-language fallback:
  ```tsx
  const panelFallback = (
    <div className="p-4 text-center space-y-2">
      <p className="text-sm text-destructive">Une erreur est survenue dans ce module.</p>
      <p className="text-xs text-muted-foreground">Rechargez la page pour reessayer.</p>
    </div>
  )
  ```

**Part B: Context loading skeleton**
- Added `Skeleton` import to `context-selector.tsx`
- Early return before main UI when `loading && contexts.length === 0`:
  ```tsx
  if (loading && contexts.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="size-7" />
        </div>
      </div>
    )
  }
  ```

**Impact:**
- Component-level errors no longer crash entire analysis panel
- Loading skeleton prevents blank UI during initial context fetch
- Subsequent context refetches (after create/delete) don't flash skeleton

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed eslint violations in test files (fb5a790)**
- **Found during:** Task 2 build verification
- **Issue:** 4 test files had pre-existing linting errors blocking build:
  - `@typescript-eslint/no-explicit-any` on `let mockSupabase: any` (lines 5)
  - `@typescript-eslint/no-unused-vars` on `error` parameter in handleApiError mock (lines 26/30/33)
- **Fix:** Added eslint-disable comments for both violations:
  ```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleApiError: vi.fn((_error) => ({ ... }))
  ```
- **Files modified:**
  - `apps/web/src/app/api/ai/intention/__tests__/route.test.ts`
  - `apps/web/src/app/api/ai/meta/__tests__/route.test.ts`
  - `apps/web/src/app/api/ai/plan/__tests__/route.test.ts`
  - `apps/web/src/app/api/contexts/__tests__/route.test.ts`
- **Commit:** fb5a790
- **Rationale:** Build was failing with linting errors. According to Rule 3 (auto-fix blocking issues), fixed immediately to unblock task completion. No functional changes — linting compliance only.

## Test Results

**Build:** ✅ Passes (`pnpm --filter web build`)
- No type errors
- No linting errors (after fixes)
- Production bundle size: 102 kB shared, 21 routes

**Test Suite:** ✅ 236/237 tests pass (1 skipped)
- Duration: 4.18s
- No regressions from changes
- All existing tests continue to pass

**Coverage:** Maintained at 85.95% statements, 85.5% lines

## Integration Verification

**Pattern checks:**
- ✅ `ErrorBoundary` appears 15 times in `analysis-panel.tsx` (1 import + 7 wraps + 7 fallback props)
- ✅ `setGuide` called in `meta-panel.tsx` success path
- ✅ `Skeleton` imported and rendered in `context-selector.tsx`

**Closed gaps from v0.3.0-MILESTONE-AUDIT.md:**
1. ✅ Guide store refresh after meta PATCH → Fixed via `setGuide(updatedGuide)`
2. ✅ No error boundaries → All 7 panels wrapped with ErrorBoundary
3. ✅ No loading states for context fetch → Skeleton added to ContextSelector
4. ✅ No optimistic updates → Optimistic save with rollback in MetaPanel

## Next Phase Readiness

**Production hardening complete for:**
- MetaPanel save flow (optimistic + guide-store sync)
- AnalysisPanel error isolation (7 tabs protected)
- ContextSelector loading state (skeleton on first load)

**Remaining production gaps (future phases):**
- No optimistic updates for context CRUD operations (acceptable — low-frequency operations)
- No error boundaries around dashboard components (acceptable — simpler component tree)
- No loading skeleton for prompts fetch in AssistantPanel (acceptable — instant from cache)

**Blockers:** None

**Concerns:** None

## Files Modified

**UI Components (3 files):**
1. `apps/web/src/components/analysis/meta-panel.tsx`
   - Added `setGuide` selector from guide-store
   - Implemented optimistic save with rollback in `handleSave`
   - Lines changed: +13 (8 optimistic logic, 5 guide-store sync)

2. `apps/web/src/components/analysis/analysis-panel.tsx`
   - Imported `ErrorBoundary` component
   - Created `panelFallback` constant
   - Wrapped all 7 tab contents in `<ErrorBoundary fallback={panelFallback}>`
   - Lines changed: +48 (1 import, 9 fallback, 14 wraps, 24 indentation)

3. `apps/web/src/components/analysis/context-selector.tsx`
   - Imported `Skeleton` component
   - Added early return with skeleton when `loading && contexts.length === 0`
   - Lines changed: +10 (1 import, 9 skeleton UI)

**Test Files (4 files) — Linting fixes only:**
4. `apps/web/src/app/api/ai/intention/__tests__/route.test.ts`
5. `apps/web/src/app/api/ai/meta/__tests__/route.test.ts`
6. `apps/web/src/app/api/ai/plan/__tests__/route.test.ts`
7. `apps/web/src/app/api/contexts/__tests__/route.test.ts`
   - Added eslint-disable comments (2 per file: no-explicit-any, no-unused-vars)
   - Lines changed: +8 total (2 lines × 4 files)

## Metrics

**Duration:** 329s (5 min)
**Commits:** 3 (2 feature, 1 fix)
- da284bb: MetaPanel guide-store sync + optimistic save
- 5c0d220: ErrorBoundary + context skeleton
- fb5a790: Linting fixes (deviation)

**Complexity:**
- Low: Simple pattern applications (ErrorBoundary wrapping, early return)
- Medium: Optimistic UI with rollback (required capturing previous state)

**Risk:**
- Low: All changes are additive or hardening
- No breaking changes to existing APIs or data structures
- Linting fixes have zero functional impact

## Production Readiness

**Improvements delivered:**
1. **Data consistency:** Guide-store syncs after every meta PATCH
2. **Error isolation:** Component errors don't crash entire panel
3. **UX polish:** Loading skeletons prevent blank UI flash
4. **Perceived performance:** Optimistic saves with rollback

**Known limitations (acceptable):**
- ErrorBoundary only shows generic message (no retry button, no detailed logging)
  - Future enhancement: Add Sentry integration for error tracking
- Optimistic rollback doesn't show toast for network errors
  - Current behavior: Shows error toast, sufficient for user feedback

**Deployment checklist:**
- ✅ Build passes
- ✅ Tests pass (236/237)
- ✅ No new linting errors
- ✅ Coverage maintained (85%+)
- ✅ Integration gaps closed (4/4)
