# AI Article Writer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Redaction IA" tab to the analysis panel that generates full articles from an existing plan using a user-selected AI model (Anthropic, OpenAI, Google Gemini), with section-by-section regeneration and iterative optimization toward a target semantic score of 75-85.

**Architecture:** New writer-panel component in the analysis tab bar, backed by a `/api/ai/write` streaming endpoint. Google Gemini support added via `@ai-sdk/google`. The writer reads the existing plan (H2/H3 headings) from the editor, sends them with semantic terms to the chosen LLM, and streams the result back into the editor. Section regeneration and full-article optimization are separate API modes.

**Tech Stack:** Next.js Route Handlers, Vercel AI SDK v6 (`streamText`), `@ai-sdk/google`, TipTap editor API, base-nova Select component, Zustand guide-store/editor-store.

---

## Task 1: Add Google Gemini SDK

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/lib/ai/registry.ts`
- Modify: `apps/web/src/lib/ai/executor.ts` (pricing table)

**Step 1: Install `@ai-sdk/google`**

Run: `cd apps/web && pnpm add @ai-sdk/google`

**Step 2: Add Google to the provider registry**

In `apps/web/src/lib/ai/registry.ts`, add the Google import and registry entry:

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'

export const registry = {
  anthropic,
  openai,
  google,
} as const
```

**Step 3: Add Gemini pricing to executor**

In `apps/web/src/lib/ai/executor.ts`, add to the `PRICING` object:

```typescript
'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
```

**Step 4: Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local`**

The `@ai-sdk/google` SDK reads from `GOOGLE_GENERATIVE_AI_API_KEY` env var by default.

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/lib/ai/registry.ts apps/web/src/lib/ai/executor.ts
git commit -m "feat: add Google Gemini provider to AI registry"
```

---

## Task 2: Add writer task types to router

**Files:**
- Modify: `apps/web/src/lib/ai/router.ts`

**Step 1: Add new task types**

Add `article_writing` and `article_optimization` to the `TaskType` union and `MODEL_MAP`:

```typescript
export type TaskType =
  | 'plan_generation'
  | 'introduction'
  | 'intent_analysis'
  | 'content_editing'
  | 'grammar_check'
  | 'semantic_optimization'
  | 'meta_generation'
  | 'media_suggestions'
  | 'article_writing'
  | 'article_optimization'

export const MODEL_MAP: Record<TaskType, string> = {
  // ... existing entries ...
  article_writing: 'anthropic/claude-sonnet-4-5-20250929',
  article_optimization: 'openai/gpt-4o',
}
```

**Step 2: Update `getProviderForTask` return type**

Change the return type to include `'google'`:

```typescript
export function getProviderForTask(taskType: TaskType): 'anthropic' | 'openai' | 'google' {
  const modelId = MODEL_MAP[taskType]
  const provider = modelId.split('/')[0] as 'anthropic' | 'openai' | 'google'
  return provider
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/ai/router.ts
git commit -m "feat: add article_writing and article_optimization task types"
```

---

## Task 3: Create the `/api/ai/write` endpoint

**Files:**
- Create: `apps/web/src/app/api/ai/write/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { executePrompt, estimateCost } from '@/lib/ai/executor'
import { buildPromptContext } from '@/lib/ai/context-builder'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import type { SerpAnalysis, SemanticTerm } from '@/types/database'

export const maxDuration = 60

const WriteRequestSchema = z.object({
  guideId: z.string().uuid(),
  modelId: z.string().min(1),
  mode: z.enum(['full', 'section', 'optimize']),
  sectionIndex: z.number().int().min(0).optional(),
  sectionHeading: z.string().optional(),
  sectionContent: z.string().optional(),
  currentContent: z.string().optional(),
})

/**
 * Build the system prompt for article writing
 */
function buildWriterSystemPrompt(
  keyword: string,
  language: string,
  termsToAvoid: string[],
): string {
  const langMap: Record<string, string> = {
    fr: 'French', en: 'English', de: 'German', it: 'Italian', es: 'Spanish',
  }
  const langName = langMap[language] || language

  const parts = [
    `You are an expert SEO content writer. Write high-quality, natural-sounding content in ${langName}.`,
    `\nTarget keyword: "${keyword}"`,
    `\nIMPORTANT RULES:`,
    `- Write in HTML format (use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags)`,
    `- Keep the existing H2/H3 headings exactly as provided`,
    `- Write substantial paragraphs (3-5 sentences each) under each heading`,
    `- Integrate the semantic terms naturally — do NOT force them or stuff keywords`,
    `- The content must read as if written by a human expert, not generated by AI`,
    `- Aim for the middle of each term's occurrence range, not the maximum`,
    `- Do NOT add a main H1 title — only write the body content under the provided headings`,
  ]

  if (termsToAvoid.length > 0) {
    parts.push(`\nTerms to AVOID (do not use these):\n${termsToAvoid.map(t => `- ${t}`).join('\n')}`)
  }

  return parts.join('')
}

