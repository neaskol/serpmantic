# SERPmantics UX Audit Report

**Date:** 2026-03-21
**Methodology:** UI/UX Pro Max Skill (161 rules, 10 priority categories)
**Scope:** Full application audit - dashboard, editor, analysis panels, UI primitives
**Files Audited:** 40+ components across 6 directories

---

## Executive Summary

SERPmantics is a **desktop-first SaaS** with solid foundational UX for its target audience (SEO professionals on large screens). The app uses modern tooling (base-ui/react, Tailwind v4, TipTap, Zustand) with proper semantic color tokens and good error boundary architecture.

However, the audit reveals **42 UX issues** across accessibility, responsiveness, interaction feedback, and data safety. The most critical: **zero mobile support**, **touch targets below WCAG minimums**, **missing ARIA labels throughout**, and **no data loss prevention** for unsaved editor content.

### Severity Distribution

| Severity | Count | Examples |
|----------|-------|---------|
| **CRITICAL** | 7 | No mobile layout, missing ARIA labels, touch targets < 44px |
| **HIGH** | 12 | No IndexedDB backup, hardcoded colors, hidden buttons on hover |
| **MEDIUM** | 15 | No prefers-reduced-motion, spacing inconsistencies, weak empty states |
| **LOW** | 8 | Toast durations, skeleton shimmer quality, placeholder text |

---

## 1. Accessibility (Priority 1 - CRITICAL)

### 1.1 Missing ARIA Labels

**Rule violated:** `aria-labels` - aria-label for icon-only buttons

Almost every interactive element in the app lacks proper ARIA labeling:

| Component | Element | Issue |
|-----------|---------|-------|
| `analysis-panel.tsx` | 8 emoji tab triggers | No `aria-label` - screen reader announces raw emoji |
| `toolbar.tsx` | 18 icon-only buttons | No `aria-label` or `title` - Undo, Bold, Italic invisible to assistive tech |
| `guide-card.tsx` | Dropdown menu trigger | `<MoreHorizontal />` icon has no `aria-label="Guide options"` |
| `score-display.tsx` | Score value | Missing `aria-label="Score semantique: ${score} sur 120"` |
| `semantic-terms-list.tsx` | Search input | No `aria-label` on filter input |
| `meta-panel.tsx` | Copy buttons | 16x16px icon buttons without labels |
| `plan-panel.tsx` | Move up/down/delete buttons | `size="icon-xs"` buttons unlabeled |
| `writer-panel.tsx` | Regenerate buttons | Tooltip only, no `aria-label` |

**Impact:** Screen reader users cannot use the application effectively.

### 1.2 Missing aria-pressed on Toggle Buttons

**Rule violated:** `aria-labels`, `state-clarity`

Toolbar formatting buttons (Bold, Italic, Underline, Alignment) toggle state visually with `bg-muted` but lack `aria-pressed` attribute:

```tsx
// Current (toolbar.tsx)
<Button className={editor.isActive('bold') ? 'bg-muted' : ''}>

// Should be
<Button aria-pressed={editor.isActive('bold')} aria-label="Gras (Ctrl+B)">
```

Filter buttons in `semantic-terms-list.tsx` also toggle without `aria-pressed`.

### 1.3 Color-Only Information

**Rule violated:** `color-not-only` - Don't convey info by color alone

Several components rely on color as the sole indicator:

- **`intention-panel.tsx`**: Intent type badges use color-only differentiation
- **`score-display.tsx`**: Score range communicated purely by background color
- **`structural-metrics.tsx`**: Badge status (OK/missing/excess) distinguished by color variant only
- **Monitoring widgets**: Progress bars use green/yellow/red without text labels

### 1.4 No prefers-reduced-motion Support

**Rule violated:** `reduced-motion` - Respect prefers-reduced-motion

Zero components check for reduced motion preference. All `animate-spin` spinners, `transition-all` durations, and progress bar animations run unconditionally.

### 1.5 Heading Hierarchy

**Rule violated:** `heading-hierarchy` - Sequential h1-h6

The analysis panel tabs don't use proper heading levels. Content sections use `text-base font-semibold` styled divs instead of semantic `<h2>`/`<h3>` tags.

---

## 2. Touch & Interaction (Priority 2 - CRITICAL)

### 2.1 Touch Targets Below 44px Minimum

**Rule violated:** `touch-target-size` - Min 44x44pt

