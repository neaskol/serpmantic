'use client'

import { useEffect, useState } from 'react'
import { useContextStore } from '@/stores/context-store'
import { useGuideStore } from '@/stores/guide-store'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings } from 'lucide-react'
import { ContextDialog } from './context-dialog'

export function ContextSelector() {
  const guide = useGuideStore((s) => s.guide)
  const contexts = useContextStore((s) => s.contexts)
  const activeContextId = useContextStore((s) => s.activeContextId)
  const loading = useContextStore((s) => s.loading)
  const fetchContexts = useContextStore((s) => s.fetchContexts)
  const setActiveContext = useContextStore((s) => s.setActiveContext)
  const initActiveContext = useContextStore((s) => s.initActiveContext)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Fetch contexts on mount
  useEffect(() => {
    fetchContexts()
  }, [fetchContexts])

  // Sync active context from guide when guide loads
  useEffect(() => {
    if (guide?.active_context_id !== undefined) {
      initActiveContext(guide.active_context_id ?? null)
    }
  }, [guide?.active_context_id, initActiveContext])

  function handleValueChange(value: string | null) {
    if (!guide) return
    if (value === '__none__' || value === null) {
      setActiveContext(null, guide.id)
    } else {
      setActiveContext(value, guide.id)
    }
  }

  const activeContext = contexts.find((c) => c.id === activeContextId)

  // Show skeleton during initial load only
  if (loading && contexts.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="size-7" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={activeContextId ?? '__none__'}
          onValueChange={handleValueChange}
          disabled={loading || !guide}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue placeholder="Aucun contexte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Aucun contexte</SelectItem>
            {contexts.map((ctx) => (
              <SelectItem key={ctx.id} value={ctx.id}>
                {ctx.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setDialogOpen(true)}
          title="Gérer les contextes"
        >
          <Settings className="size-3.5" />
        </Button>
      </div>

      {/* Active context preview */}
      {activeContext && (
        <div className="text-[11px] text-muted-foreground space-y-0.5 pl-1">
          {activeContext.audience && <div>Audience: {activeContext.audience}</div>}
          {activeContext.tone && <div>Ton: {activeContext.tone}</div>}
          {activeContext.sector && <div>Secteur: {activeContext.sector}</div>}
        </div>
      )}

      {/* Context management dialog */}
      <ContextDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
