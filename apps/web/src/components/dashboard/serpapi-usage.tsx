'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Progress, ProgressIndicator } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

interface SerpApiUsage {
  requests_today: number
  daily_average: number
  monthly_limit: number
  requests_remaining_today: number
  reset_at: string | null
  percentage_used: number
  error?: string
}

export function SerpApiUsageWidget() {
  const [usage, setUsage] = useState<SerpApiUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/serpapi/usage')
        if (res.ok) {
          const data = await res.json()
          setUsage(data)
        }
      } catch (error) {
        console.error('Failed to fetch SerpAPI usage:', error)
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
    if (percentage < 50) return 'bg-blue-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusText = (percentage: number) => {
    if (percentage < 50) return 'Utilisation faible'
    if (percentage < 80) return 'Utilisation normale'
    if (percentage < 100) return 'Attention - Quota quotidien bientôt atteint'
    return '⚠️ Quota quotidien dépassé'
  }

  const estimatedMonthlyUsage = usage.requests_today * 30

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Quota SerpAPI</h3>
          <span className="text-xs text-muted-foreground">Plan gratuit</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Requêtes aujourd&apos;hui</span>
            <span className="font-mono font-semibold">
              {usage.requests_today} / ~{usage.daily_average}
            </span>
          </div>

          <Progress value={usage.percentage_used} className="h-2">
            <ProgressIndicator className={getStatusColor(usage.percentage_used)} />
          </Progress>

          <p className="text-xs text-muted-foreground">
            {getStatusText(usage.percentage_used)}
          </p>
        </div>

        <div className="space-y-1 pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Limite mensuelle</span>
            <span className="font-mono">{usage.monthly_limit} requêtes/mois</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Estimation mois en cours</span>
            <span className="font-mono font-semibold">
              ~{estimatedMonthlyUsage} / {usage.monthly_limit}
            </span>
          </div>
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

        {estimatedMonthlyUsage > usage.monthly_limit * 0.8 && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-3">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Attention :</strong> Vous risquez de dépasser la limite mensuelle de {usage.monthly_limit} requêtes.
              Implémentez le cache SERP pour réduire les appels API.
            </p>
          </div>
        )}

        {usage.percentage_used >= 100 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-3">
            <p className="text-xs text-red-800 dark:text-red-200">
              <strong>⚠️ Quota quotidien dépassé</strong> : Limitez la création de nouveaux guides ou
              implémentez le cache SERP pour éviter les requêtes inutiles.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