| Component | Element | Actual Size | Required |
|-----------|---------|-------------|----------|
| `toolbar.tsx` | All formatting buttons | 28x28px (`size="sm"`) | 44x44px |
| `toolbar.tsx` | Color picker swatches | 28x28px | 44x44px |
| `guide-card.tsx` | Dropdown trigger | 28x32px | 44x44px |
| `plan-panel.tsx` | Arrow/delete buttons | 24x24px (`size="icon-xs"`) | 44x44px |
| `meta-panel.tsx` | Copy buttons | 16x16px | 44x44px |
| `writer-panel.tsx` | Regenerate buttons | 24x24px (`size="icon-xs"`) | 44x44px |
| `context-selector.tsx` | Settings button | 28x28px | 44x44px |

**Impact:** Users with motor impairments and mobile/tablet users cannot reliably hit targets.

### 2.2 Hover-Only Interactions

**Rule violated:** `hover-vs-tap` - Don't rely on hover alone

Two critical patterns hide buttons behind hover:

1. **`assistant-panel.tsx` line ~280**: Execute (Play) button only visible on prompt card hover - completely unreachable via keyboard or touch
2. **`plan-panel.tsx` line ~345**: Outline action buttons (move/delete) hidden until row hover
3. **`guide-card.tsx`**: Dropdown menu trigger uses `opacity-0 group-hover:opacity-100`

### 2.3 `window.prompt()` for URLs

**Rule violated:** `standard-gestures`, `touch-friendly-input`

Image and link insertion uses browser's native `window.prompt()`:

```tsx
const url = window.prompt('URL de l\'image')
```

This is deprecated UX, especially poor on mobile. Should be replaced with a proper Dialog component with URL validation and preview.

### 2.4 No Tap/Press Feedback

**Rule violated:** `press-feedback` - Visual feedback on press

Button active state only uses `active:translate-y-px` (1px shift) - imperceptible on touch devices. No ripple, opacity change, or scale feedback.

---

## 3. Performance (Priority 3 - HIGH)

### 3.1 No Content Jumping Prevention

**Rule violated:** `content-jumping` - Reserve space for async content

When SERP analysis completes and data populates panels, content shifts occur:
- Score display appears (jumps from skeleton to actual)
- Semantic terms list populates (400px height shift)
- Structural metrics table fills in

Score display has a proper skeleton. Terms list and metrics could reserve more space.

### 3.2 Fixed Heights on Dynamic Content

**Rule violated:** `responsive-chart`, `content-priority`

- `semantic-terms-list.tsx`: `h-[400px]` ScrollArea is not responsive to viewport
- On small laptops (768px height), 400px takes over half the viewport
- Should use `max-h-[60vh]` instead

### 3.3 Debounce Implementation - Good

**Positive finding:** Editor uses 500ms debounce for score recalculation, auto-save uses 3000ms debounce. Both properly clean up on unmount.

---

## 4. Style & Visual Consistency (Priority 4 - HIGH)

### 4.1 Emojis Used as Structural Icons

**Rule violated:** `no-emoji-icons` - Use SVG icons, not emojis

The 8 analysis panel tabs use emojis as icons:

```tsx
<TabsTrigger value="assistant">🤖</TabsTrigger>
<TabsTrigger value="plan">📑</TabsTrigger>
<TabsTrigger value="intention">🎯</TabsTrigger>
// ... 5 more emoji tabs
```

Emojis are font-dependent, inconsistent across platforms/OS versions, and cannot be controlled via design tokens. Should use Lucide React icons.

### 4.2 Hardcoded Colors vs Semantic Tokens

**Rule violated:** `color-semantic` - Define semantic tokens, not raw hex

Three different color patterns coexist in the app:

```tsx
// Pattern 1: Hardcoded hex (guide-card.tsx, score-display.tsx)
if (score <= 30) return '#ef4444'

// Pattern 2: Tailwind classes (textrazor-usage.tsx)
return 'bg-green-500'

// Pattern 3: CSS variables (button.tsx, card.tsx)
bg-primary text-primary-foreground
```

Score colors won't adapt to dark mode. Monitoring widget colors bypass the design system.

### 4.3 Missing Semantic Color Tokens

**Rule violated:** `color-semantic`

`globals.css` defines `primary`, `secondary`, `destructive`, `muted`, `accent` but is missing:
- `--success` (green states)
- `--warning` (yellow states)
- `--info` (blue informational states)

### 4.4 Inconsistent Icon Usage

The toolbar uses Lucide icons consistently (good), but the analysis panel mixes emojis (tabs) with Lucide icons (within panels). This breaks visual cohesion.

---