/**
 * Build the user prompt for full article generation
 */
function buildFullArticlePrompt(
  outline: Array<{ level: string; title: string }>,
  semanticTerms: Array<{ term: string; min: number; max: number }>,
  benchmarks: Record<string, { min: number; max: number }>,
): string {
  const outlineText = outline
    .map(s => `${s.level === 'h2' ? '##' : '###'} ${s.title}`)
    .join('\n')

  const termsText = semanticTerms
    .slice(0, 40)
    .map(t => `- "${t.term}" (aim for ${t.min}-${t.max} occurrences)`)
    .join('\n')

  const wordRange = benchmarks.words
    ? `Target word count: ${benchmarks.words.min}-${benchmarks.words.max} words.`
    : 'Target word count: 1500-2500 words.'

  return [
    `Write a complete article following this outline:\n\n${outlineText}`,
    `\n\n${wordRange}`,
    `\nSemantic terms to integrate naturally:\n${termsText}`,
    `\n\nOutput the full article as HTML. Keep every H2/H3 heading exactly as shown above.`,
    `Write rich, informative content under each heading. Use paragraphs, lists, and bold for emphasis where appropriate.`,
  ].join('')
}

/**
 * Build the user prompt for section regeneration
 */
function buildSectionPrompt(
  sectionHeading: string,
  sectionContent: string,
  missingTerms: Array<{ term: string; min: number; max: number }>,
  excessTerms: Array<{ term: string; count: number; max: number }>,
): string {
  const parts = [
    `Rewrite this section to improve its semantic coverage while keeping it natural and informative.`,
    `\nSection heading: ${sectionHeading}`,
    `\nCurrent content:\n${sectionContent}`,
  ]

  if (missingTerms.length > 0) {
    parts.push(`\nTerms to integrate naturally:\n${missingTerms.map(t => `- "${t.term}" (need ${t.min}-${t.max} occurrences)`).join('\n')}`)
  }

  if (excessTerms.length > 0) {
    parts.push(`\nTerms to reduce:\n${excessTerms.map(t => `- "${t.term}" (currently ${t.count}, max ${t.max})`).join('\n')}`)
  }

  parts.push(`\n\nOutput only the rewritten section content as HTML (including the heading tag). Do NOT include content from other sections.`)

  return parts.join('')
}

/**
 * Build the user prompt for full article optimization
 */
