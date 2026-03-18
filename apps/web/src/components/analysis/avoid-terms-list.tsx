'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'

export function AvoidTermsList() {
  const termStatuses = useGuideStore((s) => s.termStatuses)
  const avoidTerms = termStatuses.filter(ts => ts.term.is_to_avoid)

  if (avoidTerms.length === 0) return null

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Expressions a eviter</h3>
      <div className="space-y-1 px-4 pb-2">
        {avoidTerms.map((ts) => (
          <div key={ts.term.id} className="flex items-center justify-between p-2 border rounded text-sm">
            <span>{ts.term.display_term}</span>
            <div className="flex items-center gap-2">
              {ts.count > 0 ? (
                <>
                  <span className="text-xs text-muted-foreground">{ts.count} occurrence(s)</span>
                  <Badge variant="destructive" className="text-xs">Supprimer</Badge>
                </>
              ) : (
                <Badge variant="default" className="text-xs">Bien !</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