## 5. Layout & Responsive (Priority 5 - HIGH)

### 5.1 No Mobile Layout - CRITICAL

**Rule violated:** `mobile-first` - Design mobile-first, then scale up

The editor page uses a horizontal `ResizablePanelGroup` with no breakpoint to stack vertically:

```tsx
<ResizablePanelGroup orientation="horizontal" className="flex-1">
  <ResizablePanel defaultSize={50} minSize={30} />
  <ResizablePanel defaultSize={50} minSize={25} />
</ResizablePanelGroup>
```

On a 375px iPhone: left panel = 112px, right panel = 93px. Both unusable.

**Missing:** Media query to switch to vertical stacking or tab-based navigation on mobile.

### 5.2 8-Column Tab Grid Overflow

**Rule violated:** `horizontal-scroll` - No horizontal scroll on mobile

```tsx
<TabsList className="grid grid-cols-8 mx-2 mt-2">
```

8 columns at any width below ~900px will produce cramped, illegible tabs. No responsive alternative exists.

### 5.3 Header Not Responsive

The editor header fits 6 elements in one `flex` row (breadcrumb, language badge, analyze button, score, score value, score badge) with no wrapping or mobile adaptation.

### 5.4 Dashboard Padding Excessive on Mobile

Dashboard uses `p-8` (32px each side = 64px total), leaving only ~245px content width on a 375px screen. Should be `p-4 sm:p-6 lg:p-8`.

### 5.5 Nested ScrollAreas

**Rule violated:** `scroll-behavior` - Avoid nested scroll regions

`analysis-panel.tsx` wraps each tab in a `ScrollArea`, but `semantic-terms-list.tsx` adds another `ScrollArea` with `h-[400px]` inside. This creates a confusing double-scroll experience.

---

## 6. Typography & Color (Priority 6 - MEDIUM)

### 6.1 Editor Font Size

**Rule violated:** `readable-font-size` - Minimum 16px body text on mobile

Editor uses `prose-sm` which reduces base font to ~14px. On mobile, this triggers iOS auto-zoom and reduces readability.

### 6.2 No Line Length Control

**Rule violated:** `line-length-control` - 60-75 chars per line

Editor uses `max-w-none`, allowing unlimited line length. On wide monitors, lines can exceed 150+ characters, reducing readability.

### 6.3 Score Display Contrast

`score-display.tsx` applies dynamic color with 20% opacity background:
```tsx
style={{ backgroundColor: color + '20', color }}
```
This may produce insufficient contrast ratios depending on the score level. Needs WCAG verification.

### 6.4 French Accent Inconsistency

Some UI strings have accents ("éditeur"), others don't ("depasser", "supprime"). This inconsistency affects perceived quality.

---

## 7. Animation (Priority 7 - MEDIUM)

### 7.1 No Reduced Motion Support (Repeated - Critical)

Already noted in Accessibility section. Affects all spinner animations, transition effects, and progress bars.

### 7.2 Reasonable Durations

**Positive finding:** Transitions use 300-500ms durations, which fall within the recommended 150-400ms range. No excessively slow animations found.

### 7.3 Missing Tab Switch Animation

No crossfade or slide transition when switching between the 8 analysis tabs. Content snaps instantly. A subtle 150ms fade would improve perceived quality.

---

## 8. Forms & Feedback (Priority 8 - MEDIUM)

### 8.1 No Confirmation Before Destructive Actions

**Rule violated:** `confirmation-dialogs` - Confirm before destructive actions

| Action | Current Behavior | Expected |
|--------|-----------------|----------|
| Delete plan section | Immediate deletion | Confirmation dialog |
| Delete context | Immediate deletion | Confirmation dialog |
| Clear plan outline | Immediate clear | "Etes-vous sur?" prompt |
| Replace editor content (plan insert) | Warning shown (good) | - |
| Delete guide | AlertDialog (good) | - |

### 8.2 Missing Input Labels

**Rule violated:** `input-labels` - Visible label per input

`create-guide-dialog.tsx` has text labels but missing `htmlFor`/`id` bindings:
```tsx
<label className="text-sm font-medium">Mot-cle cible</label>  // No htmlFor
<Input value={keyword} />  // No id
```

### 8.3 No Inline Validation

**Rule violated:** `inline-validation`

URL inputs in `links-panel.tsx` and `config-panel.tsx` accept any text with no URL validation. No visual error state on invalid input.

### 8.4 Silent Error in Links Panel

**Rule violated:** `error-recovery` - Error messages must include recovery path

