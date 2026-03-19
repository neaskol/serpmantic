'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Bot, Play, Plus, Settings, Sparkles, FileText, Pencil, CheckCircle, ImageIcon, Type, Wand2 } from 'lucide-react'

type Prompt = {
  id: string
  title: string
  description: string
  llmProvider: 'anthropic' | 'openai'
  model: string
  scope: 'selection' | 'document'
  category: string
}

const PUBLIC_PROMPTS: Prompt[] = [
  {
    id: 'plan-hn',
    title: 'Construction plan Hn',
    description: 'Genere le plan H2/H3 optimal base sur l\'analyse SERP',
    llmProvider: 'anthropic',
    model: 'Claude Sonnet 4.5',
    scope: 'document',
    category: 'Structure',
  },
  {
    id: 'introduction',
    title: 'Ecrire une bonne introduction',
    description: 'Redige une introduction engageante adaptee au mot-cle cible',
    llmProvider: 'anthropic',
    model: 'Claude Sonnet 4',
    scope: 'document',
    category: 'Redaction',
  },
  {
    id: 'optimize-semantics',
    title: 'Optimiser la semantique du passage',
    description: 'Reecrit le passage selectionne pour ameliorer le score semantique',
    llmProvider: 'openai',
    model: 'GPT-5 Mini',
    scope: 'selection',
    category: 'Optimisation',
  },
  {
    id: 'rewrite-natural',
    title: 'Reecrire avec un ton naturel & humain',
    description: 'Reformule le texte pour un ton plus naturel et engageant',
    llmProvider: 'openai',
    model: 'GPT-5 Mini',
    scope: 'selection',
    category: 'Redaction',
  },
  {
    id: 'remove-fluff',
    title: 'Supprimer les passages sans valeur',
    description: 'Identifie et supprime les passages qui n\'apportent pas d\'information',
    llmProvider: 'openai',
    model: 'GPT-5 Chat',
    scope: 'document',
    category: 'Optimisation',
  },
  {
    id: 'spelling',
    title: 'Corriger orthographe et grammaire',
    description: 'Met en evidence les fautes d\'orthographe et de grammaire',
    llmProvider: 'openai',
    model: 'GPT-5 Chat',
    scope: 'document',
    category: 'Correction',
  },
  {
    id: 'suggest-media',
    title: 'Suggerer des medias pertinents',
    description: 'Propose des ajouts d\'images, videos, tableaux et outils',
    llmProvider: 'openai',
    model: 'GPT-5 Chat',
    scope: 'document',
    category: 'Enrichissement',
  },
  {
    id: 'conclusion',
    title: 'Ecrire une conclusion efficace',
    description: 'Redige une conclusion qui resume et engage a l\'action',
    llmProvider: 'anthropic',
    model: 'Claude Sonnet 4',
    scope: 'document',
    category: 'Redaction',
  },
  {
    id: 'meta-tags',
    title: 'Generer title et meta description',
    description: 'Propose des meta title et descriptions optimises SEO',
    llmProvider: 'openai',
    model: 'GPT-5 Mini',
    scope: 'document',
    category: 'SEO',
  },
  {
    id: 'expand-section',
    title: 'Developper une section',
    description: 'Enrichit et developpe le passage selectionne avec plus de details',
    llmProvider: 'anthropic',
    model: 'Claude Sonnet 4.5',
    scope: 'selection',
    category: 'Redaction',
  },
  {
    id: 'simplify',
    title: 'Simplifier le langage',
    description: 'Reformule le texte pour le rendre plus accessible et lisible',
    llmProvider: 'openai',
    model: 'GPT-5 Mini',
    scope: 'selection',
    category: 'Redaction',
  },
  {
    id: 'add-examples',
    title: 'Ajouter des exemples concrets',
    description: 'Enrichit le contenu avec des exemples pratiques et illustratifs',
    llmProvider: 'anthropic',
    model: 'Claude Sonnet 4',
    scope: 'selection',
    category: 'Enrichissement',
  },
  {
    id: 'faq-section',
    title: 'Generer une section FAQ',
    description: 'Cree une section de questions frequentes basee sur les intentions de recherche',
    llmProvider: 'openai',
    model: 'GPT-5 Chat',
    scope: 'document',
    category: 'Structure',
  },
  {
    id: 'internal-links',
    title: 'Suggerer des ancres de liens',
    description: 'Propose des textes d\'ancrage optimises pour le maillage interne',
    llmProvider: 'openai',
    model: 'GPT-5 Mini',
    scope: 'document',
    category: 'SEO',
  },
  {
    id: 'tone-professional',
    title: 'Adapter au ton professionnel',
    description: 'Ajuste le registre vers un ton plus professionnel et expert',
    llmProvider: 'openai',
    model: 'GPT-5 Chat',
    scope: 'selection',
    category: 'Redaction',
  },
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Structure': <FileText className="size-3.5" />,
  'Redaction': <Pencil className="size-3.5" />,
  'Optimisation': <Sparkles className="size-3.5" />,
  'Correction': <CheckCircle className="size-3.5" />,
  'Enrichissement': <ImageIcon className="size-3.5" />,
  'SEO': <Type className="size-3.5" />,
}

export function AssistantPanel() {
  const guide = useGuideStore((s) => s.guide)
  const plainText = useEditorStore((s) => s.plainText)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const filteredPrompts = PUBLIC_PROMPTS.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const categories = [...new Set(filteredPrompts.map((p) => p.category))]

  async function handleExecute(prompt: Prompt) {
    if (!guide) return
    setExecutingId(prompt.id)
    setResult(null)

    try {
      const res = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId: prompt.id,
          keyword: guide.keyword,
          language: guide.language,
          content: plainText,
          scope: prompt.scope,
          llmProvider: prompt.llmProvider,
          model: prompt.model,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResult(data.result)
      } else {
        setResult('Erreur lors de l\'execution du prompt. Verifiez votre configuration API.')
      }
    } catch {
      setResult('Erreur reseau. Verifiez votre connexion.')
    } finally {
      setExecutingId(null)
    }
  }

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

      {/* Context warning */}
      <Card size="sm" className="bg-amber-50 border-amber-200">
        <CardContent className="py-2 px-3">
          <p className="text-xs text-amber-700">
            Aucun contexte disponible — Creez-en un pour personnaliser les prompts
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      <Input
        placeholder="Rechercher un prompt..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-7 text-xs"
      />

      {/* Result display */}
      {result && (
        <Card size="sm" className="bg-muted/50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Resultat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs whitespace-pre-wrap leading-relaxed">{result}</p>
          </CardContent>
        </Card>
      )}

      {/* Prompts by category */}
      {categories.map((category) => (
        <div key={category}>
          <div className="flex items-center gap-1.5 mb-2">
            {CATEGORY_ICONS[category] ?? <Wand2 className="size-3.5" />}
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
                    <p className="text-xs text-muted-foreground line-clamp-1">{prompt.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {prompt.model}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleExecute(prompt)}
                    disabled={executingId !== null || !guide}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  >
                    {executingId === prompt.id ? (
                      <span className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="size-3" />
                    )}
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
    </div>
  )
}
