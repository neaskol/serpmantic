'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Progress, ProgressIndicator } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

interface TextRazorUsage {
  daily_limit: number
  requests_today: number
  requests_remaining: number
  reset_at: string | null
  percentage_used: number
  error?: string
}

export function TextRazorUsageWidget() {
  const [usage, setUsage] = useState<TextRazorUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/textrazor/usage')
        if (res.ok) {
          const data = await res.json()
          setUsage(data)
        }
      } catch (error) {
        console.error('Failed to fetch TextRazor usage:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsage()
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </Card>
    )
  }

  if (!usage) {
    return null
  }

  const getStatusColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusText = (percentage: number) => {
    if (percentage < 50) return 'Utilisation normale'
    if (percentage < 80) return 'Utilisation modérée'
    if (percentage < 95) return 'Attention - Quota bientôt atteint'
    return '⚠️ Quota presque épuisé'
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Quota TextRazor API</h3>
          <span className="text-xs text-muted-foreground">Plan gratuit</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Requêtes aujourd&apos;hui</span>
            <span className="font-mono font-semibold">
              {usage.requests_today} / {usage.daily_limit}
            </span>
          </div>

          <Progress value={usage.percentage_used} className="h-2">
            <ProgressIndicator className={getStatusColor(usage.percentage_used)} />
          </Progress>

          <p className="text-xs text-muted-foreground">
            {getStatusText(usage.percentage_used)}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Requêtes restantes</span>
          <span className="font-mono">{usage.requests_remaining}</span>
        </div>

        {usage.reset_at && (
          <p className="text-xs text-muted-foreground">
            Réinitialisation : {new Date(usage.reset_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        )}

        {usage.error && (
          <p className="text-xs text-yellow-600 dark:text-yellow-500">
            ⚠️ {usage.error}
          </p>
        )}

        {usage.percentage_used >= 90 && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-3">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Conseil :</strong> Implémentez le cache SERP pour réduire les appels API de 70-80%
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
