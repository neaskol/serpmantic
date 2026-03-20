'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Sparkles, AlertTriangle, BookOpen, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { OutlineSection } from '@/types/database'

/**
 * Normalize text: lowercase + remove accents
 */
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function PlanPanel() {
  const guide = useGuideStore((s) => s.guide)
  const score = useGuideStore((s) => s.score)
  const serpPages = useGuideStore((s) => s.serpPages)
  const semanticTerms = useGuideStore((s) => s.semanticTerms)
  const editor = useEditorStore((s) => s.editor)
  const plainText = useEditorStore((s) => s.plainText)

  const [generating, setGenerating] = useState(false)
  const [outline, setOutline] = useState<OutlineSection[] | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const editorHasContent = plainText.trim().length > 50

  async function handleGenerate() {
    if (!guide) {
      toast.error('Aucun guide charge')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId: guide.id }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Erreur inconnue' }))

        // In development, show full error details
        let fullError = errData.error || `HTTP ${res.status}`
        if (process.env.NODE_ENV === 'development' && errData.details) {
          fullError += `\n\nDetails: ${JSON.stringify(errData.details, null, 2)}`
        }
        if (process.env.NODE_ENV === 'development' && errData.message) {
          fullError += `\n\nMessage: ${errData.message}`
        }

        throw new Error(fullError)
      }

      const data = await res.json()
      setOutline(data.outline)
      setShowPreview(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la generation'
      setError(errorMessage)
      toast.error(errorMessage)

      // Log full error to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[Plan Generation Error]', err)
      }
    } finally {
      setGenerating(false)
    }
  }

  function handleAccept() {
    if (!editor) {
      toast.error('Editeur non disponible')
      return
    }
    if (!outline) {
      toast.error('Aucun plan a inserer')
      return
    }

    // Over-optimization check (rough estimate, not precise scoring)
    // Filter for scoring-positive terms (!is_to_avoid)
    const scoringTerms = semanticTerms.filter((t) => !t.is_to_avoid)

    if (scoringTerms.length > 0) {
      // Normalize all outline titles
      const normalizedOutlineText = outline
        .map((section) => normalizeText(section.title))
        .join(' ')

      // Count matches (each term counted at most once)
      let matchCount = 0
      for (const term of scoringTerms) {
        const normalizedTerm = normalizeText(term.display_term || term.term)
        if (normalizedOutlineText.includes(normalizedTerm)) {
          matchCount++
        }
      }

      // Rough estimate: each match in headings adds ~3 occurrences when written
      const estimatedScore = score + matchCount * 3

      if (estimatedScore > 100) {
        const confirmed = window.confirm(
          `Attention : ce plan pourrait augmenter votre score semantique a environ ~${Math.round(estimatedScore)} (estimation approximative). Le seuil de sur-optimisation est 100. Voulez-vous continuer ?`
        )
        if (!confirmed) {
          return
        }
      }
    }

    // Convert outline to HTML headings
    const html = outline
      .map((section) => {
        if (section.level === 'h2') {
          return `<h2>${section.title}</h2>`
        } else {
          return `<h3>${section.title}</h3>`
        }
      })
      .join('\n')

    // Insert into editor
    editor.chain().focus().insertContent(html).run()

    // Close dialog
    setShowPreview(false)
    setOutline(null)

    toast.success("Plan insere dans l'editeur")
  }

  function handleReject() {
    setShowPreview(false)
    setOutline(null)
    toast.info('Plan rejete')
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="size-5 text-primary" />
        <h3 className="font-semibold text-base">Plan de contenu</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Generez le plan H2/H3 optimal base sur l&apos;analyse des pages les mieux classees dans la SERP.
      </p>

      {/* Warning if editor has content */}
      {editorHasContent && (
        <Card size="sm" className="bg-amber-50 border-amber-200">
          <CardContent className="py-2 px-3 flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              L&apos;editeur contient deja du contenu. Videz l&apos;editeur avant de generer un nouveau plan.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No SERP warning */}
      {serpPages.length === 0 && (
        <Card size="sm" className="bg-blue-50 border-blue-200">
          <CardContent className="py-2 px-3 flex items-start gap-2">
            <AlertCircle className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Lancez d&apos;abord une analyse SERP pour generer un plan.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Card size="sm" className="bg-red-50 border-red-200">
          <CardContent className="py-3 px-3">
            <p className="text-xs font-semibold text-red-800 mb-2">Erreur lors de la génération du plan</p>
            <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono bg-red-100 p-2 rounded overflow-auto max-h-40">
              {error}
            </pre>
            <p className="text-xs text-red-600 mt-2">
              Ouvrez la console du navigateur (F12) pour plus de détails.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generating || !guide || editorHasContent || serpPages.length === 0}
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

      {/* Help section */}
      <Separator />

      <button
        onClick={() => setShowHelp(!showHelp)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <BookOpen className="size-4" />
        Aide a la construction du plan
        {showHelp ? <ChevronUp className="size-4 ml-auto" /> : <ChevronDown className="size-4 ml-auto" />}
      </button>

      {showHelp && (
        <Card size="sm" className="bg-muted/30">
          <CardContent className="py-3 px-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Le plan optimal est genere en analysant les structures H2/H3 des pages
              les mieux classees pour votre mot-cle cible.
            </p>
            <p className="text-xs text-muted-foreground">
              L&apos;algorithme regroupe les sous-themes les plus representes et cree un plan
              qui couvre l&apos;ensemble des sujets attendus par Google.
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
              <li>Videz l&apos;editeur</li>
              <li>Cliquez sur &quot;Generer le plan optimal&quot;</li>
              <li>Revisez et ajustez le plan genere</li>
              <li>Inserez-le dans l&apos;editeur</li>
              <li>Redigez votre contenu section par section</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Des idees ou remarques ? contact@serpmantics.com
        </p>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => { if (!open) handleReject() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apercu du plan genere</DialogTitle>
            <DialogDescription>
              Verifiez le plan puis acceptez pour l&apos;inserer dans l&apos;editeur ou rejetez pour le supprimer.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {outline && (
              <div className="space-y-2 p-2">
                {outline.map((section, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 py-1.5 ${
                      section.level === 'h3' ? 'pl-4' : ''
                    }`}
                  >
                    <Badge
                      variant={section.level === 'h2' ? 'default' : 'secondary'}
                      className="text-[10px] shrink-0 mt-0.5"
                    >
                      {section.level.toUpperCase()}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${section.level === 'h2' ? 'font-semibold' : ''}`}>
                        {section.title}
                      </span>
                      {section.keywords && section.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {section.keywords.slice(0, 3).map((kw, kwIdx) => (
                            <Badge key={kwIdx} variant="outline" className="text-[10px]">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={handleReject}>
              Rejeter
            </Button>
            <Button onClick={handleAccept}>
              Accepter & Inserer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
