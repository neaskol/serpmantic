'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Link2, AlertTriangle, ArrowRight, ArrowLeft, Search } from 'lucide-react'
import { toast } from 'sonner'

type LinkSuggestion = {
  targetUrl: string
  targetTitle: string
  anchorText: string
  relevanceScore: number
  direction: 'outgoing' | 'incoming'
  context: string
}

export function LinksPanel() {
  const guide = useGuideStore((s) => s.guide)
  const [linkedUrl, setLinkedUrl] = useState(guide?.linked_url ?? '')
  const [groupId, setGroupId] = useState(guide?.group_id ?? '')
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<LinkSuggestion[] | null>(null)

  const isConfigured = linkedUrl.trim().length > 0 && groupId.trim().length > 0

  async function handleAnalyzeLinks() {
    if (!guide || !isConfigured) return
    setAnalyzing(true)

    try {
      const res = await fetch('/api/ai/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guideId: guide.id,
          keyword: guide.keyword,
          linkedUrl,
          groupId,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions)
      }
    } catch {
      toast.error('Erreur lors de l\'analyse du maillage. Veuillez reessayer.')
    } finally {
      setAnalyzing(false)
    }
  }

  const outgoing = suggestions?.filter((s) => s.direction === 'outgoing') ?? []
  const incoming = suggestions?.filter((s) => s.direction === 'incoming') ?? []

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link2 className="size-5 text-primary" />
        <h3 className="font-semibold text-base">Maillage interne</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Suggestions de liens internes entrants et sortants pour renforcer votre maillage.
      </p>

      {/* Configuration */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">URL de la page</label>
            <Input
              placeholder="https://monsite.com/mon-article"
              value={linkedUrl}
              onChange={(e) => setLinkedUrl(e.target.value)}
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              L&apos;URL publiee de cet article (ou future URL)
            </p>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Groupe de guides</label>
            <Input
              placeholder="Nom du groupe (ex: Blog principal)"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Regroupez vos guides par site ou section pour le maillage
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Warning if not configured */}
      {!isConfigured && (
        <Card size="sm" className="bg-amber-50 border-amber-200">
          <CardContent className="py-2.5 px-3 flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-700 font-medium">Configuration requise</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Pour obtenir des suggestions de maillage, vous devez :
              </p>
              <ol className="text-xs text-amber-600 mt-1 space-y-0.5 list-decimal pl-4">
                <li>Lier une URL a ce guide</li>
                <li>Assigner un groupe de guides (autres pages du site)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyze button */}
      <Button
        onClick={handleAnalyzeLinks}
        disabled={analyzing || !guide || !isConfigured}
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
            Analyser le maillage
          </>
        )}
      </Button>

      {/* Suggestions */}
      {suggestions && (
        <>
          {/* Outgoing links */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowRight className="size-3.5 text-blue-500" />
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Liens sortants ({outgoing.length})
              </h4>
            </div>

            {outgoing.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Aucune suggestion de lien sortant
              </p>
            ) : (
              <div className="space-y-1.5">
                {outgoing.map((link, i) => (
                  <Card key={i} size="sm">
                    <CardContent className="py-2 px-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{link.targetTitle}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{link.targetUrl}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {link.relevanceScore}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Ancre :</span>
                        <Badge variant="secondary" className="text-[10px]">{link.anchorText}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{link.context}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Incoming links */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowLeft className="size-3.5 text-green-500" />
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Liens entrants ({incoming.length})
              </h4>
            </div>

            {incoming.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Aucune suggestion de lien entrant
              </p>
            ) : (
              <div className="space-y-1.5">
                {incoming.map((link, i) => (
                  <Card key={i} size="sm">
                    <CardContent className="py-2 px-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{link.targetTitle}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{link.targetUrl}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {link.relevanceScore}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Ancre :</span>
                        <Badge variant="secondary" className="text-[10px]">{link.anchorText}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{link.context}</p>
                    </CardContent>
                  </Card>
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