function buildOptimizePrompt(
  currentContent: string,
  currentScore: number,
  missingTerms: Array<{ term: string; needed: number }>,
  excessTerms: Array<{ term: string; excess: number }>,
): string {
  const parts = [
    `Optimize this article to improve its semantic score from ${currentScore} toward 75-85.`,
    `\nCurrent article:\n${currentContent}`,
  ]

  if (missingTerms.length > 0) {
    parts.push(`\nTerms to ADD (integrate naturally, don't keyword-stuff):\n${missingTerms.slice(0, 20).map(t => `- "${t.term}" (add ~${t.needed} more)`).join('\n')}`)
  }

  if (excessTerms.length > 0) {
    parts.push(`\nTerms to REDUCE:\n${excessTerms.map(t => `- "${t.term}" (remove ~${t.excess})`).join('\n')}`)
  }

  parts.push(`\n\nOutput the full optimized article as HTML. Keep the same structure (headings). Only modify passages where needed — preserve what already works.`)

  return parts.join('')
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const { guideId, modelId, mode, sectionIndex, sectionHeading, sectionContent, currentContent } = WriteRequestSchema.parse(body)

    logger.info('AI write request', { userId: user.id, guideId, modelId, mode })

    // Load guide
    const { data: guide, error: guideError } = await supabase
      .from('guides')
      .select('keyword, language, content, active_context_id, prompt_context')
      .eq('id', guideId)
      .single()

    if (guideError || !guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    // Load SERP analysis
    const { data: serpAnalysis } = await supabase
      .from('serp_analyses')
      .select('*')
      .eq('guide_id', guideId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single<SerpAnalysis>()

    if (!serpAnalysis) {
      return NextResponse.json({ error: 'No SERP analysis found. Run analysis first.' }, { status: 400 })
    }

    // Load semantic terms
    const { data: semanticTerms } = await supabase
      .from('semantic_terms')
      .select('*')
      .eq('serp_analysis_id', serpAnalysis.id)
      .returns<SemanticTerm[]>()

    const allTerms = semanticTerms || []
    const scorableTerms = allTerms.filter(t => !t.is_to_avoid)
    const termsToAvoid = allTerms.filter(t => t.is_to_avoid).map(t => t.display_term)

    // Build system prompt
    const systemPrompt = buildWriterSystemPrompt(guide.keyword, guide.language, termsToAvoid)

    // Build user prompt based on mode
    let userPrompt: string
    const benchmarks = serpAnalysis.structural_benchmarks || {}

    if (mode === 'full') {
      // Extract outline from the currentContent or guide.content
      const contentToParse = currentContent || (guide.content ? JSON.stringify(guide.content) : '')
      // Parse headings from HTML-ish content
      const headingRegex = /<(h[2-3])[^>]*>(.*?)<\/\1>/gi
      const outline: Array<{ level: string; title: string }> = []
      let match
      while ((match = headingRegex.exec(contentToParse)) !== null) {
        outline.push({ level: match[1], title: match[2].replace(/<[^>]*>/g, '') })
      }

      if (outline.length === 0) {
        return NextResponse.json({ error: 'No H2/H3 headings found. Generate a plan first.' }, { status: 400 })
      }

      const topTerms = scorableTerms
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 40)
        .map(t => ({ term: t.display_term, min: t.min_occurrences, max: t.max_occurrences }))

      userPrompt = buildFullArticlePrompt(outline, topTerms, benchmarks)

    } else if (mode === 'section') {
      if (!sectionHeading || sectionContent === undefined) {
        return NextResponse.json({ error: 'sectionHeading and sectionContent required for section mode' }, { status: 400 })
      }

      const missingTerms = scorableTerms
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 15)
        .map(t => ({ term: t.display_term, min: t.min_occurrences, max: t.max_occurrences }))

      userPrompt = buildSectionPrompt(sectionHeading, sectionContent, missingTerms, [])

    } else {
      // optimize mode
      if (!currentContent) {
        return NextResponse.json({ error: 'currentContent required for optimize mode' }, { status: 400 })
      }

      // We don't have the live score server-side, so instruct the LLM with term data
      const missingTerms = scorableTerms
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 20)
        .map(t => ({ term: t.display_term, needed: t.min_occurrences }))

      userPrompt = buildOptimizePrompt(currentContent, 0, missingTerms, [])
    }

    // Execute with streaming
    const result = await executePrompt({
      modelId,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 8192,
      onFinish: async ({ usage, finishReason }) => {
        const cost = estimateCost(modelId, usage)

        await supabase.from('ai_requests').insert({
          user_id: user.id,
          guide_id: guideId,
          prompt_id: null,
          model_id: modelId,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          estimated_cost: cost,
          finish_reason: finishReason,
        }).then(({ error }) => {
          if (error) logger.error('Failed to log AI write request', { error: error.message })
        })
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    return handleApiError(error, { route: '/api/ai/write', context: { requestId } })
  } finally {
    logger.clearRequestId()
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

**Step 3: Commit**

```bash
git add apps/web/src/app/api/ai/write/route.ts
git commit -m "feat: add /api/ai/write endpoint for article generation"
```

---

## Task 4: Create the WriterPanel component

**Files:**
- Create: `apps/web/src/components/analysis/writer-panel.tsx`

**Step 1: Create the component**

This is the largest file. It has 3 states (no plan, ready to write, post-generation) and handles model selection, streaming, and section regeneration.

```typescript
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PenLine,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

/** Available AI models grouped by provider */
const AI_MODELS = [
  {
    provider: 'Anthropic',
    models: [
      { id: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
      { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    ],
  },
  {
    provider: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    ],
  },
  {
    provider: 'Google',
    models: [
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
  },
]

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5-20250929'
const TARGET_SCORE_MIN = 75
const TARGET_SCORE_MAX = 85

interface DetectedSection {
  level: 'h2' | 'h3'
  title: string
  /** Node position range in editor for replacement */
  from: number
  to: number
}

/**
 * Extract H2/H3 sections from TipTap editor content
 */
function detectSections(editor: any): DetectedSection[] {
  if (!editor) return []

  const sections: DetectedSection[] = []
  const doc = editor.state.doc

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading' && (node.attrs.level === 2 || node.attrs.level === 3)) {
      sections.push({
        level: node.attrs.level === 2 ? 'h2' : 'h3',
        title: node.textContent,
        from: pos,
        to: pos + node.nodeSize,
      })
    }
  })

  return sections
}

/**
 * Get the content of a section (from heading to next heading of same or higher level)
 */
function getSectionContent(editor: any, sectionIndex: number, sections: DetectedSection[]): string {
  if (!editor || sectionIndex >= sections.length) return ''

  const section = sections[sectionIndex]
  const nextSection = sections.find(
    (s, i) => i > sectionIndex && (s.level === 'h2' || (section.level === 'h3' && s.level === 'h3'))
  )

  const from = section.from
  const to = nextSection ? nextSection.from : editor.state.doc.content.size

  // Get HTML from the range
  const slice = editor.state.doc.slice(from, to)
  const tempDiv = document.createElement('div')
  const fragment = editor.view.dom.ownerDocument.createDocumentFragment()

  // Use editor's HTML serialization
  const { DOMSerializer } = require('@tiptap/pm/model')
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const dom = serializer.serializeFragment(slice.content)
  tempDiv.appendChild(dom)

  return tempDiv.innerHTML
}

export function WriterPanel() {
  const guide = useGuideStore((s) => s.guide)
  const score = useGuideStore((s) => s.score)
  const scoreLabel = useGuideStore((s) => s.scoreLabel)
  const scoreColor = useGuideStore((s) => s.scoreColor)
  const serpPages = useGuideStore((s) => s.serpPages)
  const semanticTerms = useGuideStore((s) => s.semanticTerms)
  const termStatuses = useGuideStore((s) => s.termStatuses)
  const setActiveTab = useGuideStore((s) => s.setActiveTab)
  const editor = useEditorStore((s) => s.editor)
  const plainText = useEditorStore((s) => s.plainText)

  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [isWriting, setIsWriting] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [regeneratingSection, setRegeneratingSection] = useState<number | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingContent, setPendingContent] = useState('')
  const [pendingMode, setPendingMode] = useState<'full' | 'optimize'>('full')
  const abortRef = useRef<AbortController | null>(null)

  // Detect sections from editor
  const sections = editor ? detectSections(editor) : []
  const h2Sections = sections.filter(s => s.level === 'h2')
  const hasPlan = h2Sections.length >= 2

  // Term stats
  const missingCount = termStatuses.filter(t => t.status === 'missing').length
  const okCount = termStatuses.filter(t => t.status === 'ok').length
  const excessCount = termStatuses.filter(t => t.status === 'excess').length
  const isScoreInTarget = score >= TARGET_SCORE_MIN && score <= TARGET_SCORE_MAX

  /**
   * Stream response from the write API
   */
  async function streamWrite(
    mode: 'full' | 'section' | 'optimize',
    extra?: { sectionIndex?: number; sectionHeading?: string; sectionContent?: string }
  ): Promise<string> {
    if (!guide) throw new Error('No guide')

    const controller = new AbortController()
    abortRef.current = controller

    // Get current content as HTML for the API
    const currentHtml = editor ? editor.getHTML() : ''

    const res = await fetch('/api/ai/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guideId: guide.id,
        modelId: selectedModel,
        mode,
        currentContent: currentHtml,
        ...extra,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    // Read streaming response
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      fullText += chunk
      setStreamedText(fullText)
    }

    abortRef.current = null
    return fullText
  }

  /**
   * Handle full article generation
   */
  async function handleWrite() {
    if (!editor || !guide) return

    setIsWriting(true)
    setStreamedText('')

    try {
      const result = await streamWrite('full')
      // Show confirmation dialog before inserting
      setPendingContent(result)
      setPendingMode('full')
      setShowConfirmDialog(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Generation annulee')
      } else {
        toast.error(err instanceof Error ? err.message : 'Erreur lors de la generation')
      }
    } finally {
      setIsWriting(false)
    }
  }

  /**
   * Handle section regeneration
   */
  async function handleRegenerateSection(index: number) {
    if (!editor || !guide) return

    const section = sections[index]
    if (!section) return

    setRegeneratingSection(index)
    setStreamedText('')

    try {
      const sectionHtml = getSectionContent(editor, index, sections)
      const result = await streamWrite('section', {
        sectionIndex: index,
        sectionHeading: section.title,
        sectionContent: sectionHtml,
      })

      // Find the range for this section (from this heading to next H2)
      const from = section.from
      const nextH2 = sections.find((s, i) => i > index && s.level === 'h2')
      const to = nextH2 ? nextH2.from : editor.state.doc.content.size

      // Replace section content in editor
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .deleteSelection()
        .insertContent(result)
        .run()

      toast.success(`Section "${section.title}" regeneree`)
      setHasGenerated(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Regeneration annulee')
      } else {
        toast.error(err instanceof Error ? err.message : 'Erreur lors de la regeneration')
      }
    } finally {
      setRegeneratingSection(null)
    }
  }

  /**
   * Handle full article optimization
   */
  async function handleOptimize() {
    if (!editor || !guide) return

    setIsOptimizing(true)
    setStreamedText('')

    try {
      const result = await streamWrite('optimize')
      setPendingContent(result)
      setPendingMode('optimize')
      setShowConfirmDialog(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Optimisation annulee')
      } else {
        toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'optimisation')
      }
    } finally {
      setIsOptimizing(false)
    }
  }

  /**
   * Accept generated/optimized content and insert into editor
   */
  function handleAcceptContent() {
    if (!editor || !pendingContent) return

    editor.chain().focus().clearContent().insertContent(pendingContent).run()
    setShowConfirmDialog(false)
    setPendingContent('')
    setHasGenerated(true)
    toast.success(pendingMode === 'full' ? 'Article insere dans l\'editeur' : 'Article optimise insere')
  }

  /**
   * Cancel and discard pending content
   */
  function handleRejectContent() {
    setShowConfirmDialog(false)
    setPendingContent('')
    toast.info('Contenu rejete')
  }

  /**
   * Cancel ongoing generation
   */
  function handleCancel() {
    abortRef.current?.abort()
  }

  // Get model label for display
  const selectedModelLabel = AI_MODELS
    .flatMap(g => g.models)
    .find(m => m.id === selectedModel)?.label || selectedModel

  // ── STATE 1: No SERP data ──
  if (serpPages.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <PenLine className="size-5 text-primary" />
          <h3 className="font-semibold text-base">Redaction IA</h3>
        </div>
        <Card size="sm" className="bg-blue-50 border-blue-200">
          <CardContent className="py-3 px-3 flex items-start gap-2">
            <AlertCircle className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Lancez d&apos;abord une analyse SERP pour utiliser la redaction IA.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── STATE 2: No plan detected ──
  if (!hasPlan) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <PenLine className="size-5 text-primary" />
          <h3 className="font-semibold text-base">Redaction IA</h3>
        </div>
        <Card size="sm" className="bg-amber-50 border-amber-200">
          <CardContent className="py-3 px-3 flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-xs text-amber-700">
                Generez d&apos;abord un plan dans l&apos;onglet Plan pour commencer la redaction.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('plan')}
                className="text-xs"
              >
                Aller a l&apos;onglet Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── STATE 3: Plan detected OR article generated ──
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <PenLine className="size-5 text-primary" />
        <h3 className="font-semibold text-base">Redaction IA</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        {hasGenerated
          ? 'Article genere. Vous pouvez regenerer des sections ou optimiser l\'ensemble.'
          : 'Choisissez un modele IA et generez le contenu pour chaque section du plan.'}
      </p>

      {/* Model selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Modele IA</label>
        <Select
          value={selectedModel}
          onValueChange={(val) => { if (val) setSelectedModel(val) }}
          disabled={isWriting || isOptimizing}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choisir un modele" />
          </SelectTrigger>
          <SelectContent>
            {AI_MODELS.map((group) => (
              <SelectGroup key={group.provider}>
                <SelectLabel>{group.provider}</SelectLabel>
                {group.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Score display (if article generated) */}
      {hasGenerated && (
        <>
          <Card size="sm">
            <CardContent className="py-3 px-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Score actuel</span>
                <span className="text-lg font-bold" style={{ color: scoreColor }}>
                  {score}/120
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (score / 120) * 100)}%`,
                    backgroundColor: scoreColor,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Score cible : {TARGET_SCORE_MIN}-{TARGET_SCORE_MAX}</span>
                <span>{scoreLabel}</span>
              </div>

              {score > 100 && (
                <p className="text-[10px] text-blue-600 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Sur-optimisation detectee. Le contenu peut paraitre artificiel.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Term summary */}
          <div className="flex items-center gap-2 text-xs">
            {missingCount > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                {missingCount} manquants
              </Badge>
            )}
            <Badge variant="outline" className="text-green-600 border-green-300">
              {okCount} OK
            </Badge>
            {excessCount > 0 && (
              <Badge variant="outline" className="text-red-600 border-red-300">
                {excessCount} en exces
              </Badge>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Sections list */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {hasGenerated ? 'Sections' : `Plan detecte (${h2Sections.length} sections)`}
        </label>
        <div className="space-y-1">
          {sections.map((section, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 py-1.5 px-2 rounded text-xs ${
                section.level === 'h3' ? 'pl-6' : ''
              } ${hasGenerated ? 'bg-muted/30' : ''}`}
            >
              <Badge
                variant={section.level === 'h2' ? 'default' : 'secondary'}
                className="text-[10px] shrink-0"
              >
                {section.level.toUpperCase()}
              </Badge>
              <span className="flex-1 truncate">{section.title}</span>
              {hasGenerated && section.level === 'h2' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 shrink-0"
                  onClick={() => handleRegenerateSection(i)}
                  disabled={regeneratingSection !== null || isWriting || isOptimizing}
                  title={`Regenerer "${section.title}"`}
                >
                  {regeneratingSection === i ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Action buttons */}
      {!hasGenerated ? (
        <Button
          onClick={handleWrite}
          disabled={isWriting || !guide}
          className="w-full"
        >
          {isWriting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Ecriture en cours...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Ecrire l&apos;article
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          {!isScoreInTarget && (
            <Button
              onClick={handleOptimize}
              disabled={isOptimizing || isWriting || regeneratingSection !== null}
              className="w-full"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Optimisation en cours...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Optimiser tout l&apos;article
                </>
              )}
            </Button>
          )}

          {isScoreInTarget && (
            <Card size="sm" className="bg-green-50 border-green-200">
              <CardContent className="py-2 px-3 flex items-center gap-2">
                <Check className="size-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700">
                  Score dans la cible ({TARGET_SCORE_MIN}-{TARGET_SCORE_MAX}). L&apos;article est bien optimise.
                </p>
              </CardContent>
            </Card>
          )}

          <Button
            variant="outline"
            onClick={handleWrite}
            disabled={isWriting || isOptimizing}
            className="w-full text-xs"
          >
            <RefreshCw className="size-3" />
            Reecrire tout l&apos;article
          </Button>
        </div>
      )}

      {/* Cancel button during generation */}
      {(isWriting || isOptimizing || regeneratingSection !== null) && (
        <Button variant="outline" onClick={handleCancel} className="w-full text-xs">
          Annuler
        </Button>
      )}

      {/* Streaming preview */}
      {(isWriting || isOptimizing) && streamedText && (
        <Card size="sm" className="bg-muted/30">
          <CardContent className="py-2 px-3">
            <p className="text-[10px] text-muted-foreground mb-1">Apercu en temps reel :</p>
            <div className="text-xs max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
              {streamedText.slice(-500)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Des idees ou remarques ? contact@serpmantics.com
        </p>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => { if (!open) handleRejectContent() }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {pendingMode === 'full' ? 'Article genere' : 'Article optimise'}
            </DialogTitle>
            <DialogDescription>
              Verifiez le contenu genere puis acceptez pour l&apos;inserer dans l&apos;editeur.
              Le contenu actuel sera remplace.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div
              className="prose prose-sm max-w-none p-4"
              dangerouslySetInnerHTML={{ __html: pendingContent }}
            />
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={handleRejectContent}>
              Rejeter
            </Button>
            <Button onClick={handleAcceptContent}>
              Accepter & Inserer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

**Step 3: Commit**

```bash
git add apps/web/src/components/analysis/writer-panel.tsx
git commit -m "feat: add WriterPanel component for AI article generation"
```

---

## Task 5: Wire WriterPanel into the analysis tabs

**Files:**
- Modify: `apps/web/src/components/analysis/analysis-panel.tsx`

**Step 1: Add WriterPanel import and tab**

Add import at top:
```typescript
import { WriterPanel } from './writer-panel'
```

Change `grid-cols-7` to `grid-cols-8` in TabsList.

Add a new TabsTrigger after "plan":
```typescript
<TabsTrigger value="writer" className="text-xs">✍️</TabsTrigger>
```

Add a new TabsContent block after the plan content:
```typescript
<TabsContent value="writer" className="flex-1 overflow-hidden mt-0">
  <ScrollArea className="h-full">
    <ErrorBoundary fallback={panelFallback}>
      <WriterPanel />
    </ErrorBoundary>
  </ScrollArea>
</TabsContent>
```

**Step 2: Verify it renders**

Run: `cd apps/web && pnpm dev`
Open a guide page in the browser. Verify 8 tabs appear. Click the ✍️ tab.

**Step 3: Commit**

```bash
git add apps/web/src/components/analysis/analysis-panel.tsx
git commit -m "feat: add Redaction IA tab to analysis panel"
```

---

## Task 6: Add GOOGLE_GENERATIVE_AI_API_KEY to environment

**Files:**
- Modify: `apps/web/.env.local` (local only, don't commit)

**Step 1: Add the env var**

Add to `.env.local`:
```
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key-here
```

**Step 2: Add to `.env.example` (if exists)**

```
GOOGLE_GENERATIVE_AI_API_KEY=
```

**Step 3: Add to Vercel environment variables**

This is a manual step via the Vercel dashboard:
- Project Settings > Environment Variables
- Add `GOOGLE_GENERATIVE_AI_API_KEY` with the API key

---

## Task 7: Test the full flow end-to-end

**Step 1: Start dev server**

Run: `cd apps/web && pnpm dev`

**Step 2: Test flow**

1. Open a guide with SERP analysis
2. Go to Plan tab → Generate plan → Accept & Insert
3. Go to Redaction IA tab (✍️)
4. Verify plan is detected and sections listed
5. Select a model (start with GPT-4o-mini for cheaper testing)
6. Click "Ecrire l'article"
7. Verify streaming works and confirmation dialog shows
8. Accept → verify content replaces plan in editor
9. Verify score recalculates
10. Test section regeneration (click ↻ on a section)
11. Test "Optimiser tout l'article" if score < 75

**Step 3: Fix any issues found**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete AI article writer with model selection and iterative optimization"
```

---

## Summary

| Task | Description | Files | Estimated Effort |
|------|-------------|-------|-----------------|
| 1 | Add Google Gemini SDK | registry.ts, executor.ts, package.json | Small |
| 2 | Add writer task types to router | router.ts | Small |
| 3 | Create `/api/ai/write` endpoint | route.ts (new) | Medium |
| 4 | Create WriterPanel component | writer-panel.tsx (new) | Large |
| 5 | Wire into analysis tabs | analysis-panel.tsx | Small |
| 6 | Add Google API key | .env.local | Small |
| 7 | End-to-end testing | N/A | Medium |
