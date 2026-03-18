'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'

const METRIC_LABELS: Record<string, string> = {
  words: 'Mots',
  headings: 'Titres',
  paragraphs: 'Paragraphes',
  links: 'Liens',
  images: 'Images',
  videos: 'Videos',
  tables: 'Tableaux',
  lists: 'Listes',
}

export function StructuralMetrics() {
  const metrics = useGuideStore((s) => s.structuralMetrics)
  const benchmarks = useGuideStore((s) => s.serpAnalysis?.structural_benchmarks)

  if (!benchmarks) {
    return <p className="text-sm text-muted-foreground p-4">Lancez une analyse SERP pour voir les metriques.</p>
  }

  const entries = Object.entries(METRIC_LABELS) as [keyof typeof METRIC_LABELS, string][]

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Metriques structurelles</h3>
      <div className="divide-y">
        {entries.map(([key, label]) => {
          const value = metrics[key as keyof typeof metrics]
          const bench = benchmarks[key as keyof typeof benchmarks]
          if (!bench) return null

          let status: 'ok' | 'missing' | 'excess' = 'ok'

          if (value < bench.min) {
            status = 'missing'
          } else if (value > bench.max) {
            status = 'excess'
          }

          return (
            <div key={key} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">{value}</span>
                <span className="text-muted-foreground text-xs">({bench.min}-{bench.max})</span>
                <Badge variant={status === 'ok' ? 'default' : 'destructive'} className="text-xs">
                  {status === 'ok' ? 'OK' : status === 'missing' ? `+${bench.min - value}` : `-${value - bench.max}`}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
