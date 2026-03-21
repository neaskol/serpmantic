'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export function ScoreDisplay({ loading = false }: { loading?: boolean }) {
  const score = useGuideStore((s) => s.score)
  const label = useGuideStore((s) => s.scoreLabel)
  const color = useGuideStore((s) => s.scoreColor)
  const hasAnalysis = useGuideStore((s) => !!s.serpAnalysis)

  if (loading) {
    return (
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  const percentage = Math.round((score / 120) * 100)

  return (
    <div className="p-4 border rounded-lg" role="status" aria-label={`Score semantique: ${score} sur 120, ${label}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-sm text-muted-foreground">/120</span>
        </div>
        <span className="text-sm font-medium px-2 py-1 rounded" style={{ backgroundColor: color + '20', color }}>
          {label}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      {score > 100 && (
        <p className="text-sm text-blue-600 mt-2 font-medium">
          Attention : sur-optimisation detectee. Essayez de ne pas depasser 100.
        </p>
      )}
      {score > 0 && score <= 100 && hasAnalysis && (
        <p className="text-sm text-muted-foreground mt-2">
          Meilleur que {Math.round((score / 120) * 100)}% des pages de la 1ere page Google
        </p>
      )}
    </div>
  )
}
