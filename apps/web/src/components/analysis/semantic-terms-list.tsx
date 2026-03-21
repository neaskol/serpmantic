'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

function TermSkeleton() {
  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
    </div>
  )
}

export function SemanticTermsList({ loading = false }: { loading?: boolean }) {
  const termStatuses = useGuideStore((s) => s.termStatuses)
  const filter = useGuideStore((s) => s.termFilter)
  const setFilter = useGuideStore((s) => s.setTermFilter)
  const [search, setSearch] = useState('')

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="px-4 pt-3">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-1 px-4">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
        <div className="space-y-1 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TermSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const scorableTerms = termStatuses.filter(ts => !ts.term.is_to_avoid)

  const filtered = scorableTerms.filter(ts => {
    if (filter === 'missing') return ts.status === 'missing'
    if (filter === 'excess') return ts.status === 'excess'
    return true
  }).filter(ts => {
    if (!search.trim()) return true
    return ts.term.display_term.toLowerCase().includes(search.toLowerCase())
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
            aria-pressed={filter === f}
          >
            {f === 'all' ? 'Toutes' : f === 'missing' ? 'A ajouter' : 'A supprimer'}
          </Button>
        ))}
      </div>

      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un terme..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            aria-label="Rechercher un terme"
          />
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
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
      </div>
    </div>
  )
}
