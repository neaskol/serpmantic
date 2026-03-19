'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { FileText, Sparkles, AlertTriangle, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

type PlanSection = {
  level: 'h2' | 'h3'
  title: string
  keywords: string[]
}

export function PlanPanel() {
  const guide = useGuideStore((s) => s.guide)
  const serpPages = useGuideStore((s) => s.serpPages)
  const semanticTerms = useGuideStore((s) => s.semanticTerms)
  const plainText = useEditorStore((s) => s.plainText)
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState<PlanSection[] | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const editorHasContent = plainText.trim().length > 50

  async function handleGenerate() {
    if (!guide) return
    if (editorHasContent) return

    setGenerating(true)
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: guide.keyword,
          language: guide.language,
          serpPages: serpPages.filter((p) => !p.is_excluded).map((p) => ({
            url: p.url,
            title: p.title,
            score: p.score,
          })),
          topTerms: semanticTerms
            .filter((t) => !t.is_to_avoid)
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 30)
            .map((t) => t.display_term),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setPlan(data.plan)
      } else {
        setPlan(null)
      }
    } catch {
      setPlan(null)
    } finally {
      setGenerating(false)
    }
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
              L&apos;editeur contient deja du contenu. La generation du plan remplacera le contenu actuel.
              Videz l&apos;editeur avant de generer un nouveau plan.
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

      {serpPages.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Lancez d&apos;abord une analyse SERP pour generer un plan.
        </p>
      )}

      {/* Generated plan */}
      {plan && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Plan genere</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {plan.map((section, i) => (
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
                    {section.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {section.keywords.map((kw) => (
                          <Badge key={kw} variant="outline" className="text-[10px]">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-3" />

            <Button size="sm" variant="outline" className="w-full">
              Inserer dans l&apos;editeur
            </Button>
          </CardContent>
        </Card>
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
    </div>
  )
}