```tsx
// links-panel.tsx
} catch {
  // error handled silently - NO user feedback
}
```

User clicks "Analyze" and nothing happens if API fails.

### 8.5 Raw Error Display in Plan Panel

**Rule violated:** `error-clarity`

Plan panel shows raw JSON error with `<pre>` tag instead of user-friendly message.

### 8.6 No Auto-Save Indicator

**Rule violated:** `form-autosave` - Auto-save with visible feedback

Editor auto-saves with 3-second debounce but shows only a brief 2-second toast. No persistent "Saving..." / "Saved" indicator (like Google Docs).

### 8.7 Missing Undo for Destructive Operations

**Rule violated:** `undo-support` - Allow undo for destructive actions

No "Undo" option after:
- Section regeneration in writer panel
- Plan outline modifications
- Context deletion

---

## 9. Navigation (Priority 9 - HIGH)

### 9.1 No Mobile Navigation

**Rule violated:** `adaptive-navigation`

No hamburger menu, bottom navigation, or collapsible sidebar for mobile screens. The only navigation is a breadcrumb link.

### 9.2 Scroll Position Not Preserved on Tab Switch

**Rule violated:** `state-preservation`

When switching between analysis tabs, `ScrollArea` may retain stale scroll position, making content appear empty if scrolled past the new tab's content height. Missing auto-scroll-to-top on tab change.

### 9.3 No Back Button

**Rule violated:** `back-behavior` - Predictable back navigation

Only navigation back to dashboard is via breadcrumb link. No prominent back button or mobile-friendly back gesture support.

### 9.4 Breadcrumb Properly Implemented (Positive)

Good: `<nav aria-label="breadcrumb">` with proper `<ol>` structure, `aria-hidden` separators, and `aria-current="page"`.

---

## 10. Charts & Data (Priority 10 - LOW)

### 10.1 Score Gauge Not Screen Reader Accessible

**Rule violated:** `screen-reader-summary`

Score display shows a visual gauge but no `aria-label` describing the insight: "Your content scores 93/120, better than 75% of top-ranking pages."

### 10.2 Structural Metrics Table Uses Divs

**Rule violated:** `data-table` - Provide table alternative for accessibility

`structural-metrics.tsx` renders table-like data using `<div>` elements instead of semantic `<table>`, `<thead>`, `<th>`, `<td>` tags.

### 10.3 SERP Benchmark Table Headers Not Sortable

**Rule violated:** `sortable-table`

Table headers lack `<button>` elements and `aria-sort` attributes for keyboard-accessible sorting.

---

## Priority Action Plan

### Phase 1: Critical Fixes (Week 1)

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 1 | Add `aria-label` to ALL icon-only buttons and emoji tabs | `toolbar.tsx`, `analysis-panel.tsx`, `guide-card.tsx`, `plan-panel.tsx`, `writer-panel.tsx`, `meta-panel.tsx` | Screen reader users can navigate |
| 2 | Replace emojis with Lucide icons in analysis tabs | `analysis-panel.tsx` | Cross-platform consistency |
| 3 | Increase touch targets to 44px minimum | `toolbar.tsx`, `plan-panel.tsx`, `meta-panel.tsx`, `writer-panel.tsx` | Motor accessibility |
| 4 | Make hover-only buttons always visible | `assistant-panel.tsx`, `plan-panel.tsx`, `guide-card.tsx` | Touch/keyboard users can interact |
| 5 | Add `aria-pressed` to toggle buttons | `toolbar.tsx`, `semantic-terms-list.tsx` | State announced to screen readers |
| 6 | Replace `window.prompt()` with Dialog | `toolbar.tsx` (image/link insertion) | Proper input UX |
| 7 | Add IndexedDB draft backup for editor content | `editor-store.ts`, `page.tsx` | Prevents data loss on crash/close |

### Phase 2: High Priority (Week 2-3)

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 8 | Add responsive split-pane (vertical on mobile) | `guide/[id]/page.tsx` | App usable on tablets |
| 9 | Replace `grid-cols-8` tabs with scrollable/dropdown on mobile | `analysis-panel.tsx` | Tabs accessible on small screens |
| 10 | Replace hardcoded hex colors with CSS variables | `guide-card.tsx`, `score-display.tsx`, `textrazor-usage.tsx`, `serpapi-usage.tsx` | Dark mode support |
| 11 | Add `--success`, `--warning`, `--info` semantic tokens | `globals.css` | Consistent color system |
| 12 | Add `prefers-reduced-motion` media query | All animated components | Accessibility compliance |
| 13 | Fix silent error in links-panel | `links-panel.tsx` | Users see error feedback |
| 14 | Add confirmation dialogs for destructive actions | `plan-panel.tsx`, `context-dialog.tsx` | Prevent accidental deletion |
| 15 | Add responsive padding to dashboard | `dashboard/page.tsx` | Proper spacing on mobile |

