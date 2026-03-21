'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Target, Search, FileCheck, HelpCircle, ShoppingCart, Navigation, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

type IntentType = 'informationnel' | 'transactionnel' | 'navigationnel' | 'comparatif'

type IntentResult = {
  primaryIntent: IntentType
  confidence: number
  intents: {
    type: IntentType
    percentage: number
    description: string
    questions: string[]
  }[]
}

type ContentAnalysis = {
  coversIntents: boolean
  matchedIntents: IntentType[]
  missingIntents: IntentType[]
  suggestions: string[]
}

const INTENT_CONFIG: Record<IntentType, { label: string; icon: React.ReactNode; color: string }> = {
  informationnel: { label: 'Informationnel', icon: <HelpCircle className="size-3.5" />, color: '#3b82f6' },
  transactionnel: { label: 'Transactionnel', icon: <ShoppingCart className="size-3.5" />, color: '#22c55e' },
  navigationnel: { label: 'Navigationnel', icon: <Navigation className="size-3.5" />, color: '#a855f7' },
  comparatif: { label: 'Comparatif', icon: <BarChart3 className="size-3.5" />, color: '#f59e0b' },
}

export function IntentionPanel() {
  const guide = useGuideStore((s) => s.guide)
  const serpPages = useGuideStore((s) => s.serpPages)
  const plainText = useEditorStore((s) => s.plainText)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingContent, setAnalyzingContent] = useState(false)
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null)
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysis | null>(null)

  async function handleIdentifyIntents() {
    if (!guide) return
    setAnalyzing(true)

    try {
      const res = await fetch('/api/ai/intention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: guide.keyword,
          language: guide.language,
          serpPages: serpPages.filter((p) => !p.is_excluded).map((p) => ({
            url: p.url,
            title: p.title,
          })),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.message || 'Erreur lors de l\'analyse des intentions')
        return
      }

      const data = await res.json()
      setIntentResult(data)
    } catch {
      toast.error('Erreur lors de l\'analyse des intentions. Veuillez reessayer.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleAnalyzeContent() {
    if (!guide || !intentResult) return
    setAnalyzingContent(true)

    try {
      const res = await fetch('/api/ai/intention/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: guide.keyword,
          language: guide.language,
          content: plainText,
          intents: intentResult.intents.map((i) => i.type),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        toast.error(
          errorData.message || 'Erreur lors de l\'analyse du contenu. Verifiez que votre contenu contient au moins 50 caracteres.'
        )
        return
      }

      const data = await res.json()
      setContentAnalysis(data)
    } catch {
      toast.error('Erreur lors de l\'analyse du contenu. Veuillez reessayer.')
    } finally {
      setAnalyzingContent(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="size-5 text-primary" />
        <h3 className="font-semibold text-base">Intention de recherche</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Analysez l&apos;intention derriere le mot-cle cible et verifiez que votre contenu y repond.
      </p>

      {/* Action buttons */}
      <div className="space-y-2">
        <Button
          onClick={handleIdentifyIntents}
          disabled={analyzing || !guide || serpPages.length === 0}
          variant="outline"
          className="w-full"
        >
          {analyzing ? (
            <>
              <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Search className="size-4" />
              Identifier les intentions
            </>
          )}
        </Button>

        <Button
          onClick={handleAnalyzeContent}
          disabled={analyzingContent || !guide || !intentResult || plainText.trim().length < 50}
          variant="outline"
          className="w-full"
        >
          {analyzingContent ? (
            <>
              <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Analyse du contenu...
            </>
          ) : (
            <>
              <FileCheck className="size-4" />
              Analyser mon contenu
            </>
          )}
        </Button>
      </div>

      {analyzing && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      )}

      {serpPages.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Lancez d&apos;abord une analyse SERP pour identifier les intentions.
        </p>
      )}

      {/* Intent results */}
      {intentResult && (
        <>
          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3">Intentions identifiees</h4>

            {/* Primary intent */}
            <Card size="sm" className="mb-3">
              <CardContent className="py-2.5 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {INTENT_CONFIG[intentResult.primaryIntent].icon}
                    <span className="text-sm font-medium">
                      Intention principale : {INTENT_CONFIG[intentResult.primaryIntent].label}
                    </span>
                  </div>
                  <Badge className="text-[10px]">
                    {intentResult.confidence}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* All intents */}
            <div className="space-y-2">
              {intentResult.intents.map((intent) => {
                const config = INTENT_CONFIG[intent.type]
                return (
                  <Card key={intent.type} size="sm">
                    <CardContent className="py-2.5 px-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {config.icon}
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${intent.percentage}%`, backgroundColor: config.color }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{intent.percentage}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{intent.description}</p>
                      {intent.questions.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Questions associees</span>
                          <ul className="space-y-0.5">
                            {intent.questions.map((q, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Content analysis results */}
      {contentAnalysis && (
        <>
          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3">Analyse de votre contenu</h4>

            <Card size="sm" className={contentAnalysis.coversIntents ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}>
              <CardContent className="py-2.5 px-3 space-y-2">
                <p className={`text-sm font-medium ${contentAnalysis.coversIntents ? 'text-green-700' : 'text-amber-700'}`}>
                  {contentAnalysis.coversIntents
                    ? 'Votre contenu couvre les intentions principales'
                    : 'Votre contenu ne couvre pas toutes les intentions'}
                </p>

                {contentAnalysis.matchedIntents.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {contentAnalysis.matchedIntents.map((intent) => (
                      <Badge key={intent} variant="secondary" className="text-[10px] bg-green-100 text-green-700">
                        {INTENT_CONFIG[intent].label}
                      </Badge>
                    ))}
                  </div>
                )}

                {contentAnalysis.missingIntents.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-amber-600">Intentions manquantes :</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contentAnalysis.missingIntents.map((intent) => (
                        <Badge key={intent} variant="destructive" className="text-[10px]">
                          {INTENT_CONFIG[intent].label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {contentAnalysis.suggestions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <h5 className="text-xs font-medium">Suggestions d&apos;amelioration</h5>
                {contentAnalysis.suggestions.map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-primary mt-0.5 shrink-0">→</span>
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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
