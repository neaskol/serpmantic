'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  PenLine,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Check,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectedSection {
  level: 'h2' | 'h3'
  title: string
  from: number
  to: number
}

interface ModelOption {
  id: string
  label: string
  provider: string
}

const MODEL_GROUPS: { label: string; models: ModelOption[] }[] = [
  {
    label: 'Anthropic',
    models: [
      { id: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', provider: 'anthropic' },
      { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic' },
    ],
  },
  {
    label: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
    ],
  },
  {
    label: 'Google',
    models: [
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google' },
    ],
  },
]

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5-20250929'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect H2/H3 headings from the TipTap editor document.
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
 * Find the range of a given H2 section (from its heading to the next H2 or end of doc).
 */
function findSectionRange(
  editor: any,
  sectionIndex: number,
  sections: DetectedSection[]
): { from: number; to: number } | null {
  if (!editor) return null
  const h2Sections = sections.filter((s) => s.level === 'h2')
  const section = h2Sections[sectionIndex]
  if (!section) return null

  const nextH2 = h2Sections[sectionIndex + 1]
  const docEnd = editor.state.doc.content.size

  return {
    from: section.from,
    to: nextH2 ? nextH2.from : docEnd,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WriterPanel() {
  // Store selectors
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

  // Local state
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [generating, setGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingHtml, setPendingHtml] = useState('')
  const [regeneratingSection, setRegeneratingSection] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Detect sections from editor
  const sections = useMemo(() => detectSections(editor), [editor, plainText])
  const h2Sections = useMemo(() => sections.filter((s) => s.level === 'h2'), [sections])
  const hasPlan = h2Sections.length >= 2

  // Detect if article has been generated (content exists beyond just headings)
  useEffect(() => {
    if (hasPlan && plainText.trim().length > 0) {
      // Check if there is content beyond just the headings
      const headingText = sections.map((s) => s.title).join('')
      const contentWithoutHeadings = plainText.replace(/\s+/g, '').length - headingText.replace(/\s+/g, '').length
      if (contentWithoutHeadings > 100) {
        setHasGenerated(true)
      }
    }
  }, [hasPlan, plainText, sections])

  // Term summary counts
  const termSummary = useMemo(() => {
    const missing = termStatuses.filter((t) => t.status === 'missing').length
    const ok = termStatuses.filter((t) => t.status === 'ok').length
    const excess = termStatuses.filter((t) => t.status === 'excess').length
    return { missing, ok, excess }
  }, [termStatuses])

  // ---------------------------------------------------------------------------
  // API calls
  // ---------------------------------------------------------------------------

  const handleWrite = useCallback(
    async (mode: 'full' | 'section' | 'optimize', sectionIndex?: number) => {
      if (!guide || !editor) {
        toast.error('Guide ou editeur non disponible')
        return
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      if (mode === 'section' && sectionIndex !== undefined) {
        setRegeneratingSection(sectionIndex)
      } else {
        setGenerating(true)
      }
      setStreamedText('')
      setError(null)

      try {
        // Always send current editor HTML for context
        const currentHtml = editor.getHTML()

        const body: Record<string, unknown> = {
          guideId: guide.id,
          modelId: selectedModel,
          mode,
          currentContent: currentHtml,
        }

        if (mode === 'section' && sectionIndex !== undefined) {
          const range = findSectionRange(editor, sectionIndex, sections)
          if (!range) {
            toast.error('Section introuvable')
            return
          }
          const h2s = sections.filter((s) => s.level === 'h2')
          body.sectionHeading = h2s[sectionIndex]?.title
          body.sectionIndex = sectionIndex
          // Extract section content as HTML
          try {
            const { DOMSerializer } = await import('@tiptap/pm/model')
            const slice = editor.state.doc.slice(range.from, range.to)
            const serializer = DOMSerializer.fromSchema(editor.schema)
            const tempDiv = document.createElement('div')
            const dom = serializer.serializeFragment(slice.content)
            tempDiv.appendChild(dom)
            body.sectionContent = tempDiv.innerHTML
          } catch {
            // Fallback: send plain text
            body.sectionContent = editor.state.doc.textBetween(range.from, range.to, '\n')
          }
        }

        const res = await fetch('/api/ai/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
          throw new Error(errData.error || `HTTP ${res.status}`)
        }

        if (!res.body) {
          throw new Error('Pas de body dans la reponse')
        }

        // Read the stream
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
          setStreamedText(fullText)
        }

        // Show confirmation dialog with the generated HTML
        if (mode === 'full' || mode === 'optimize') {
          setPendingHtml(fullText)
          setShowConfirmDialog(true)
        } else if (mode === 'section' && sectionIndex !== undefined) {
          // For section regeneration, replace directly
          const range = findSectionRange(editor, sectionIndex, sections)
          if (range) {
            editor
              .chain()
              .focus()
              .setTextSelection({ from: range.from, to: range.to })
              .deleteSelection()
              .insertContent(fullText)
              .run()
            toast.success('Section regeneree avec succes')
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          toast.info('Generation annulee')
        } else {
          const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la generation'
          setError(errorMessage)
          toast.error(errorMessage)
        }
      } finally {
        setGenerating(false)
        setRegeneratingSection(null)
        abortControllerRef.current = null
      }
    },
    [guide, editor, selectedModel, sections]
  )

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const handleAcceptGeneration = useCallback(() => {
    if (!editor || !pendingHtml) return

    editor.chain().focus().clearContent().insertContent(pendingHtml).run()

    setHasGenerated(true)
    setShowConfirmDialog(false)
    setPendingHtml('')
    setStreamedText('')
    toast.success('Article insere dans l\'editeur')
  }, [editor, pendingHtml])

  const handleRejectGeneration = useCallback(() => {
    setShowConfirmDialog(false)
    setPendingHtml('')
    setStreamedText('')
    toast.info('Generation rejetee')
  }, [])

  // ---------------------------------------------------------------------------
  // Render — State 1: No SERP data
  // ---------------------------------------------------------------------------

  if (serpPages.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <PenLine className="size-5 text-primary" />
          <h3 className="font-semibold text-base">Redaction IA</h3>
        </div>

        <Card size="sm" className="bg-blue-50 border-blue-200">
          <CardContent className="py-2 px-3 flex items-start gap-2">
            <AlertCircle className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Lancez d&apos;abord une analyse SERP pour utiliser la redaction IA.
            </p>
          </CardContent>
        </Card>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            Des idees ou remarques ? contact@serpmantics.com
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render — State 2: No plan detected
  // ---------------------------------------------------------------------------

  if (!hasPlan) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <PenLine className="size-5 text-primary" />
          <h3 className="font-semibold text-base">Redaction IA</h3>
        </div>

        <Card size="sm" className="bg-amber-50 border-amber-200">
          <CardContent className="py-2 px-3 flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Generez d&apos;abord un plan dans l&apos;onglet Plan pour commencer la redaction.
            </p>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setActiveTab('plan')}
        >
          <Sparkles className="size-4" />
          Aller a l&apos;onglet Plan
        </Button>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            Des idees ou remarques ? contact@serpmantics.com
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render — State 3: Plan detected / Article generated
  // ---------------------------------------------------------------------------

  const isWorking = generating || regeneratingSection !== null

  return (
    <div className="flex flex-col h-full min-h-0">
    <ScrollArea className="flex-1 min-h-0">
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <PenLine className="size-5 text-primary" />
        <h3 className="font-semibold text-base">Redaction IA</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Redigez automatiquement votre article section par section a partir du plan detecte dans l&apos;editeur.
      </p>

      {/* Model selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Modele IA</label>
        <Select
          value={selectedModel}
          onValueChange={(val) => {
            if (val) setSelectedModel(val)
          }}
          disabled={isWorking}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
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

      <Separator />

      {/* Detected sections list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Plan detecte</h4>
          <Badge variant="secondary" className="text-[10px]">
            {sections.length} sections
          </Badge>
        </div>

        <div className="space-y-0.5">
            {sections.map((section, index) => {
              const h2Index = section.level === 'h2'
                ? sections.filter((s, i) => i <= index && s.level === 'h2').length - 1
                : null

              return (
                <div
                  key={`${section.level}-${index}`}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted/50 transition-colors ${
                    section.level === 'h3' ? 'ml-4' : ''
                  }`}
                >
                  <Badge
                    variant={section.level === 'h2' ? 'default' : 'secondary'}
                    className="text-[10px] shrink-0"
                  >
                    {section.level.toUpperCase()}
                  </Badge>
                  <span className={`text-xs truncate flex-1 ${section.level === 'h2' ? 'font-semibold' : ''}`}>
                    {section.title}
                  </span>
                  {/* Per-section regenerate button (H2 only) */}
                  {hasGenerated && section.level === 'h2' && h2Index !== null && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleWrite('section', h2Index)}
                      disabled={isWorking}
                      title={`Regenerer la section "${section.title}"`}
                      aria-label={`Regenerer la section "${section.title}"`}
                    >
                      {regeneratingSection === h2Index ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
      </div>

      <Separator />

      {/* Error display */}
      {error && (
        <Card size="sm" className="bg-red-50 border-red-200">
          <CardContent className="py-2 px-3">
            <p className="text-xs text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Score and term summary (only after generation) */}
      {hasGenerated && (
        <>
          {/* Score display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Score semantique</span>
              <span className="text-sm font-bold" style={{ color: scoreColor }}>
                {score}/120
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((score / 120) * 100, 100)}%`,
                  backgroundColor: scoreColor,
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Objectif : 75-85</span>
              <Badge
                variant={score >= 75 && score <= 85 ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {scoreLabel}
              </Badge>
            </div>
          </div>

          {/* Term summary badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="destructive" className="text-[10px]">
              {termSummary.missing} manquants
            </Badge>
            <Badge variant="default" className="text-[10px]">
              <Check className="size-2.5" />
              {termSummary.ok} OK
            </Badge>
            {termSummary.excess > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {termSummary.excess} en exces
              </Badge>
            )}
          </div>

          <Separator />

          {/* Success card if score is in target range */}
          {score >= 75 && score <= 85 && (
            <Card size="sm" className="bg-green-50 border-green-200">
              <CardContent className="py-2 px-3 flex items-start gap-2">
                <Check className="size-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">
                  Excellent ! Votre score est dans la fourchette optimale (75-85). Le contenu est bien optimise.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Optimize button if score is below target */}
          {score < 75 && (
            <Button
              onClick={() => handleWrite('optimize')}
              disabled={isWorking}
              className="w-full"
              size="sm"
            >
              {generating ? (
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

        </>
      )}

      {/* Cancel button during generation */}
      {isWorking && (
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={handleCancel}
        >
          <X className="size-4" />
          Annuler la generation
        </Button>
      )}

      {/* Streaming preview card */}
      {isWorking && streamedText.length > 0 && (
        <Card size="sm" className="bg-muted/30">
          <CardContent className="py-2 px-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">Apercu en temps reel</span>
            </div>
            <ScrollArea className="max-h-32">
              <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words">
                {streamedText.length > 500
                  ? '...' + streamedText.slice(-500)
                  : streamedText}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Des idees ou remarques ? contact@serpmantics.com
        </p>
      </div>
    </div>
    </ScrollArea>

      {/* Sticky bottom action button */}
      <div className="shrink-0 border-t bg-background p-3 space-y-2">
        {!hasGenerated && (
          <Button
            onClick={() => handleWrite('full')}
            disabled={isWorking}
            className="w-full"
            size="sm"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Redaction en cours...
              </>
            ) : (
              <>
                <PenLine className="size-4" />
                Ecrire l&apos;article
              </>
            )}
          </Button>
        )}

        {hasGenerated && (
          <Button
            variant="outline"
            onClick={() => handleWrite('full')}
            disabled={isWorking}
            className="w-full"
            size="sm"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reecriture en cours...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Reecrire tout l&apos;article
              </>
            )}
          </Button>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apercu de l&apos;article genere</DialogTitle>
            <DialogDescription>
              Verifiez le contenu genere avant de l&apos;inserer dans l&apos;editeur. Cette action remplacera le contenu actuel.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] border rounded-md p-3">
            <div
              className="prose prose-sm max-w-none text-xs"
              dangerouslySetInnerHTML={{ __html: pendingHtml }}
            />
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRejectGeneration}
            >
              <X className="size-4" />
              Rejeter
            </Button>
            <Button
              size="sm"
              onClick={handleAcceptGeneration}
            >
              <Check className="size-4" />
              Accepter et inserer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