### Phase 3: Medium Priority (Week 4-5)

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 16 | Add persistent "Saving/Saved" indicator | `guide/[id]/page.tsx` | Users know save status |
| 17 | Fix form label `htmlFor`/`id` bindings | `create-guide-dialog.tsx`, `context-dialog.tsx` | Accessibility |
| 18 | Add URL validation to link/config inputs | `links-panel.tsx`, `config-panel.tsx` | Input quality |
| 19 | Replace raw error JSON with user-friendly messages | `plan-panel.tsx` | Error clarity |
| 20 | Add auto-scroll-to-top on tab switch | `analysis-panel.tsx` | Content always visible |
| 21 | Remove nested ScrollAreas | `analysis-panel.tsx`, `semantic-terms-list.tsx` | Single scroll context |
| 22 | Add `color-not-only` indicators (icons alongside colors) | `intention-panel.tsx`, `structural-metrics.tsx`, `score-display.tsx` | Colorblind accessibility |
| 23 | Increase editor font from `prose-sm` to `prose` | `tiptap-editor.tsx` | Readability |
| 24 | Add `max-w-prose` to editor content | `tiptap-editor.tsx` | Line length control |
| 25 | Standardize spacing across analysis panels | All panel components | Visual consistency |

### Phase 4: Polish (Week 6+)

| # | Fix | Impact |
|---|-----|--------|
| 26 | Add crossfade transition on tab switch | Perceived quality |
| 27 | Improve button press feedback (scale/opacity) | Touch responsiveness |
| 28 | Add undo toasts for destructive operations | Data safety |
| 29 | Configure toast durations by type (success 3s, error 8s) | UX consistency |
| 30 | Add semantic `<table>` to structural metrics | Screen reader support |
| 31 | Add `aria-sort` to SERP benchmark headers | Keyboard table sorting |
| 32 | Fix French accent inconsistencies in strings | Perceived quality |
| 33 | Add keyboard shortcut hints to toolbar buttons | Discoverability |
| 34 | Add empty states for assistant panel (no prompts) | Guidance |
| 35 | Add loading skeleton to intention panel during analysis | Perceived performance |

---

## Scorecard by UX Pro Max Category

| Category | Score | Status | Key Issue |
|----------|-------|--------|-----------|
| **Accessibility** | 3/10 | FAILING | Missing ARIA labels, no reduced motion, color-only indicators |
| **Touch & Interaction** | 4/10 | FAILING | Touch targets < 44px, hover-only buttons, window.prompt() |
| **Performance** | 7/10 | PASSING | Good debounce patterns; minor CLS issues |
| **Style Selection** | 5/10 | NEEDS WORK | Emoji icons, hardcoded colors, missing semantic tokens |
| **Layout & Responsive** | 3/10 | FAILING | No mobile layout, 8-col grid overflow, nested scrolls |
| **Typography & Color** | 5/10 | NEEDS WORK | Small font, no max-width, contrast concerns |
| **Animation** | 5/10 | NEEDS WORK | No reduced motion; durations acceptable |
| **Forms & Feedback** | 4/10 | FAILING | Silent errors, no validation, missing labels, no auto-save indicator |
| **Navigation** | 5/10 | NEEDS WORK | Good breadcrumb; no mobile nav, no scroll preservation |
| **Charts & Data** | 5/10 | NEEDS WORK | Div-based tables, no aria-sort |

**Overall UX Score: 4.6 / 10** - Functional on desktop but significant accessibility and responsive debt.

---

## What's Working Well

- Error boundaries isolate panel failures (editor crash doesn't break analysis)
- Breadcrumb navigation with proper ARIA markup
- Auto-save with debounce (3-second delay is reasonable)
- SERP analysis progress dialog with step indicators and retry
- Skeleton loading states for score display and semantic terms
- OKLCH color system in CSS variables (modern, perceptually uniform)
- Writer panel streaming preview during AI generation
- Content restoration guard prevents double-loading on mount
- Base-ui/react provides keyboard support for dialogs and selects
- Separate error boundaries for editor and analysis panels

---

*Generated by UI/UX Pro Max Skill audit - 161 rules across 10 priority categories*
