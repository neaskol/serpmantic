'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export function SemanticTermsList() {
  const termStatuses = useGuideStore((s) => s.termStatuses)
  const filter = useGuideStore((s) => s.termFilter)
  const setFilter = useGuideStore((s) => s.setTermFilter)

  const scorableTerms = termStatuses.filter(ts => !ts.term.is_to_avoid)

  const filtered = scorableTerms.filter(ts => {
    if (filter === 'missing') return ts.status === 'missing'
    if (filter === 'excess') return ts.status === 'excess'
    return true
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 px-4 pt-3">
        <h3 className="text-sm font-semibold flex-1">Expressions semantiques</h3>
      </div>

      <div className="flex gap-1 px-4">
        {(['all', 'missing', 'excess'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs"
          >
            {f === 'all' ? 'Toutes' : f === 'missing' ? 'A ajouter' : 'A supprimer'}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-1 px-4 pb-4">
          {filtered.map((ts) => (
            <div
              key={ts.term.id}
              className={`flex items-center justify-between p-2 rounded text-sm ${
                ts.term.is_main_keyword ? 'border-2 border-gray-900' : 'border'
              }`}
            >
              <div className="flex-1">
                <span className={ts.term.is_main_keyword ? 'font-bold' : ''}>
                  {ts.term.display_term}
                </span>
                {ts.term.is_main_keyword && (
                  <Badge variant="secondary" className="ml-2 text-xs">MOT-CLE</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">
                  {ts.count}/{ts.term.min_occurrences}-{ts.term.max_occurrences}
                </span>
                <Badge
                  variant={ts.status === 'ok' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {ts.status === 'ok'
                    ? 'OK'
                    : ts.status === 'missing'
                      ? `+${ts.delta}`
                      : `${ts.delta}`}
                </Badge>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune expression a afficher.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
