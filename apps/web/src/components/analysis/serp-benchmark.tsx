'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'

export function SerpBenchmark() {
  const pages = useGuideStore((s) => s.serpPages)

  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Lancez une analyse SERP pour voir le benchmark.</p>
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Benchmark SERP</h3>
      <div className="space-y-1 px-4 pb-4">
        {pages
          .sort((a, b) => a.position - b.position)
          .map((page) => (
            <div key={page.id} className={`p-3 border rounded text-sm ${page.is_excluded ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium truncate flex-1 mr-2">{page.title}</span>
                <span className="font-bold text-lg">{page.score}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mb-1">{page.url}</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{page.metrics.words} mots</Badge>
                <Badge variant="outline" className="text-xs">{page.metrics.headings} titres</Badge>
                <Badge variant="outline" className="text-xs">{page.metrics.links} liens</Badge>
                <Badge variant="outline" className="text-xs">{page.metrics.images} images</Badge>
              </div>
              {page.is_excluded && (
                <p className="text-xs text-muted-foreground mt-1 italic">Resultat non pris en compte</p>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
