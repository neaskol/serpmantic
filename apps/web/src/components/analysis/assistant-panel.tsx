'use client'

import { useState, useEffect } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { useAiStore } from '@/stores/ai-store'
import { useContextStore } from '@/stores/context-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bot, Play, Plus, Settings, Sparkles, FileText, Pencil, CheckCircle, ImageIcon, Type, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContextSelector } from './context-selector'
import type { Prompt } from '@/types/database'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Structure': <FileText className="size-3.5" />,
  'Redaction': <Pencil className="size-3.5" />,
  'Optimisation': <Sparkles className="size-3.5" />,
  'Correction': <CheckCircle className="size-3.5" />,
  'Enrichissement': <ImageIcon className="size-3.5" />,
  'SEO': <Type className="size-3.5" />,
}

function getModelDisplayName(modelId: string): string {
  const names: Record<string, string> = {
    'anthropic/claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
    'anthropic/claude-sonnet-4-20250514': 'Claude Sonnet 4',
    'openai/gpt-4o': 'GPT-4o',
    'openai/gpt-4o-mini': 'GPT-4o Mini',
  }
  return names[modelId] || modelId.split('/').pop() || modelId
}

export function AssistantPanel() {
  const guide = useGuideStore((s) => s.guide)
  const editor = useEditorStore((s) => s.editor)
  const status = useAiStore((s) => s.status)
  const streamedText = useAiStore((s) => s.streamedText)
  const lastResult = useAiStore((s) => s.lastResult)
  const error = useAiStore((s) => s.error)
  const executePrompt = useAiStore((s) => s.executePrompt)
  const acceptResult = useAiStore((s) => s.acceptResult)
  const rejectResult = useAiStore((s) => s.rejectResult)
  const reset = useAiStore((s) => s.reset)
  const activeContextId = useContextStore((s) => s.activeContextId)
  const contexts = useContextStore((s) => s.contexts)

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(null)
  const [capturedSelection, setCapturedSelection] = useState<{ from: number; to: number } | null>(null)

  // Fetch prompts from database
  useEffect(() => {
    fetch('/api/prompts')
      .then((res) => res.json())
      .then((data) => setPrompts(data.prompts || []))
      .catch(() => toast.error('Erreur lors du chargement des prompts'))
      .finally(() => setLoading(false))
  }, [])

  // Detect selection in editor
  useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to)
      setSelection(text ? { from, to, text } : null)
    }

    editor.on('selectionUpdate', updateSelection)
    editor.on('update', updateSelection)

    return () => {
      editor.off('selectionUpdate', updateSelection)
      editor.off('update', updateSelection)
    }
  }, [editor])

  async function handleExecute(prompt: Prompt) {
    if (!guide) {
      toast.error('Aucun guide charge')
      return
    }

    // Selection-scoped prompt requires selection
    if (prompt.scope === 'selection' && !selection) {
      toast.error('Selectionnez du texte dans l\'editeur')
      return
    }

    // Capture selection before modal steals focus
    if (selection) {
      setCapturedSelection({ from: selection.from, to: selection.to })
    }

    await executePrompt(prompt.id, guide.id, {
      selectedText: selection?.text,
      scope: prompt.scope as 'selection' | 'document',
    })
  }

  function handleAccept() {
    const result = acceptResult() // Returns text and resets ai-store to 'idle'
    if (!result) {
      toast.error('Aucun resultat a inserer')
      return
    }
    if (!editor) {
      toast.error('Editeur non disponible')
      return
    }

    if (capturedSelection) {
      // Replace the selected text with AI result
      editor.chain()
        .focus()
        .setTextSelection(capturedSelection)
        .insertContent(result)
        .run()
    } else {
      // Insert at current cursor position
      editor.chain()
        .focus()
        .insertContent(result)
        .run()
    }

    setCapturedSelection(null)
    toast.success('Suggestion IA inseree dans l\'editeur')
  }

  function handleReject() {
    rejectResult() // Resets ai-store to 'idle'
    setCapturedSelection(null)
    toast.info('Suggestion IA rejetee')
  }

  const filteredPrompts = prompts.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const categories = [...new Set(filteredPrompts.map((p) => p.category).filter(Boolean))]

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          <h3 className="font-semibold text-base">IAssistant</h3>
        </div>
        <div className="flex gap-1.5">
          <Button size="xs" variant="outline">
            <Plus className="size-3" />
            Ajouter
          </Button>
          <Button size="xs" variant="ghost">
            <Settings className="size-3" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Bibliotheque de prompts IA pour optimiser votre contenu. Chaque prompt utilise le modele le plus adapte.
      </p>

      {/* Context section */}
      <ContextSelector />
      {!activeContextId && contexts.length === 0 && (
        <Card size="sm" className="bg-amber-50 border-amber-200">
          <CardContent className="py-2 px-3">
            <p className="text-xs text-amber-700">
              Aucun contexte disponible — Creez-en un pour personnaliser les prompts
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Input
        placeholder="Rechercher un prompt..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-7 text-xs"
      />

      {/* Selection indicator */}
      {selection && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Selection:</span>
          <Badge variant="secondary" className="text-[10px]">
            {selection.text.length > 30 ? selection.text.slice(0, 30) + '...' : selection.text}
          </Badge>
        </div>
      )}

      {/* Streaming preview */}
      {(status === 'loading' || status === 'streaming') && (
        <Card size="sm" className="bg-muted/30 border-blue-200">
          <CardContent className="py-3 px-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">
                {status === 'loading' ? 'Preparation...' : 'Generation en cours...'}
              </span>
            </div>
            {streamedText && (
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-48 overflow-auto">
                {streamedText}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {status === 'error' && (
        <Card size="sm" className="bg-red-50 border-red-200">
          <CardContent className="py-2 px-3">
            <p className="text-xs text-red-700">{error || 'Une erreur est survenue'}</p>
            <Button size="xs" variant="outline" className="mt-1" onClick={() => reset()}>
              Fermer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-xs text-muted-foreground text-center py-4">
          Chargement des prompts...
        </div>
      )}

      {/* Prompts by category */}
      {!loading && categories.map((category) => (
        <div key={category}>
          <div className="flex items-center gap-1.5 mb-2">
            {CATEGORY_ICONS[category as string] ?? <Wand2 className="size-3.5" />}
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</h4>
          </div>
          <div className="space-y-1.5">
            {filteredPrompts
              .filter((p) => p.category === category)
              .map((prompt) => (
                <div
                  key={prompt.id}
                  className="group flex items-start justify-between gap-2 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-medium truncate">{prompt.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {prompt.scope === 'selection' ? 'Selection' : 'Document'}
                      </Badge>
                    </div>
                    {prompt.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{prompt.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {getModelDisplayName(prompt.model_id)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleExecute(prompt)}
                    disabled={status !== 'idle' || !guide}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  >
                    <Play className="size-3" />
                  </Button>
                </div>
              ))}
          </div>
          <Separator className="mt-3" />
        </div>
      ))}

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Des idees ou remarques ? contact@serpmantics.com
        </p>
      </div>

      {/* Result Dialog */}
      <Dialog
        open={status === 'success'}
        onOpenChange={(open) => { if (!open) handleReject() }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultat IA</DialogTitle>
            <DialogDescription>
              Verifiez le resultat puis acceptez pour l&apos;inserer dans l&apos;editeur ou rejetez pour le supprimer.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed p-2">{lastResult}</pre>
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
