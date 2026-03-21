'use client'

import { useState, useCallback } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FileText,
  Sparkles,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  ArrowUp,
  ArrowDown,
  Plus,
  ArrowRight,
  Trash2,
  RefreshCw,
} from 'lucide-react'
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
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionLevel, setNewSectionLevel] = useState<'h2' | 'h3'>('h2')
  const [showClearDialog, setShowClearDialog] = useState(false)

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

        const userMessage = errData.message || errData.error || `Erreur serveur (${res.status})`
        if (process.env.NODE_ENV === 'development') {
          console.error('[Plan Generation] Full error:', errData)
        }
        throw new Error(userMessage)
      }

      const data = await res.json()
      setOutline(data.outline)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la generation'
      setError(errorMessage)
      toast.error(errorMessage)

      if (process.env.NODE_ENV === 'development') {
        console.error('[Plan Generation Error]', err)
      }
    } finally {
      setGenerating(false)
    }
  }

  // --- Inline editing handlers ---

  const handleUpdateTitle = useCallback((index: number, newTitle: string) => {
    setOutline((prev) => {
      if (!prev) return prev
      const updated = [...prev]
      updated[index] = { ...updated[index], title: newTitle }
      return updated
    })
  }, [])

  const handleToggleLevel = useCallback((index: number) => {
    setOutline((prev) => {
      if (!prev) return prev
      const updated = [...prev]
      const current = updated[index]
      updated[index] = { ...current, level: current.level === 'h2' ? 'h3' : 'h2' }
      return updated
    })
  }, [])

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    setOutline((prev) => {
      if (!prev) return prev
      const updated = [...prev]
      ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
      return updated
    })
  }, [])

  const handleMoveDown = useCallback((index: number) => {
    setOutline((prev) => {
      if (!prev || index >= prev.length - 1) return prev
      const updated = [...prev]
      ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
      return updated
    })
  }, [])

  const handleDelete = useCallback((index: number) => {
    setOutline((prev) => {
      if (!prev) return prev
      const updated = prev.filter((_, i) => i !== index)
      return updated.length === 0 ? null : updated
    })
  }, [])

  const handleAddSection = useCallback(() => {
    if (!newSectionTitle.trim()) return
    const newSection: OutlineSection = {
      level: newSectionLevel,
      title: newSectionTitle.trim(),
      keywords: [],
    }
    setOutline((prev) => (prev ? [...prev, newSection] : [newSection]))
    setNewSectionTitle('')
    setShowAddForm(false)
  }, [newSectionTitle, newSectionLevel])

  // --- Insert into editor ---

  function handleInsertToEditor() {
    if (!editor) {
      toast.error('Editeur non disponible')
      return
    }
    if (!outline || outline.length === 0) {
      toast.error('Aucun plan a inserer')
      return
    }

    // Over-optimization check
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
        const confirmed = window.confirm(
          `Attention : ce plan pourrait augmenter votre score semantique a environ ~${Math.round(estimatedScore)} (estimation approximative). Le seuil de sur-optimisation est 100. Voulez-vous continuer ?`
        )
        if (!confirmed) return
      }
    }

    // Convert outline to HTML
    const htmlParts: string[] = []
    outline.forEach((section) => {
      if (section.level === 'h2') {
        htmlParts.push(`<h2>${section.title}</h2>`)
      } else {
        htmlParts.push(`<h3>${section.title}</h3>`)
      }
      const paragraphCount = section.level === 'h2' ? 2 : 1
      for (let i = 0; i < paragraphCount; i++) {
        htmlParts.push('<p></p>')
      }
    })

    const html = htmlParts.join('\n')
    editor.chain().focus().insertContent(html).run()

    setOutline(null)
    toast.success("Plan insere dans l'editeur")
  }

  function handleClearOutline() {
    setShowClearDialog(true)
  }

  function confirmClearOutline() {
    setOutline(null)
    setShowClearDialog(false)
    toast.info('Plan supprime')
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
      {editorHasContent && !outline && (
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
          <CardContent className="py-2 px-3 flex items-start gap-2">
            <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-800">{error}</p>
              <Button
                size="xs"
                variant="outline"
                className="mt-1.5 text-red-700"
                onClick={handleGenerate}
                disabled={generating}
              >
                <RefreshCw className="size-3" />
                Reessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate button — hidden when outline exists */}
      {!outline && (
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
      )}

      {/* ========== INLINE EDITABLE PLAN PREVIEW ========== */}
      {outline && outline.length > 0 && (
        <>
          <Separator />

          {/* Plan header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">Plan genere</h4>
              <Badge variant="secondary" className="text-[10px]">
                {outline.length} sections
              </Badge>
            </div>
          </div>

          {/* Editable section list */}
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-1">
              {outline.map((section, index) => (
                <div
                  key={index}
                  className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted/50 transition-colors ${
                    section.level === 'h3' ? 'ml-4' : ''
                  }`}
                >
                  {/* Level badge — clickable to toggle */}
                  <button
                    onClick={() => handleToggleLevel(index)}
                    title="Cliquez pour basculer H2/H3"
                    className="shrink-0"
                  >
                    <Badge
                      variant={section.level === 'h2' ? 'default' : 'secondary'}
                      className="text-[10px] cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {section.level.toUpperCase()}
                    </Badge>
                  </button>

                  {/* Editable title */}
                  <Input
                    value={section.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleUpdateTitle(index, e.target.value)
                    }
                    className={`h-7 text-xs border-transparent bg-transparent px-1.5 focus-visible:border-input focus-visible:bg-background ${
                      section.level === 'h2' ? 'font-semibold' : ''
                    }`}
                  />

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title="Monter"
                      aria-label="Monter la section"
                    >
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === outline.length - 1}
                      title="Descendre"
                      aria-label="Descendre la section"
                    >
                      <ArrowDown className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(index)}
                      title="Supprimer"
                      aria-label="Supprimer la section"
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Add section */}
          {showAddForm ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setNewSectionLevel(newSectionLevel === 'h2' ? 'h3' : 'h2')}
                className="shrink-0"
              >
                <Badge
                  variant={newSectionLevel === 'h2' ? 'default' : 'secondary'}
                  className="text-[10px] cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {newSectionLevel.toUpperCase()}
                </Badge>
              </button>
              <Input
                value={newSectionTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') handleAddSection()
                  if (e.key === 'Escape') {
                    setShowAddForm(false)
                    setNewSectionTitle('')
                  }
                }}
                placeholder="Titre de la section..."
                className="h-7 text-xs"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleAddSection}
                disabled={!newSectionTitle.trim()}
                title="Ajouter"
                aria-label="Ajouter la section"
              >
                <Plus className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setShowAddForm(false)
                  setNewSectionTitle('')
                }}
                title="Annuler"
                aria-label="Annuler"
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="size-3" />
              Ajouter une section
            </Button>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={handleInsertToEditor} className="flex-1" size="sm">
              <ArrowRight className="size-4" />
              Inserer dans l&apos;editeur
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearOutline}
              title="Supprimer le plan"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </>
      )}

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
              <li>Modifiez le plan directement (renommer, reordonner, supprimer)</li>
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

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le plan ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le plan genere sera supprime. Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearOutline} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
